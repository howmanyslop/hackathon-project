/**
 * The log of questions people type into the archive, so presenters can see
 * what people want to know. Nothing about who asked is stored.
 */

import { desc, sql } from "drizzle-orm";

import { getDatabase } from "$db/index";
import { questionLog } from "$db/schema";

import type { AskedQuestion } from "./contract";

const MINIMUM_LENGTH = 3;
const MAXIMUM_LENGTH = 300;
const LISTED_QUESTIONS = 100;

// Splits text into characters as people see them, so an emoji built from
// several code points counts as one.
const CHARACTER_SEGMENTER = new Intl.Segmenter("en", { granularity: "grapheme" });

/** One question to log. */
export interface QuestionEntry {
	/** For a search, the answered questions found; for an ask, the sources. */
	readonly matchCount: number;
	/** Where it was typed: the search field or the Ask box. */
	readonly source: "ask" | "search";
	readonly text: string;
}

/**
 * Tidies a question for the log: the spaces around it go, and anything past
 * 300 characters is cut. Characters are counted as people see them, so an
 * emoji is never split in half.
 *
 * @param text - What the person typed.
 * @returns The text to store, or `undefined` when it is shorter than three
 *   characters.
 */
export function prepareQuestionText(text: string): string | undefined {
	const characters = Array.from(CHARACTER_SEGMENTER.segment(text.trim()), (part) => part.segment);
	if (characters.length < MINIMUM_LENGTH) return undefined;

	return characters.slice(0, MAXIMUM_LENGTH).join("").trimEnd();
}

/**
 * Logs one question. It never throws: a lost log row must not fail the
 * search or the answer it came with.
 *
 * @param entry - The question, where it was typed, and what it found.
 */
export async function recordQuestionAsync(entry: QuestionEntry): Promise<void> {
	const text = prepareQuestionText(entry.text);
	if (text === undefined) return;

	try {
		await getDatabase().insert(questionLog).values({ matchCount: entry.matchCount, source: entry.source, text });
	} catch (error) {
		console.error("Couldn't log a question:", error);
	}
}

/**
 * Reads the newest 100 different questions. Rows that differ only in case or
 * surrounding spaces count as one question, shown in its newest spelling.
 *
 * @returns The questions, the most recently asked first.
 */
export async function listAskedQuestionsAsync(): Promise<ReadonlyArray<AskedQuestion>> {
	// The driver hands timestamps over as text; the column turns them into
	// dates.
	const lastAskedAt = sql<Date>`max(${questionLog.createdAt})`.mapWith(questionLog.createdAt);

	const rows = await getDatabase()
		.select({
			isAnswered: sql<boolean>`bool_or(${questionLog.matchCount} > 0)`,
			lastAskedAt,
			text: sql<string>`(array_agg(${questionLog.text} order by ${questionLog.createdAt} desc))[1]`,
			timesAsked: sql<number>`count(*)`.mapWith(Number),
		})
		.from(questionLog)
		.groupBy(sql`lower(btrim(${questionLog.text}))`)
		.orderBy(desc(lastAskedAt))
		.limit(LISTED_QUESTIONS);

	return rows.map((row): AskedQuestion => ({
		isAnswered: row.isAnswered,
		lastAskedAt: row.lastAskedAt.toISOString(),
		text: row.text,
		timesAsked: row.timesAsked,
	}));
}
