const EMPHASIS_MARKERS = /\*+/gu;

/**
 * Drops Markdown's emphasis stars from an answer, keeping the words. The
 * answer is shown as plain text, so "**10:13**" reads as "10:13".
 *
 * @param text - The answer as the assistant wrote it.
 * @returns The same text without any "*" or "**".
 */
export function stripEmphasis(text: string): string {
	return text.replaceAll(EMPHASIS_MARKERS, "");
}
