import { describe, expect, it } from "vite-plus/test";

import { findMarkedSequence } from "./session-timing";

const SEGMENTS = [
	{ endMs: 4000, sequence: 0, startMs: 1000, text: "Hello." },
	{ endMs: 9000, sequence: 1, startMs: 5000, text: "Today we talk about search." },
	{ endMs: 15_000, sequence: 2, startMs: 10_000, text: "Any questions?" },
];

describe("marked passage", () => {
	// Catches a jump landing on the passage after the one being said.
	it("marks the passage that was being said at that second", () => {
		expect.assertions(2);

		expect(findMarkedSequence(SEGMENTS, 7)).toBe(1);
		expect(findMarkedSequence(SEGMENTS, 10)).toBe(2);
	});

	// Catches a link built from 10:13.4 marking the passage before it: links
	// only carry whole seconds.
	it("marks a passage that began partway through the linked second", () => {
		expect.assertions(1);

		const segments = [
			{ endMs: 612_000, sequence: 48, startMs: 606_465, text: "I see a hand in the front." },
			{ endMs: 627_000, sequence: 49, startMs: 613_412, text: "What happens when a node dies?" },
		];

		expect(findMarkedSequence(segments, 613)).toBe(49);
	});

	// Catches a link past the end, or before the first words, marking nothing.
	it("falls back to the nearest end of the transcript", () => {
		expect.assertions(2);

		expect(findMarkedSequence(SEGMENTS, 0)).toBe(0);
		expect(findMarkedSequence(SEGMENTS, 600)).toBe(2);
	});

	// Catches a page without ?t= scrolling somewhere on its own.
	it("marks nothing without a time or a transcript", () => {
		expect.assertions(2);

		expect(findMarkedSequence(SEGMENTS)).toBeUndefined();
		expect(findMarkedSequence([], 5)).toBeUndefined();
	});
});
