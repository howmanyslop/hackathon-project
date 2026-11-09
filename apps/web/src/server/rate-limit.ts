const WINDOW_MS = 60_000;

/** Says whether one more call from an address fits this minute's limit. */
export type RateLimiter = (address: string, now?: number) => boolean;

/**
 * Counts calls per address in one-minute windows, in this server's memory.
 * Every minute the counts start again from zero. With three replicas, an
 * address can make up to three times the limit across the app.
 *
 * @param limitPerMinute - The most calls one address may make in a minute.
 * @returns A check that counts the call and says whether it is allowed.
 */
export function createRateLimiter(limitPerMinute: number): RateLimiter {
	const counts = new Map<string, number>();
	let windowStartedAt = 0;

	return function isAllowed(address, now = Date.now()): boolean {
		if (now - windowStartedAt >= WINDOW_MS) {
			counts.clear();
			windowStartedAt = now;
		}

		const count = (counts.get(address) ?? 0) + 1;
		counts.set(address, count);
		return count <= limitPerMinute;
	};
}
