import { describe, expect, it } from "vite-plus/test";

import { createRateLimiter } from "./rate-limit";

describe("createRateLimiter", () => {
	it("refuses an address once it passes the limit, without affecting others", () => {
		expect.assertions(3);

		const isAllowed = createRateLimiter(2);

		expect([isAllowed("a", 0), isAllowed("a", 1)]).toStrictEqual([true, true]);
		expect(isAllowed("a", 2)).toBe(false);
		expect(isAllowed("b", 3)).toBe(true);
	});

	it("allows the address again in the next minute", () => {
		expect.assertions(2);

		const isAllowed = createRateLimiter(1);

		expect(isAllowed("a", 0)).toBe(true);
		expect([isAllowed("a", 10), isAllowed("a", 60_000)]).toStrictEqual([false, true]);
	});
});
