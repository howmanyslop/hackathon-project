import { describe, it } from "vite-plus/test";

import { toPlural } from "./to-plural";

describe("toPlural", () => {
	it("keeps the singular form for exactly one", ({ expect }) => {
		expect.assertions(3);

		expect(toPlural(1, "apple")).toBe("apple");
		expect(toPlural(1, "box")).toBe("box");
		expect(toPlural(1, "city")).toBe("city");
	});

	// Catches "0 apple", which English writes as "0 apples".
	it("uses the plural form for zero", ({ expect }) => {
		expect.assertions(1);

		expect(toPlural(0, "apple")).toBe("apples");
	});

	it("uses the plural form for more than one", ({ expect }) => {
		expect.assertions(2);

		expect(toPlural(2, "apple")).toBe("apples");
		expect(toPlural(2, "cat")).toBe("cats");
	});

	// Catches "boxs" and "buss", which are not pronounceable plurals.
	it("adds -es after s, x, and z", ({ expect }) => {
		expect.assertions(3);

		expect(toPlural(2, "bus")).toBe("buses");
		expect(toPlural(2, "box")).toBe("boxes");
		expect(toPlural(2, "buzz")).toBe("buzzes");
	});

	it("adds -es after ch and sh", ({ expect }) => {
		expect.assertions(2);

		expect(toPlural(2, "church")).toBe("churches");
		expect(toPlural(2, "dish")).toBe("dishes");
	});

	// Catches "monthes" from treating every word ending in h as ch/sh.
	it("adds -s after other words ending in h", ({ expect }) => {
		expect.assertions(1);

		expect(toPlural(2, "month")).toBe("months");
	});

	it("replaces y with -ies after a consonant", ({ expect }) => {
		expect.assertions(2);

		expect(toPlural(2, "city")).toBe("cities");
		expect(toPlural(2, "baby")).toBe("babies");
	});

	// Catches "daies" and "boies".
	it("keeps y and adds -s after a vowel", ({ expect }) => {
		expect.assertions(2);

		expect(toPlural(2, "day")).toBe("days");
		expect(toPlural(2, "boy")).toBe("boys");
	});
});
