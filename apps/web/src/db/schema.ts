import { integer, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";

/** One talk. `live` while the presenter is recording, then `ended`. */
export const sessions = pgTable("sessions", {
	id: integer().primaryKey().generatedAlwaysAsIdentity(),
	endedAt: timestamp("ended_at", { withTimezone: true }),
	// Milliseconds into the session when the presenter tapped "Start Q&A".
	qaStartMs: integer("qa_start_ms"),
	// Where the video lives, if the presenter has one. Results link into it.
	recordingUrl: text("recording_url"),
	speaker: text().notNull(),
	// When the Q&A was last split into pairs, to space out live re-splits.
	splitAt: timestamp("split_at", { withTimezone: true }),
	startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
	status: text({ enum: ["live", "ended"] })
		.notNull()
		.default("live"),
	title: text().notNull(),
});

/** One finished sentence of transcript, timed from the session's start. */
export const segments = pgTable(
	"segments",
	{
		id: integer().primaryKey().generatedAlwaysAsIdentity(),
		endMs: integer("end_ms").notNull(),
		// Counted by the phone, so a batch sent twice is stored once.
		sequence: integer().notNull(),
		sessionId: integer("session_id")
			.notNull()
			.references(() => sessions.id, { onDelete: "cascade" }),
		startMs: integer("start_ms").notNull(),
		text: text().notNull(),
	},
	(table) => [unique("segments_session_sequence").on(table.sessionId, table.sequence)],
);

/** One question and its answer, anchored to a time in the session. */
export const pairs = pgTable(
	"pairs",
	{
		id: integer().primaryKey().generatedAlwaysAsIdentity(),
		answer: text().notNull(),
		endMs: integer("end_ms").notNull(),
		// Position within the session's Q&A, starting at 0.
		ordinal: integer().notNull(),
		question: text().notNull(),
		sessionId: integer("session_id")
			.notNull()
			.references(() => sessions.id, { onDelete: "cascade" }),
		startMs: integer("start_ms").notNull(),
	},
	(table) => [unique("pairs_session_ordinal").on(table.sessionId, table.ordinal)],
);

/**
 * One question sent to the paid Elastic agent from the Ask box, so the app
 * can cap how many it sends a minute and how much they cost in total.
 */
export const askLog = pgTable("ask_log", {
	id: integer().primaryKey().generatedAlwaysAsIdentity(),
	// Millionths of a US dollar: the agent's reported token usage priced
	// high, or a fixed estimate when it reports none.
	costMicros: integer("cost_micros").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * One question typed into the archive's search field or its Ask box, with no
 * name attached, so presenters can see what people want to know.
 */
export const questionLog = pgTable("question_log", {
	id: integer().primaryKey().generatedAlwaysAsIdentity(),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	// For a search, how many answered questions came back; for an ask, how
	// many sources the answer had.
	matchCount: integer("match_count").notNull(),
	source: text({ enum: ["search", "ask"] }).notNull(),
	// Trimmed, and at most 300 characters.
	text: text().notNull(),
});
