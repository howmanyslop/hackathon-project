import type { NewSegment } from "$archive/contract";

import type { SegmentQueue } from "./segment-queue";

/** Sends one batch to the server; resolves once the server has it. */
export type SendBatchAsync = (batch: ReadonlyArray<NewSegment>) => Promise<void>;

/** Sends the queue's segments one batch at a time. */
export interface SegmentSender {
	/** Sends batches until the queue is empty or the attempts run out. */
	readonly drainAsync: (attempts: number) => Promise<void>;
	/** Sends the oldest batch, unless a send is already under way. */
	readonly flushAsync: () => Promise<void>;
}

function ignoreFailure(): void {
	// The batch stays queued, so the next attempt sends it again.
}

/**
 * Creates a sender for a queue. Only one batch is in flight at a time, and a
 * batch leaves the queue only after the server has it.
 *
 * @param queue - The segments waiting to be sent.
 * @param sendBatchAsync - Sends one batch.
 * @returns Functions that send one batch, or keep sending until empty.
 */
export function createSegmentSender(queue: SegmentQueue, sendBatchAsync: SendBatchAsync): SegmentSender {
	let inFlight: Promise<void> | undefined;

	async function sendOldestAsync(): Promise<void> {
		const batch = queue.peekBatch();
		if (batch.length === 0) return;

		await sendBatchAsync(batch);
		queue.acknowledge(batch);
	}

	function clearInFlight(): void {
		inFlight = undefined;
	}

	async function flushAsync(): Promise<void> {
		inFlight ??= sendOldestAsync().finally(clearInFlight);
		return inFlight;
	}

	async function drainAsync(attempts: number): Promise<void> {
		if (attempts <= 0 || queue.size() === 0) return;

		await flushAsync().catch(ignoreFailure);
		await drainAsync(attempts - 1);
	}

	return { drainAsync, flushAsync };
}
