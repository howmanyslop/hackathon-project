import { describe, expect, it } from "vite-plus/test";

import { createRecordingLink } from "./recording-link";

describe("recording link", () => {
	// Catches a YouTube link that loses its video id or starts at zero.
	it("adds a t parameter to YouTube links", () => {
		expect.assertions(2);

		expect(createRecordingLink("https://www.youtube.com/watch?v=abc", 2472)).toBe(
			"https://www.youtube.com/watch?v=abc&t=2472s",
		);
		expect(createRecordingLink("https://youtu.be/abc", 90)).toBe("https://youtu.be/abc?t=90s");
	});

	// Catches a second t parameter when the link already had one.
	it("replaces an existing start time", () => {
		expect.assertions(1);

		expect(createRecordingLink("https://youtu.be/abc?t=10s", 90)).toBe("https://youtu.be/abc?t=90s");
	});

	// Catches other players being given a parameter they ignore.
	it("uses a media fragment for other links", () => {
		expect.assertions(1);

		expect(createRecordingLink("https://cdn.example.com/talk.mp4", 61)).toBe(
			"https://cdn.example.com/talk.mp4#t=61",
		);
	});

	// Catches a typo in the stored link throwing during render.
	it("leaves a link it cannot read alone", () => {
		expect.assertions(1);

		expect(createRecordingLink("not a link", 5)).toBe("not a link");
	});
});
