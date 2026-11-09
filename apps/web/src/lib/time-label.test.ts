import { describe, expect, it } from "vite-plus/test";

import { formatTimeLabel } from "./time-label";

describe("time label", () => {
	// Catches seconds printed without their leading zero.
	it("writes minutes and two-digit seconds", () => {
		expect.assertions(3);

		expect(formatTimeLabel(0)).toBe("0:00");
		expect(formatTimeLabel(5000)).toBe("0:05");
		expect(formatTimeLabel(2_472_000)).toBe("41:12");
	});

	// Catches a long talk shown as "62:05" instead of with an hour.
	it("adds hours past the first hour", () => {
		expect.assertions(2);

		expect(formatTimeLabel(3_600_000)).toBe("1:00:00");
		expect(formatTimeLabel(3_725_000)).toBe("1:02:05");
	});

	// Catches a time rounded up to a second that has not happened yet.
	it("drops fractions of a second", () => {
		expect.assertions(1);

		expect(formatTimeLabel(59_999)).toBe("0:59");
	});

	// Catches clock skew on the phone printing "-1:-5".
	it("reads negative and missing times as the start", () => {
		expect.assertions(2);

		expect(formatTimeLabel(-1500)).toBe("0:00");
		expect(formatTimeLabel(Number.NaN)).toBe("0:00");
	});
});
