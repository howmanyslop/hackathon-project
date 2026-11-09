import { describe, expect, it } from "vite-plus/test";

import { isBodyTooLarge } from "./body-limit";

function post(headers: Record<string, string>): Request {
	return new Request("https://example.test/api/rpc/x", { body: "request body", headers, method: "POST" });
}

describe("isBodyTooLarge", () => {
	it("should accept a post that states exactly 1 MB", () => {
		expect.assertions(1);

		expect(isBodyTooLarge(post({ "content-length": "1000000" }))).toBe(false);
	});

	it("should refuse a post that states more than 1 MB", () => {
		expect.assertions(1);

		expect(isBodyTooLarge(post({ "content-length": "1000001" }))).toBe(true);
	});

	it("should refuse a post that does not state a length", () => {
		expect.assertions(1);

		expect(isBodyTooLarge(post({ "transfer-encoding": "chunked" }))).toBe(true);
	});

	it("should refuse a DELETE body without an announced length", () => {
		expect.assertions(1);

		expect(
			isBodyTooLarge(new Request("https://example.test/mcp", { body: "request body", method: "DELETE" })),
		).toBe(true);
	});

	it("should refuse a post whose length is not a number", () => {
		expect.assertions(1);

		expect(isBodyTooLarge(post({ "content-length": "lots" }))).toBe(true);
	});

	it("should accept a post without a body", () => {
		expect.assertions(1);

		expect(isBodyTooLarge(new Request("https://example.test/mcp", { method: "POST" }))).toBe(false);
	});
});
