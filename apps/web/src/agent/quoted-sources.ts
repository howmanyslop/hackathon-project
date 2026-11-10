import type { AnswerSource } from "$archive/contract";

const MAX_SOURCES = 5;

/** A time the way the agent's tools write it: "10:13", or "75:02". */
const TIME_IN_TEXT = /(?<![\d:])\d+:\d{2}(?![\d:])/gu;

/** The suffix the sample talks carry, which the agent often leaves out. */
const SAMPLE_SUFFIX = " (sample)";

/**
 * Writes a time the same way the agent's ES|QL tools do: whole minutes,
 * never padded, then two-digit seconds. Past an hour it stays in minutes.
 *
 * @param milliseconds - Time since the session started.
 * @returns The time, such as `10:13` or `75:02`.
 */
function formatToolTime(milliseconds: number): string {
	const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
	const seconds = String(totalSeconds % 60).padStart(2, "0");
	return `${Math.floor(totalSeconds / 60)}:${seconds}`;
}

/**
 * Finds where each time first appears in a text. A time only counts as a
 * whole, so "1:05" is not found inside "11:05".
 *
 * @param text - The text to read.
 * @returns Each time, with the position it first appears at.
 */
function findTimePositions(text: string): ReadonlyMap<string, number> {
	const positions = new Map<string, number>();
	for (const match of text.matchAll(TIME_IN_TEXT)) {
		if (!positions.has(match[0])) {
			positions.set(match[0], match.index);
		}
	}

	return positions;
}

/**
 * Checks whether a text names a session, with or without " (sample)".
 *
 * @param text - The text to read.
 * @param title - The session's title.
 * @returns Whether the title appears.
 */
function mentionsTitle(text: string, title: string): boolean {
	const shortTitle = title.endsWith(SAMPLE_SUFFIX) ? title.slice(0, -SAMPLE_SUFFIX.length) : title;
	return shortTitle.length > 0 && text.includes(shortTitle);
}

/**
 * Picks the rows an answer actually quotes. A row counts when the answer
 * has both its time and its session's title. Rows the agent looked at but
 * never mentioned are left out.
 *
 * @param answer - The agent's answer.
 * @param rows - Every row the agent's tools returned.
 * @returns At most five sources, in the order the answer quotes them.
 */
export function selectQuotedSources(answer: string, rows: ReadonlyArray<AnswerSource>): ReadonlyArray<AnswerSource> {
	const timePositions = findTimePositions(answer);

	const quoted = rows.flatMap((row) => {
		const position = timePositions.get(formatToolTime(row.startMs));
		return position !== undefined && mentionsTitle(answer, row.sessionTitle) ? [{ position, row }] : [];
	});
	const sorted = quoted.toSorted((left, right) => left.position - right.position);

	const distinct = new Map<string, AnswerSource>();
	for (const { row } of sorted) {
		if (distinct.size === MAX_SOURCES) break;

		const key = `${row.sessionId}:${row.startMs}`;
		if (!distinct.has(key)) {
			distinct.set(key, row);
		}
	}

	return [...distinct.values()];
}
