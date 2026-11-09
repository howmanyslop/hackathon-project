import { describe, expect, it } from "vite-plus/test";

import { isBodyTooLarge } from "./request-body";

const URL = "https://app.example.com/api/rpc";

function post(headers: Record<string, string> = {}): Request {
	return new Request(URL, { body: "request body", headers, method: "POST" });
}

describe("request body size limit", () => {
	it("allows a request with no body", () => {
		expect.assertions(1);

		expect(isBodyTooLarge(new Request(URL))).toBe(false);
	});

	it("refuses a body without an announced length", () => {
		expect.assertions(1);

		expect(isBodyTooLarge(post())).toBe(true);
	});

	it("allows a body at the limit and refuses larger or invalid lengths", () => {
		expect.assertions(3);

		expect(isBodyTooLarge(post({ "content-length": "1000000" }))).toBe(false);
		expect(isBodyTooLarge(post({ "content-length": "1000001" }))).toBe(true);
		expect(isBodyTooLarge(post({ "content-length": "unknown" }))).toBe(true);
	});
});
