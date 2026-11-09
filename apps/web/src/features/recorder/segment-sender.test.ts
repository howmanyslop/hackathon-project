import { describe, expect, it } from "vite-plus/test";

import { createSegmentQueue } from "./segment-queue";
import { createSegmentSender } from "./segment-sender";

import type { NewSegment } from "$archive/contract";

interface FakeServer {
	readonly received: Array<number>;
	readonly sendAsync: (batch: ReadonlyArray<NewSegment>) => Promise<void>;
}

function createServer(failures: number): FakeServer {
	const received: Array<number> = [];
	let failuresLeft = failures;

	async function sendAsync(batch: ReadonlyArray<NewSegment>): Promise<void> {
		await Promise.resolve();
		failuresLeft -= 1;
		if (failuresLeft >= 0) {
			throw new Error("offline");
		}

		for (const segment of batch) {
			received.push(segment.sequence);
		}
	}

	return { received, sendAsync };
}

describe("segment sender", () => {
	// Catches a failed send dropping its sentences instead of retrying them.
	it("delivers every segment once after a failure", async () => {
		expect.assertions(2);

		const queue = createSegmentQueue();
		const server = createServer(1);
		const sender = createSegmentSender(queue, server.sendAsync);
		queue.add({ endMs: 900, startMs: 0, text: "One." });
		queue.add({ endMs: 1900, startMs: 1000, text: "Two." });

		await sender.drainAsync(3);

		expect(server.received).toStrictEqual([0, 1]);
		expect(queue.size()).toBe(0);
	});

	// Catches the timer and the stop button sending the same batch twice.
	it("shares one send between two callers", async () => {
		expect.assertions(1);

		const queue = createSegmentQueue();
		const server = createServer(0);
		const sender = createSegmentSender(queue, server.sendAsync);
		queue.add({ endMs: 900, startMs: 0, text: "One." });

		await Promise.all([sender.flushAsync(), sender.flushAsync()]);

		expect(server.received).toStrictEqual([0]);
	});
});
