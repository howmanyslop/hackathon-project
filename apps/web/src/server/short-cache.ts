interface Entry<Value> {
	readonly storedAt: number;
	readonly value: Value;
}

/**
 * Remembers answers for a short while, in this server's memory.
 *
 * @template Value - What is remembered.
 */
export interface ShortCache<Value> {
	/** The remembered answer, or undefined when there is none or it is old. */
	readonly read: (key: string, now?: number) => undefined | Value;
	readonly write: (key: string, value: Value, now?: number) => void;
}

/**
 * Keeps recent answers so the same request, made again within moments by a
 * room full of people, is answered without doing the work twice. Each replica
 * has its own copy, and the oldest answer makes room when it is full.
 *
 * @template Value - What is remembered.
 * @param lifetimeMs - How long an answer stays usable.
 * @param maximumEntries - The most answers kept at once.
 * @returns A cache with nothing in it yet.
 */
export function createShortCache<Value>(lifetimeMs: number, maximumEntries: number): ShortCache<Value> {
	const entries = new Map<string, Entry<Value>>();

	function read(key: string, now = Date.now()): undefined | Value {
		const entry = entries.get(key);
		if (entry === undefined) return undefined;

		if (now - entry.storedAt >= lifetimeMs) {
			entries.delete(key);
			return undefined;
		}

		return entry.value;
	}

	function write(key: string, value: Value, now = Date.now()): void {
		entries.delete(key);
		entries.set(key, { storedAt: now, value });

		if (entries.size <= maximumEntries) return;

		// A Map lists its keys oldest first, so the first one is the one to drop.
		const oldest = entries.keys().next();
		if (oldest.done !== true) {
			entries.delete(oldest.value);
		}
	}

	return { read, write };
}
