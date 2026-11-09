import { createHash, timingSafeEqual } from "node:crypto";

import { readOptionalSetting } from "$search/client";

function getHashCode(code: string): Buffer {
	return createHash("sha256").update(code).digest();
}

/**
 * Compares a code someone typed with the configured one in constant time.
 * Both sides are hashed first, so the comparison takes as long for a wrong
 * length as for a wrong character.
 *
 * @param candidate - The code the presenter typed, if any.
 * @param configured - The shared presenter code, if one is set.
 * @returns `true` only when a code is configured and the candidate matches it.
 */
export function matchesPresenterCode(candidate?: string, configured?: string): boolean {
	// No code configured means nobody may record, not that anybody may.
	if (configured === undefined || configured.length === 0) return false;

	return timingSafeEqual(getHashCode(candidate ?? ""), getHashCode(configured));
}

/**
 * Checks a code against `PRESENTER_CODE`, which comes from a Kubernetes
 * Secret. Read on use, so tests and scripts need no environment to import it.
 *
 * @param candidate - The code the presenter typed, if any.
 * @returns `true` when the code may record.
 */
export function isPresenterCode(candidate?: string): boolean {
	return matchesPresenterCode(candidate, readOptionalSetting("PRESENTER_CODE"));
}
