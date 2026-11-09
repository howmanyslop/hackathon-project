import { describe, expect, it } from "vite-plus/test";

import { calculateUsageCost, judgeAsk, readDollarsAsMicros } from "./ask-budget";

const TWENTY_DOLLARS = 20_000_000;

describe("ask box budget", () => {
	// Catches the Ask box sending paid questions after the $20 is used up.
	it("stops once the budget is reached, not after", () => {
		expect.assertions(3);

		expect(judgeAsk(0, 19_999_999, TWENTY_DOLLARS)).toBe("allowed");
		expect(judgeAsk(0, 20_000_000, TWENTY_DOLLARS)).toBe("spent");
		expect(judgeAsk(0, 20_100_000, TWENTY_DOLLARS)).toBe("spent");
	});

	// Catches a burst of questions all reaching the paid agent in one minute.
	it("allows nine questions a minute and refuses the tenth", () => {
		expect.assertions(2);

		expect(judgeAsk(9, 0, TWENTY_DOLLARS)).toBe("allowed");
		expect(judgeAsk(10, 0, TWENTY_DOLLARS)).toBe("busy");
	});

	// Catches a missing or mistyped setting switching the cap off.
	it("falls back to the default for a setting it cannot read", () => {
		expect.assertions(4);

		expect(readDollarsAsMicros(undefined, 20)).toBe(TWENTY_DOLLARS);
		expect(readDollarsAsMicros("twenty", 20)).toBe(TWENTY_DOLLARS);
		expect(readDollarsAsMicros("-5", 20)).toBe(TWENTY_DOLLARS);
		expect(readDollarsAsMicros("", 20)).toBe(TWENTY_DOLLARS);
	});

	// Catches a configured budget or estimate being ignored or misread.
	it("reads a configured amount in dollars", () => {
		expect.assertions(3);

		expect(readDollarsAsMicros("5", 20)).toBe(5_000_000);
		expect(readDollarsAsMicros("0.10", 20)).toBe(100_000);
		expect(readDollarsAsMicros("0", 20)).toBe(0);
	});

	// Catches token usage priced below the deliberately high rate of $6 per
	// million input tokens and $30 per million output tokens.
	it("prices a million tokens at $6 in and $30 out", () => {
		expect.assertions(2);

		expect(calculateUsageCost({ inputTokens: 1_000_000, outputTokens: 0 })).toBe(6_000_000);
		expect(calculateUsageCost({ inputTokens: 0, outputTokens: 1_000_000 })).toBe(30_000_000);
	});
});
