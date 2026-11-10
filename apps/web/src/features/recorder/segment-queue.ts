import type { NewSegment } from "$archive/contract";

/** The largest batch one appendSegments call carries. */
const MAXIMUM_BATCH_SIZE = 50;

/** The longest segment text the server accepts. */
const MAXIMUM_SEGMENT_LENGTH = 2000;

/** A finished sentence before it has a sequence number. */
export interface SegmentDraft {
	readonly endMs: number;
	readonly startMs: number;
	readonly text: string;
}

/**
 * Cuts a very long result (minutes of speech with no pause) into pieces the
 * server accepts, breaking at a space where it can. Every piece keeps the
 * draft's times.
 *
 * @param draft - One finished result from the recognizer.
 * @returns The draft itself, or several drafts of at most 2000 characters.
 */
export function splitLongDraft(draft: SegmentDraft): ReadonlyArray<SegmentDraft> {
	const pieces: Array<SegmentDraft> = [];
	let rest = draft.text;
	while (rest.length > MAXIMUM_SEGMENT_LENGTH) {
		const space = rest.lastIndexOf(" ", MAXIMUM_SEGMENT_LENGTH);
		const cut = space > 0 ? space : MAXIMUM_SEGMENT_LENGTH;
		pieces.push({ ...draft, text: rest.slice(0, cut) });
		rest = rest.slice(cut).trim();
	}

	if (rest.length > 0) {
		pieces.push({ ...draft, text: rest });
	}

	return pieces;
}

/**
 * Holds the transcript until the server has it. Each segment gets the next
 * sequence number when added and stays in the queue until a send that
 * carried it is acknowledged, so a failed send is simply sent again. The
 * server ignores a sequence it already has, which makes a resend harmless.
 */
export interface SegmentQueue {
	/** Removes the segments the server confirmed it has. */
	readonly acknowledge: (batch: ReadonlyArray<NewSegment>) => void;
	/** Adds a finished sentence and returns it with its sequence number. */
	readonly add: (draft: SegmentDraft) => NewSegment;
	/** The oldest unacknowledged segments, at most {@link MAXIMUM_BATCH_SIZE}. */
	readonly peekBatch: () => ReadonlyArray<NewSegment>;
	/** How many segments are still waiting. */
	readonly size: () => number;
}

/**
 * Creates an empty queue whose first sequence number is 0.
 *
 * @returns A queue with nothing in it.
 */
export function createSegmentQueue(): SegmentQueue {
	let pending: ReadonlyArray<NewSegment> = [];
	let nextSequence = 0;

	function add(draft: SegmentDraft): NewSegment {
		const segment: NewSegment = {
			endMs: draft.endMs,
			sequence: nextSequence,
			startMs: draft.startMs,
			text: draft.text,
		};

		nextSequence += 1;

		pending = [...pending, segment];
		return segment;
	}

	function peekBatch(): ReadonlyArray<NewSegment> {
		return pending.slice(0, MAXIMUM_BATCH_SIZE);
	}

	function acknowledge(batch: ReadonlyArray<NewSegment>): void {
		const sent = new Set(batch.map((segment) => segment.sequence));
		pending = pending.filter((segment) => !sent.has(segment.sequence));
	}

	function size(): number {
		return pending.length;
	}

	return { acknowledge, add, peekBatch, size };
}
