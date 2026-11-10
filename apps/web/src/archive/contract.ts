/**
 * The shapes the server sends to the browser, to MCP clients, and to the seed
 * script. The oRPC procedures return exactly these, so the UI and the server
 * can be written against one file.
 */

export type SessionStatus = "ended" | "live";

/** One talk, as shown in lists. */
export interface SessionSummary {
	readonly id: number;
	readonly endedAt: string | undefined;
	readonly pairCount: number;
	readonly recordingUrl: string | undefined;
	readonly speaker: string;
	readonly startedAt: string;
	readonly status: SessionStatus;
	readonly title: string;
}

/**
 * One finished sentence of transcript. Times are milliseconds into the
 * session.
 */
export interface TranscriptSegment {
	readonly endMs: number;
	readonly sequence: number;
	readonly startMs: number;
	readonly text: string;
}

/** One question and its answer. Times are milliseconds into the session. */
export interface QuestionPair {
	readonly answer: string;
	readonly endMs: number;
	readonly ordinal: number;
	readonly question: string;
	readonly startMs: number;
}

/** A session with everything said in it. */
export interface SessionDetail extends SessionSummary {
	readonly pairs: ReadonlyArray<QuestionPair>;
	readonly qaStartMs: number | undefined;
	readonly segments: ReadonlyArray<TranscriptSegment>;
}

/** The numbers in the home page's readouts. */
export interface ArchiveStats {
	readonly liveCount: number;
	readonly pairCount: number;
	readonly sessionCount: number;
}

/** A question-and-answer pair found by a search. */
export interface PairHit {
	readonly answer: string;
	readonly question: string;
	readonly score: number;
	readonly sessionId: number;
	readonly sessionTitle: string;
	readonly speaker: string;
	readonly startMs: number;
}

/** A passage of a talk found by a search. */
export interface PassageHit {
	readonly score: number;
	readonly sessionId: number;
	readonly sessionTitle: string;
	readonly speaker: string;
	readonly startMs: number;
	readonly text: string;
}

/** Search results: answered questions first, then passages from the talks. */
export interface ArchiveSearchResults {
	/**
	 * The closest answered questions when none matched closely, so a search
	 * never comes back empty just because a score fell under the line. Empty
	 * whenever `pairs` has anything.
	 */
	readonly nearestPairs: ReadonlyArray<PairHit>;
	readonly pairs: ReadonlyArray<PairHit>;
	readonly passages: ReadonlyArray<PassageHit>;
}

/** A session the agent drew on for its answer. */
export interface AnswerSource {
	readonly sessionId: number;
	readonly sessionTitle: string;
	readonly startMs: number;
}

/** The agent's answer to a question about the archive. */
export interface ArchiveAnswer {
	readonly answer: string;
	readonly sources: ReadonlyArray<AnswerSource>;
}

/**
 * The newest "what people are asking" note, written by the Elastic workflow.
 */
export interface ThemesDigest {
	readonly createdAt: string;
	readonly note: string;
}

/**
 * A question people typed into the archive, shown to presenters. Rows that
 * differ only in case or surrounding spaces count as one question.
 */
export interface AskedQuestion {
	/** True when the archive had an answered question for it at least once. */
	readonly isAnswered: boolean;
	readonly lastAskedAt: string;
	/** The most recent spelling. */
	readonly text: string;
	readonly timesAsked: number;
}

/** A segment as the phone sends it. */
export interface NewSegment {
	readonly endMs: number;
	readonly sequence: number;
	readonly startMs: number;
	readonly text: string;
}
