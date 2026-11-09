import { describe, expect, it } from "vite-plus/test";

import { decodeTokens } from "./decode-tokens";

/** A tiny stand-in vocabulary: specials, a few pieces, and two bytes. */
const VOCABULARY = ["", "", "", "▁The", "▁rain", "bow", "<0xC3>", "<0xA9>", "▁caf", "!"];

describe("decodeTokens", () => {
	// Catches words running together or a stray space at the start: word
	// markers are spaces, and only the leading one is dropped.
	it("joins pieces at word markers without a leading space", () => {
		expect.assertions(1);

		expect(decodeTokens(VOCABULARY, [3, 4, 5, 9])).toBe("The rainbow!");
	});

	// Catches accented letters coming out as "<0xC3><0xA9>" or as two broken
	// characters: consecutive byte pieces decode together as UTF-8.
	it("decodes byte pieces together as UTF-8", () => {
		expect.assertions(1);

		expect(decodeTokens(VOCABULARY, [8, 6, 7])).toBe("café");
	});

	// Catches start, end, or unknown tokens showing up in a transcript.
	it("skips special tokens and ids past the vocabulary", () => {
		expect.assertions(1);

		expect(decodeTokens(VOCABULARY, [1, 3, 2, 40_000])).toBe("The");
	});
});
