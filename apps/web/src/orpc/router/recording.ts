/**
 * The recording path: the presenter's phone starts a session, sends finished
 * sentences in small batches, marks the Q&A, and ends the session. Every
 * procedure here needs the shared presenter code.
 */

import { ORPCError, os } from "@orpc/server";
import { isPositiveInteger, isUndefined, isUrlString } from "@web-template/arktype-utilities";
import { type } from "arktype";
import { eq, sql } from "drizzle-orm";

import { isPresenterCode } from "$archive/presenter-code";
import { splitLiveSessionIfDueAsync, splitSessionAsync } from "$archive/split-session";
import { getDatabase } from "$db/index";
import { segments, sessions } from "$db/schema";
import { deleteSessionDocumentsAsync, indexSegmentsAsync } from "$search/archive";

const isPresenterCodeInput = type("string <= 200").or(isUndefined);
const isSessionId = isPositiveInteger;
const isOffset = type("0 <= number % 1 <= 86400000");
const isHttpsUrl = isUrlString.and(type(/^https:\/\/\S+$/u)).and("string <= 2000");

const NO_SUCH_SESSION = "There is no session with that id.";

const isNewSegment = type({
	endMs: isOffset,
	sequence: "0 <= number % 1 <= 1000000",
	startMs: isOffset,
	text: "1 <= string <= 2000",
});

/**
 * Refuses the call unless it carries the presenter code.
 *
 * @param presenterCode - The code sent with the call, if any.
 * @throws {ORPCError} `UNAUTHORIZED` when the code is missing or wrong.
 */
function requirePresenter(presenterCode?: string): void {
	if (!isPresenterCode(presenterCode)) {
		throw new ORPCError("UNAUTHORIZED", { message: "That presenter code isn't right." });
	}
}

interface CreatedSession {
	readonly id: number;
}

// An insert with `returning` always yields the inserted row.
export const startSession = os
	.input(
		type({
			"presenterCode?": isPresenterCodeInput,
			// A blank field on the form means "no recording".
			"recordingUrl?": isHttpsUrl.or("''").or(isUndefined),
			speaker: "1 <= string <= 200",
			title: "1 <= string <= 200",
		}).readonly(),
	)
	.handler(async function startSessionHandler({ input }): Promise<CreatedSession> {
		requirePresenter(input.presenterCode);

		const [session] = await getDatabase()
			.insert(sessions)
			.values({
				recordingUrl:
					input.recordingUrl === undefined || input.recordingUrl.length === 0
						? undefined
						: input.recordingUrl,
				speaker: input.speaker.trim(),
				title: input.title.trim(),
			})
			.returning({ id: sessions.id });

		return { id: session.id };
	});

interface AppendResult {
	readonly accepted: number;
}

export const appendSegments = os
	.input(
		type({
			"presenterCode?": isPresenterCodeInput,
			segments: isNewSegment.array().readonly().atLeastLength(1).atMostLength(100),
			sessionId: isSessionId,
		}).readonly(),
	)
	.handler(async function appendSegmentsHandler({ input }): Promise<AppendResult> {
		requirePresenter(input.presenterCode);

		const database = getDatabase();
		const sessionRows = await database
			.select({ id: sessions.id, speaker: sessions.speaker, status: sessions.status, title: sessions.title })
			.from(sessions)
			.where(eq(sessions.id, input.sessionId));
		const session = sessionRows.at(0);
		if (session === undefined) {
			throw new ORPCError("NOT_FOUND", { message: NO_SUCH_SESSION });
		}

		if (session.status === "ended") {
			throw new ORPCError("CONFLICT", { message: "This session has ended." });
		}

		// The phone numbers its segments, so a batch sent twice is stored once.
		const inserted = await database
			.insert(segments)
			.values(input.segments.map((segment) => ({ ...segment, sessionId: session.id })))
			.onConflictDoNothing({ target: [segments.sessionId, segments.sequence] })
			.returning({
				endMs: segments.endMs,
				sequence: segments.sequence,
				startMs: segments.startMs,
				text: segments.text,
			});

		// Postgres has the segments, so a search outage shouldn't fail the
		// request.
		try {
			await indexSegmentsAsync(session, inserted);
		} catch (error) {
			console.error(`Couldn't index segments of session ${session.id}:`, error);
		}

		// Not awaited: the split takes seconds and the phone shouldn't wait.
		if (inserted.length > 0) {
			// oxlint-disable-next-line no-void -- It logs its own errors and never rejects.
			void splitLiveSessionIfDueAsync(session.id);
		}

		return { accepted: inserted.length };
	});

interface QaMark {
	readonly qaStartMs: number;
}

export const markQaStart = os
	.input(
		type({
			offsetMs: isOffset,
			"presenterCode?": isPresenterCodeInput,
			sessionId: isSessionId,
		}).readonly(),
	)
	.handler(async function markQaStartHandler({ input }): Promise<QaMark> {
		requirePresenter(input.presenterCode);

		const marked = await getDatabase()
			.update(sessions)
			.set({ qaStartMs: input.offsetMs })
			.where(eq(sessions.id, input.sessionId))
			.returning({ id: sessions.id });

		if (marked.length === 0) {
			throw new ORPCError("NOT_FOUND", { message: NO_SUCH_SESSION });
		}

		return { qaStartMs: input.offsetMs };
	});

interface EndResult {
	readonly pairCount: number;
}

export const endSession = os
	.input(
		type({
			"presenterCode?": isPresenterCodeInput,
			sessionId: isSessionId,
		}).readonly(),
	)
	.handler(async function endSessionHandler({ input }): Promise<EndResult> {
		requirePresenter(input.presenterCode);

		// Ending twice is harmless: a retry keeps the first end time and splits
		// again.
		const endedRows = await getDatabase()
			.update(sessions)
			.set({ endedAt: sql`coalesce(${sessions.endedAt}, now())`, status: "ended" })
			.where(eq(sessions.id, input.sessionId))
			.returning({ id: sessions.id });
		const ended = endedRows.at(0);
		if (ended === undefined) {
			throw new ORPCError("NOT_FOUND", { message: NO_SUCH_SESSION });
		}

		// The transcript is saved either way; a failed split only means no
		// pairs until the next try.
		try {
			return { pairCount: await splitSessionAsync(ended.id, { isLive: false }) };
		} catch (error) {
			console.error(`Couldn't split session ${ended.id} into pairs:`, error);
			return { pairCount: 0 };
		}
	});

interface DeleteResult {
	readonly deleted: boolean;
}

export const deleteSession = os
	.input(
		type({
			"presenterCode?": isPresenterCodeInput,
			sessionId: isSessionId,
		}).readonly(),
	)
	.handler(async function deleteSessionHandler({ input }): Promise<DeleteResult> {
		requirePresenter(input.presenterCode);

		// Segments and pairs go with the session row.
		const deleted = await getDatabase()
			.delete(sessions)
			.where(eq(sessions.id, input.sessionId))
			.returning({ id: sessions.id });

		try {
			await deleteSessionDocumentsAsync(input.sessionId);
		} catch (error) {
			console.error(`Couldn't remove session ${input.sessionId} from the search index:`, error);
		}

		return { deleted: deleted.length > 0 };
	});
