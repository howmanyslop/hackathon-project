import { describe, it } from "vite-plus/test";

import { formatArrayAsEnglishList } from "./format-array-as-english-list";

describe("formatArrayAsEnglishList", () => {
	it("joins three or more items with commas and a serial and", ({ expect }) => {
		expect.assertions(2);

		expect(formatArrayAsEnglishList(["red", "green", "blue"])).toBe("red, green, and blue");
		expect(formatArrayAsEnglishList(["a", "b", "c", "d"])).toBe("a, b, c, and d");
	});

	it("uses the given logical operator", ({ expect }) => {
		expect.assertions(1);

		expect(formatArrayAsEnglishList(["red", "green", "blue"], "or")).toBe("red, green, or blue");
	});

	// Catches "red, and green", which has a stray leading comma.
	it("joins two items without a comma", ({ expect }) => {
		expect.assertions(2);

		expect(formatArrayAsEnglishList(["red", "green"])).toBe("red and green");
		expect(formatArrayAsEnglishList(["red", "green"], "or")).toBe("red or green");
	});

	// Catches ", and red".
	it("returns a single item unchanged", ({ expect }) => {
		expect.assertions(1);

		expect(formatArrayAsEnglishList(["red"])).toBe("red");
	});

	// Catches ", and undefined" leaking into user-facing text.
	it("returns an empty string for no items", ({ expect }) => {
		expect.assertions(1);

		expect(formatArrayAsEnglishList([])).toBe("");
	});
});
