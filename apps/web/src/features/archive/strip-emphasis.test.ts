import { describe, expect, it } from "vite-plus/test";

import { stripEmphasis } from "./strip-emphasis";

describe("strip emphasis", () => {
	// Catches bold and italic stars showing up in the answer.
	it("keeps the words and drops the stars", () => {
		expect.assertions(2);

		expect(stripEmphasis("She said **yes** at *10:13*.")).toBe("She said yes at 10:13.");
		expect(stripEmphasis("Plain text stays the same.")).toBe("Plain text stays the same.");
	});
});
