import { isMaybeNonNegativeInteger } from "@web-template/arktype-utilities";
import { type } from "arktype";

import { toWholeSeconds } from "$lib/time-label";

import type { DictionaryOfUnknowns } from "@web-template/arktype-utilities";

const isSessionSearch = type({
	"t?": isMaybeNonNegativeInteger,
}).readonly();

/** A session page's search: the second of the talk to jump to. */
export type SessionSearch = typeof isSessionSearch.infer;

/**
 * Reads `?t=` from a session link, dropping it when it is not a whole number
 * of seconds, so a bad link still opens the session.
 *
 * @param search - The parsed search parameters.
 * @returns The validated search.
 */
export function validateSessionSearch(search: DictionaryOfUnknowns): SessionSearch {
	if (!isSessionSearch.allows(search) || search.t === undefined) {
		return {};
	}

	// oxlint-disable-next-line id-length -- "t" is the link's public name.
	return { t: search.t };
}

/**
 * The search for a link to a moment in a session.
 *
 * @param milliseconds - Time into the talk.
 * @returns The search, in whole seconds.
 */
export function createSessionSearch(milliseconds: number): SessionSearch {
	// oxlint-disable-next-line id-length -- "t" is the link's public name.
	return { t: toWholeSeconds(milliseconds) };
}
