/**
 * Splits a session's Q&A into pairs and stores them. Each split rewrites the
 * session's whole set of pairs, so running it again is always safe.
 */

import { and, asc, eq, isNotNull, isNull, lt, or, sql } from "drizzle-orm";

import { getDatabase } from "$db/index";
import { pairs, segments, sessions } from "$db/schema";
import { completeJsonAsync } from "$llm/complete-json";
import { replaceSessionPairsAsync } from "$search/archive";

import { buildSplitPrompt, isSplitAnswer, readSplitAnswer, selectQaSegments, SPLIT_ANSWER_SCHEMA } from "./split.ts";

import type { IndexableSession } from "$search/archive";

import type { TranscriptSegment } from "./contract.ts";
import type { SplitResult } from "./split.ts";

export interface SplitSessionOptions {
	/**
	 * A split started while the talk was live. If the session has ended by
	 * the time it finishes, the final split owns the pairs and this one is
	 * thrown away.
	 */
	readonly isLive: boolean;
}

const NO_PAIRS: SplitResult = { pairs: [], qaStartMs: undefined };

/** A live session is split again once its last split is this old. */
const LIVE_SPLIT_CUTOFF = sql`now() - interval '30 seconds'`;

async function askForPairsAsync(
	sessionSegments: ReadonlyArray<TranscriptSegment>,
	qaStartMs?: number,
): Promise<SplitResult> {
	const sent = selectQaSegments(sessionSegments, qaStartMs);
	if (sent.length === 0) return NO_PAIRS;

	const prompt = buildSplitPrompt(sent, qaStartMs !== undefined);
	const request = { name: "question_pairs", schema: SPLIT_ANSWER_SCHEMA, ...prompt };
	const answer = await completeJsonAsync(request, isSplitAnswer);

	return readSplitAnswer(answer, sent);
}

/**
 * Replaces the session's pairs in one transaction. The session row is locked
 * first, so two splits of one session write one after the other.
 *
 * @param sessionId - The session whose pairs are replaced.
 * @param result - The new pairs, and the Q&A start the model found.
 * @param options - Whether a live split started this.
 * @returns Whether the pairs were stored.
 */
async function storePairsAsync(sessionId: number, result: SplitResult, options: SplitSessionOptions): Promise<boolean> {
	return getDatabase().transaction(async function replacePairsAsync(transaction) {
		const lockedRows = await transaction
			.select({ qaStartMs: sessions.qaStartMs, status: sessions.status })
			.from(sessions)
			.where(eq(sessions.id, sessionId))
			.for("update");
		const locked = lockedRows.at(0);
		if (locked === undefined || (options.isLive && locked.status === "ended")) return false;

		await transaction.delete(pairs).where(eq(pairs.sessionId, sessionId));

		if (result.pairs.length > 0) {
			await transaction.insert(pairs).values(result.pairs.map((pair) => ({ sessionId, ...pair })));
		}

		await transaction
			.update(sessions)
			.set({ qaStartMs: locked.qaStartMs ?? result.qaStartMs, splitAt: sql`now()` })
			.where(eq(sessions.id, sessionId));

		return true;
	});
}

async function indexPairsAsync(session: IndexableSession, result: SplitResult): Promise<void> {
	// Postgres has the pairs, so a search outage shouldn't fail the split.
	try {
		await replaceSessionPairsAsync(session, result.pairs);
	} catch (error) {
		console.error(`Couldn't index the pairs of session ${session.id}:`, error);
	}
}

/**
 * Splits a session's Q&A into question-and-answer pairs with the language
 * model, stores them in place of the old ones, and indexes them for search.
 * Without a Q&A mark the model reads the whole talk and finds where the Q&A
 * starts, and that start is saved.
 *
 * @param sessionId - The session to split.
 * @param options - Whether the talk is still live.
 * @rejects When the language model fails or its answer has the wrong shape.
 * @returns How many pairs the session has now.
 */
export async function splitSessionAsync(sessionId: number, options: SplitSessionOptions): Promise<number> {
	const database = getDatabase();
	const sessionRows = await database
		.select({ id: sessions.id, qaStartMs: sessions.qaStartMs, speaker: sessions.speaker, title: sessions.title })
		.from(sessions)
		.where(eq(sessions.id, sessionId));
	const session = sessionRows.at(0);
	if (session === undefined) return 0;

	const sessionSegments = await database
		.select({ endMs: segments.endMs, sequence: segments.sequence, startMs: segments.startMs, text: segments.text })
		.from(segments)
		.where(eq(segments.sessionId, sessionId))
		.orderBy(asc(segments.sequence));

	const result = await askForPairsAsync(sessionSegments, session.qaStartMs ?? undefined);
	if (!(await storePairsAsync(sessionId, result, options))) return 0;

	await indexPairsAsync(session, result);
	return result.pairs.length;
}

/**
 * Claims the next live split of a session without a lock: the update only
 * matches when the Q&A has started and the last split is 30 seconds old, so
 * of several replicas only one gets the row back.
 *
 * @param sessionId - The live session that just received segments.
 * @returns Whether this replica should split it now.
 */
async function claimLiveSplitAsync(sessionId: number): Promise<boolean> {
	const isDue = or(isNull(sessions.splitAt), lt(sessions.splitAt, LIVE_SPLIT_CUTOFF));
	const claimed = await getDatabase()
		.update(sessions)
		.set({ splitAt: sql`now()` })
		.where(and(eq(sessions.id, sessionId), eq(sessions.status, "live"), isNotNull(sessions.qaStartMs), isDue))
		.returning({ id: sessions.id });

	return claimed.length > 0;
}

/**
 * Re-splits a live session's Q&A when it is due, so attendees see pairs
 * appear during the talk. Meant to run without being awaited: it never
 * rejects, and logs what goes wrong.
 *
 * @param sessionId - The live session that just received segments.
 * @returns Resolves when the split, if any, is done.
 */
export async function splitLiveSessionIfDueAsync(sessionId: number): Promise<void> {
	try {
		if (await claimLiveSplitAsync(sessionId)) {
			await splitSessionAsync(sessionId, { isLive: true });
		}
	} catch (error) {
		console.error(`Live split of session ${sessionId} failed:`, error);
	}
}
