import { describe, it } from "vite-plus/test";

import { getIndefiniteArticle } from "./get-indefinite-article";

describe("getIndefiniteArticle", () => {
	it("uses an before a vowel sound", ({ expect }) => {
		expect.assertions(5);

		expect(getIndefiniteArticle("apple")).toBe("an");
		expect(getIndefiniteArticle("egg")).toBe("an");
		expect(getIndefiniteArticle("igloo")).toBe("an");
		expect(getIndefiniteArticle("orange")).toBe("an");
		expect(getIndefiniteArticle("umbrella")).toBe("an");
	});

	it("uses a before a consonant sound", ({ expect }) => {
		expect.assertions(2);

		expect(getIndefiniteArticle("banana")).toBe("a");
		expect(getIndefiniteArticle("dog")).toBe("a");
	});

	it("ignores capitalization", ({ expect }) => {
		expect.assertions(2);

		expect(getIndefiniteArticle("Apple")).toBe("an");
		expect(getIndefiniteArticle("Banana")).toBe("a");
	});

	// Catches "a hour" and "a honest mistake".
	it("uses an before a silent h", ({ expect }) => {
		expect.assertions(4);

		expect(getIndefiniteArticle("hour")).toBe("an");
		expect(getIndefiniteArticle("honest")).toBe("an");
		expect(getIndefiniteArticle("honor")).toBe("an");
		expect(getIndefiniteArticle("heir")).toBe("an");
	});

	it("uses a before a pronounced h", ({ expect }) => {
		expect.assertions(1);

		expect(getIndefiniteArticle("house")).toBe("a");
	});

	// Catches "an unicorn" and "an euro".
	it("uses a before a vowel letter that sounds like y", ({ expect }) => {
		expect.assertions(4);

		expect(getIndefiniteArticle("unicorn")).toBe("a");
		expect(getIndefiniteArticle("user")).toBe("a");
		expect(getIndefiniteArticle("ukulele")).toBe("a");
		expect(getIndefiniteArticle("euro")).toBe("a");
	});

	// Catches "a FBI agent", where the letter name F starts with a vowel sound.
	it("uses the sound of the first letter name for initialisms", ({ expect }) => {
		expect.assertions(5);

		expect(getIndefiniteArticle("FBI")).toBe("an");
		expect(getIndefiniteArticle("HTML")).toBe("an");
		expect(getIndefiniteArticle("CPU")).toBe("a");
		expect(getIndefiniteArticle("URL")).toBe("a");
		expect(getIndefiniteArticle("UFO")).toBe("a");
	});

	// Catches a quoted or bracketed word being judged by its punctuation.
	it("skips leading punctuation", ({ expect }) => {
		expect.assertions(2);

		expect(getIndefiniteArticle('"apple"')).toBe("an");
		expect(getIndefiniteArticle("(banana)")).toBe("a");
	});
});
