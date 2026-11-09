import { describe, expect, it } from "vite-plus/test";

import { isBodyTooLarge } from "./body-limit";

function post(headers: Record<string, string>): Request {
	return new Request("https://example.test/api/rpc/x", { headers, method: "POST" });
}

describe("isBodyTooLarge", () => {
	it("should accept a post that states a small length", () => {
		expect.assertions(1);

		expect(isBodyTooLarge(post({ "content-length": "300000" }))).toBe(false);
	});

	it("should refuse a post that states more than 1 MB", () => {
		expect.assertions(1);

		expect(isBodyTooLarge(post({ "content-length": "1000001" }))).toBe(true);
	});

	it("should refuse a post that does not state a length", () => {
		expect.assertions(1);

		expect(isBodyTooLarge(post({ "transfer-encoding": "chunked" }))).toBe(true);
	});

	it("should refuse a post whose length is not a number", () => {
		expect.assertions(1);

		expect(isBodyTooLarge(post({ "content-length": "lots" }))).toBe(true);
	});

	it("should accept a request without a body", () => {
		expect.assertions(1);

		expect(isBodyTooLarge(new Request("https://example.test/mcp"))).toBe(false);
	});
});
