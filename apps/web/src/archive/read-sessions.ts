/**
 * Reads sessions from Postgres in the shapes of `contract.ts`. The oRPC
 * procedures and the MCP tools both call these, so the two always agree.
 */

import { asc, count, desc, eq, sql } from "drizzle-orm";

import { getDatabase } from "$db/index";
import { pairs, segments, sessions } from "$db/schema";

import type { ArchiveStats, SessionDetail, SessionSummary } from "./contract.ts";

interface SessionRow {
	readonly id: number;
	readonly endedAt: Date | null;
	readonly pairCount: number;
	readonly recordingUrl: null | string;
	readonly speaker: string;
	readonly startedAt: Date;
	readonly status: "ended" | "live";
	readonly title: string;
}

const SUMMARY_COLUMNS = {
	id: sessions.id,
	endedAt: sessions.endedAt,
	// Table names are spelled out: Drizzle writes a lone `id` here, which the
	// subquery would read as the pair's own id, not the session's.
	pairCount: sql<number>`(select count(*) from pairs where pairs.session_id = sessions.id)`.mapWith(Number),
	recordingUrl: sessions.recordingUrl,
	speaker: sessions.speaker,
	startedAt: sessions.startedAt,
	status: sessions.status,
	title: sessions.title,
};

function toSummary(row: SessionRow): SessionSummary {
	return {
		id: row.id,
		endedAt: row.endedAt?.toISOString(),
		pairCount: row.pairCount,
		recordingUrl: row.recordingUrl ?? undefined,
		speaker: row.speaker,
		startedAt: row.startedAt.toISOString(),
		status: row.status,
		title: row.title,
	};
}

/**
 * Counts what the home page's readouts show.
 *
 * @returns Sessions in the archive, sessions recording now, and pairs.
 */
export async function readArchiveStatsAsync(): Promise<ArchiveStats> {
	const database = getDatabase();
	const [sessionCounts, pairCount] = await Promise.all([
		database
			.select({
				liveCount: sql<number>`count(*) filter (where ${sessions.status} = 'live')`.mapWith(Number),
				sessionCount: count(),
			})
			.from(sessions),
		database.$count(pairs),
	]);

	// An aggregate without `group by` always yields exactly one row.
	const [counts] = sessionCounts;
	return { liveCount: counts.liveCount, pairCount, sessionCount: counts.sessionCount };
}

/**
 * Lists every session, newest first.
 *
 * @returns The sessions with their pair counts.
 */
export async function listSessionsAsync(): Promise<ReadonlyArray<SessionSummary>> {
	const rows = await getDatabase()
		.select(SUMMARY_COLUMNS)
		.from(sessions)
		.orderBy(desc(sessions.startedAt), desc(sessions.id));

	return rows.map(toSummary);
}

/**
 * Reads one session with its transcript and pairs.
 *
 * @param id - Which session to read.
 * @returns The session, or `undefined` when there is none with that id.
 */
export async function readSessionAsync(id: number): Promise<SessionDetail | undefined> {
	const database = getDatabase();
	const [sessionRows, segmentRows, pairRows] = await Promise.all([
		database
			.select({ ...SUMMARY_COLUMNS, qaStartMs: sessions.qaStartMs })
			.from(sessions)
			.where(eq(sessions.id, id)),
		database
			.select({
				endMs: segments.endMs,
				sequence: segments.sequence,
				startMs: segments.startMs,
				text: segments.text,
			})
			.from(segments)
			.where(eq(segments.sessionId, id))
			.orderBy(asc(segments.sequence)),
		database
			.select({
				answer: pairs.answer,
				endMs: pairs.endMs,
				ordinal: pairs.ordinal,
				question: pairs.question,
				startMs: pairs.startMs,
			})
			.from(pairs)
			.where(eq(pairs.sessionId, id))
			.orderBy(asc(pairs.ordinal)),
	]);

	const row = sessionRows.at(0);
	if (row === undefined) return undefined;

	return {
		...toSummary(row),
		pairs: pairRows,
		qaStartMs: row.qaStartMs ?? undefined,
		segments: segmentRows,
	};
}
