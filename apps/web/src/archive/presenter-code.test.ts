import { describe, expect, it } from "vite-plus/test";

import { matchesPresenterCode } from "./presenter-code";

describe("presenter code", () => {
	// Catches a server with no code configured letting anyone record.
	it("refuses everyone when no code is configured", () => {
		expect.assertions(4);

		expect(matchesPresenterCode("lanyard", undefined)).toBe(false);
		expect(matchesPresenterCode("", undefined)).toBe(false);
		expect(matchesPresenterCode("", "")).toBe(false);
		expect(matchesPresenterCode(undefined, "")).toBe(false);
	});

	// Catches the real presenter being locked out.
	it("accepts the configured code", () => {
		expect.assertions(1);

		expect(matchesPresenterCode("blue-lanyard-42", "blue-lanyard-42")).toBe(true);
	});

	// Catches a near miss, a prefix, or a missing code being let in.
	it("refuses any other code", () => {
		expect.assertions(5);

		expect(matchesPresenterCode("blue-lanyard-41", "blue-lanyard-42")).toBe(false);
		expect(matchesPresenterCode("blue-lanyard", "blue-lanyard-42")).toBe(false);
		expect(matchesPresenterCode("Blue-Lanyard-42", "blue-lanyard-42")).toBe(false);
		expect(matchesPresenterCode("", "blue-lanyard-42")).toBe(false);
		expect(matchesPresenterCode(undefined, "blue-lanyard-42")).toBe(false);
	});
});
