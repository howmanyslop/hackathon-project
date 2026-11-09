import { describe, expect, it } from "vite-plus/test";

import { isCsrfSafeRequest } from "./csrf";

const URL = "https://app.example.com/api/rpc";

function post(headers: Record<string, string> = {}): Request {
	return new Request(URL, { headers, method: "POST" });
}

describe("same-origin check", () => {
	// Catches a page on another site posting here with the visitor's cookie.
	it("refuses a cross-site request even when it claims this origin", () => {
		expect.assertions(1);

		expect(isCsrfSafeRequest(post({ origin: "https://app.example.com", "sec-fetch-site": "cross-site" }))).toBe(
			false,
		);
	});

	// Catches a request from a sibling subdomain, which shares the cookie's
	// site but not its origin.
	it("refuses a same-site request without an origin", () => {
		expect.assertions(1);

		expect(isCsrfSafeRequest(post({ "sec-fetch-site": "same-site" }))).toBe(false);
	});

	// Catches a forged Origin, or one from a different port or scheme.
	it("refuses an origin that is not this one", () => {
		expect.assertions(3);

		expect(isCsrfSafeRequest(post({ origin: "https://elsewhere.example.com" }))).toBe(false);
		expect(isCsrfSafeRequest(post({ origin: "http://app.example.com" }))).toBe(false);
		expect(isCsrfSafeRequest(post({ origin: "https://app.example.com:8443" }))).toBe(false);
	});

	// Catches an opaque, sandboxed origin being mistaken for no origin.
	it("refuses the null origin", () => {
		expect.assertions(1);

		expect(isCsrfSafeRequest(post({ origin: "null" }))).toBe(false);
	});

	// Catches the normal same-origin form POST being refused.
	it("allows the request's own origin", () => {
		expect.assertions(1);

		expect(isCsrfSafeRequest(post({ origin: "https://app.example.com" }))).toBe(true);
	});

	// Catches a browser that sends no Origin but marks a same-origin or
	// browser-initiated request.
	it("allows a marked same-origin request without an origin", () => {
		expect.assertions(2);

		expect(isCsrfSafeRequest(post({ "sec-fetch-site": "same-origin" }))).toBe(true);
		expect(isCsrfSafeRequest(post({ "sec-fetch-site": "none" }))).toBe(true);
	});

	// Catches scripts, curl, and other non-browser clients being locked out.
	it("allows a request with no browser marks at all", () => {
		expect.assertions(1);

		expect(isCsrfSafeRequest(post())).toBe(true);
	});

	// Catches safe methods being refused over a missing header.
	it("lets safe methods through", () => {
		expect.assertions(2);

		expect(isCsrfSafeRequest(new Request(URL))).toBe(true);
		expect(isCsrfSafeRequest(new Request(URL, { method: "HEAD" }))).toBe(true);
	});

	// Catches a lowercase method being treated as state-changing in tests.
	it("reads the method without regard to case", () => {
		expect.assertions(1);

		expect(isCsrfSafeRequest(new Request(URL, { method: "get" }))).toBe(true);
	});

	// Catches the local dev port or a trailing slash on Origin being mishandled.
	it("compares the port the request arrived on", () => {
		expect.assertions(2);

		const local = new Request("http://localhost:5173/api/rpc", {
			headers: { origin: "http://localhost:5173" },
			method: "POST",
		});

		expect(isCsrfSafeRequest(local)).toBe(true);
		expect(isCsrfSafeRequest(post({ origin: "https://app.example.com/" }))).toBe(true);
	});
});
