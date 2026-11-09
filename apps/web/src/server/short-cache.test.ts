import { describe, expect, it } from "vite-plus/test";

import { createShortCache } from "./short-cache";

describe("createShortCache", () => {
	// Catches a repeated search doing the paid work again within moments.
	it("gives back what was stored until its lifetime runs out", () => {
		expect.assertions(3);

		const cache = createShortCache<string>(30_000, 10);
		cache.write("node dies", "results", 0);

		expect(cache.read("node dies", 29_999)).toBe("results");
		expect(cache.read("node dies", 30_000)).toBeUndefined();
		expect(cache.read("something else", 1)).toBeUndefined();
	});

	// Catches the cache growing without end as people type new searches.
	it("drops the oldest answer when it is full", () => {
		expect.assertions(3);

		const cache = createShortCache<number>(30_000, 2);
		cache.write("first", 1, 0);
		cache.write("second", 2, 1);
		cache.write("third", 3, 2);

		expect(cache.read("first", 3)).toBeUndefined();
		expect(cache.read("second", 3)).toBe(2);
		expect(cache.read("third", 3)).toBe(3);
	});
});
