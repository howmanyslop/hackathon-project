import { describe, expect, it } from "vite-plus/test";

import { createSegmentQueue, MAXIMUM_BATCH_SIZE, splitLongDraft } from "./segment-queue";

import type { SegmentQueue } from "./segment-queue";

function fill(queue: SegmentQueue, count: number): void {
	for (let index = 0; index < count; index += 1) {
		queue.add({ endMs: index * 1000 + 900, startMs: index * 1000, text: `sentence ${index}` });
	}
}

function getSequencesOf(queue: SegmentQueue): ReadonlyArray<number> {
	return queue.peekBatch().map((segment) => segment.sequence);
}

describe("segment queue", () => {
	// Catches repeated or skipped sequence numbers, which would make the
	// server drop or reorder sentences.
	it("numbers segments 0, 1, 2 in the order they were added", () => {
		expect.assertions(1);

		const queue = createSegmentQueue();
		fill(queue, 3);

		expect(getSequencesOf(queue)).toStrictEqual([0, 1, 2]);
	});

	// Catches a batch larger than the server accepts.
	it("hands out at most fifty segments at a time", () => {
		expect.assertions(2);

		const queue = createSegmentQueue();
		fill(queue, 120);

		expect(queue.peekBatch()).toHaveLength(MAXIMUM_BATCH_SIZE);
		expect(queue.peekBatch()[0]?.sequence).toBe(0);
	});

	// Catches a failed send losing its sentences.
	it("hands out the same batch again until it is acknowledged", () => {
		expect.assertions(1);

		const queue = createSegmentQueue();
		fill(queue, 3);
		const first = getSequencesOf(queue);

		expect(getSequencesOf(queue)).toStrictEqual(first);
	});

	// Catches an acknowledged sentence being sent twice, or a sentence added
	// during a send being dropped with the batch.
	it("removes only what was acknowledged", () => {
		expect.assertions(2);

		const queue = createSegmentQueue();
		fill(queue, 2);
		const batch = queue.peekBatch();
		fill(queue, 1);
		queue.acknowledge(batch);

		expect(getSequencesOf(queue)).toStrictEqual([2]);
		expect(queue.size()).toBe(1);
	});

	// Catches sequence numbers restarting after the queue empties.
	it("keeps counting after everything is acknowledged", () => {
		expect.assertions(1);

		const queue = createSegmentQueue();
		fill(queue, 2);
		queue.acknowledge(queue.peekBatch());
		fill(queue, 1);

		expect(getSequencesOf(queue)).toStrictEqual([2]);
	});
});

describe("splitLongDraft", () => {
	it("keeps a normal sentence whole", () => {
		expect.assertions(1);

		const draft = { endMs: 900, startMs: 0, text: "A normal sentence." };

		expect(splitLongDraft(draft)).toStrictEqual([draft]);
	});

	it("cuts a long result at spaces into pieces the server accepts", () => {
		expect.assertions(3);

		const text = "word ".repeat(1000).trim();
		const pieces = splitLongDraft({ endMs: 60_000, startMs: 0, text });

		expect(pieces.length).toBeGreaterThan(1);
		expect(pieces.every((piece) => piece.text.length <= 2000)).toBe(true);
		expect(pieces.map((piece) => piece.text).join(" ")).toBe(text);
	});
});
