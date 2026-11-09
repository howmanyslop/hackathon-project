import type { SessionDetail, TranscriptSegment } from "$archive/contract";

/**
 * How long the talk has run, from its last passage or pair.
 *
 * @param session - The talk with its transcript and pairs.
 * @returns Milliseconds from the start to the last words heard.
 */
export function measureSessionLength(session: SessionDetail): number {
	let length = 0;
	for (const segment of session.segments) {
		length = Math.max(length, segment.endMs);
	}

	for (const pair of session.pairs) {
		length = Math.max(length, pair.endMs);
	}

	return length;
}

/**
 * Finds the passage a `?t=` link points at: the last one that started at or
 * before that second, or the first passage when the second is earlier.
 *
 * @param segments - The transcript, in order.
 * @param seconds - The second from the link.
 * @returns The passage's sequence, or undefined when there is none.
 */
export function findMarkedSequence(segments: ReadonlyArray<TranscriptSegment>, seconds?: number): number | undefined {
	if (seconds === undefined) return undefined;

	// Links carry whole seconds, so a passage that began at 10:13.4 has to
	// count as started by second 613.
	const started = segments.filter((segment) => Math.floor(segment.startMs / 1000) <= seconds);
	return (started.at(-1) ?? segments.at(0))?.sequence;
}
