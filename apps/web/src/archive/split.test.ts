import { type } from "arktype";
import { describe, expect, it } from "vite-plus/test";

import { buildSplitPrompt, isSplitAnswer, readSplitAnswer, selectQaSegments } from "./split";

import type { TranscriptSegment } from "./contract";

const TALK: ReadonlyArray<TranscriptSegment> = [
	{ endMs: 4000, sequence: 0, startMs: 0, text: "Thanks for coming." },
	{ endMs: 125_000, sequence: 1, startMs: 120_000, text: "So, any questions?" },
	{ endMs: 131_000, sequence: 2, startMs: 126_000, text: "Um, does it, does it work offline?" },
	{ endMs: 140_000, sequence: 3, startMs: 132_000, text: "Yes, the phone does the speech recognition." },
	{ endMs: 146_000, sequence: 4, startMs: 141_000, text: "What about other languages?" },
	{ endMs: 152_000, sequence: 5, startMs: 147_000, text: "English only for now." },
];

// "2" and "2:06" as whole tokens, so "2" is not found inside "2:06".
const LINE_NUMBER_TWO = /(?<![\d:])2(?![\d:])/u;
const TIME_TWO_OH_SIX = /(?<![\d:])2:06(?![\d:])/u;

const OFFLINE = {
	answer: "Yes, the phone does the speech recognition.",
	firstSequence: 2,
	lastSequence: 3,
	question: "Does it work offline?",
};

const LANGUAGES = {
	answer: "English only for now.",
	firstSequence: 4,
	lastSequence: 5,
	question: "What about other languages?",
};

describe("reading the model's pairs", () => {
	// Catches a search result jumping to the wrong moment of the talk.
	it("anchors a pair from its question's first line to its answer's last line", () => {
		expect.assertions(2);

		const { pairs } = readSplitAnswer({ pairs: [OFFLINE], qaStartSequence: null }, TALK);

		expect(pairs[0]?.startMs).toBe(126_000);
		expect(pairs[0]?.endMs).toBe(140_000);
	});

	// Catches a made-up line number being stored as a pair with no place in
	// the talk.
	it("drops pairs that point at lines the model was not sent", () => {
		expect.assertions(1);

		const answer = { pairs: [{ ...OFFLINE, lastSequence: 99 }, LANGUAGES], qaStartSequence: null };

		expect(readSplitAnswer(answer, TALK).pairs.map((pair) => pair.question)).toStrictEqual([
			"What about other languages?",
		]);
	});

	// Catches a blank question or answer showing up in the archive.
	it("drops pairs with an empty question or answer", () => {
		expect.assertions(1);

		const answer = {
			pairs: [
				{ ...OFFLINE, question: " ".repeat(3) },
				{ ...LANGUAGES, answer: "" },
			],
			qaStartSequence: null,
		};

		expect(readSplitAnswer(answer, TALK).pairs).toHaveLength(0);
	});

	// Catches pairs listed out of the order they were asked in.
	it("puts pairs in time order and numbers them from 0", () => {
		expect.assertions(2);

		const { pairs } = readSplitAnswer({ pairs: [LANGUAGES, OFFLINE], qaStartSequence: null }, TALK);

		expect(pairs.map((pair) => pair.question)).toStrictEqual([
			"Does it work offline?",
			"What about other languages?",
		]);
		expect(pairs.map((pair) => pair.ordinal)).toStrictEqual([0, 1]);
	});

	// Catches a malformed model reply being stored instead of rejected.
	it("rejects an answer of the wrong shape", () => {
		expect.assertions(3);

		expect(isSplitAnswer({ pairs: "none" })).toBeInstanceOf(type.errors);
		expect(isSplitAnswer({ pairs: [{ question: "Why?" }], qaStartSequence: null })).toBeInstanceOf(type.errors);
		expect(isSplitAnswer({ pairs: [OFFLINE], qaStartSequence: null })).not.toBeInstanceOf(type.errors);
	});

	// Catches the Q&A start the model found being lost or misplaced.
	it("reports where the model says the Q&A began", () => {
		expect.assertions(2);

		expect(readSplitAnswer({ pairs: [], qaStartSequence: 1 }, TALK).qaStartMs).toBe(120_000);
		expect(readSplitAnswer({ pairs: [], qaStartSequence: null }, TALK).qaStartMs).toBeUndefined();
	});
});

describe("choosing what the model reads", () => {
	// Catches the talk itself being sent after the presenter marked the Q&A,
	// or the sentence spoken during the tap being cut off.
	it("sends only what was said from the Q&A mark on", () => {
		expect.assertions(1);

		expect(selectQaSegments(TALK, 128_000).map((segment) => segment.sequence)).toStrictEqual([2, 3, 4, 5]);
	});

	// Catches an unmarked talk being sent without the part before the Q&A, so
	// the model could not find where it starts.
	it("sends the whole talk when there is no Q&A mark", () => {
		expect.assertions(1);

		expect(selectQaSegments(TALK, undefined)).toHaveLength(6);
	});

	// Catches the model being shown line numbers or times that do not match
	// the talk, such as lines counted from 0 after the Q&A mark, so the pairs
	// it returns land on the wrong lines.
	it("labels each line with its own number and time in the talk", () => {
		expect.assertions(2);

		const { user } = buildSplitPrompt(selectQaSegments(TALK, 128_000), true);
		const offlineLine = user.split("\n").find((line) => line.includes("work offline?"));

		expect(offlineLine).toMatch(LINE_NUMBER_TWO);
		expect(offlineLine).toMatch(TIME_TWO_OH_SIX);
	});
});
