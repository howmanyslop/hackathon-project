import { describe, expect, it } from "vite-plus/test";

import { prepareQuestionText } from "./question-log";

describe("question log text", () => {
	// Catches stray keystrokes and blank searches filling the presenters' list.
	it("skips blank text and text shorter than three characters", () => {
		expect.assertions(4);

		expect(prepareQuestionText("")).toBeUndefined();
		expect(prepareQuestionText(" ".repeat(5))).toBeUndefined();
		expect(prepareQuestionText("ok")).toBeUndefined();
		expect(prepareQuestionText("  a  ")).toBeUndefined();
	});

	// Catches a short real question being thrown away.
	it("keeps a question of three characters", () => {
		expect.assertions(1);

		expect(prepareQuestionText(" why ")).toBe("why");
	});

	// Catches one question showing up twice because of the spaces around it.
	it("drops the spaces around a question", () => {
		expect.assertions(1);

		expect(prepareQuestionText("  How do you test screen readers?\n")).toBe("How do you test screen readers?");
	});

	// Catches a pasted essay being stored whole.
	it("keeps at most 300 characters", () => {
		expect.assertions(2);

		expect(prepareQuestionText("a".repeat(500))).toHaveLength(300);
		expect(prepareQuestionText("a".repeat(300))).toHaveLength(300);
	});

	// Catches the cut leaving half an emoji, which reads as a broken glyph.
	it("never cuts a character in half", () => {
		expect.assertions(2);

		// A woman scientist: three code points that read as one character.
		const scientist = "\u{1F469}\u{200D}\u{1F52C}";

		expect(prepareQuestionText(`${"a".repeat(299)}🎤🎤`)).toBe(`${"a".repeat(299)}🎤`);
		expect(prepareQuestionText(`${"a".repeat(299)}${scientist}${scientist}`)).toBe(
			`${"a".repeat(299)}${scientist}`,
		);
	});
});
