import { ENGLISH_VOWELS } from "./constants";

const SILENT_H_PREFIXES: ReadonlyArray<string> = ["honest", "honor", "honour", "hour", "heir"];
const Y_SOUND_PREFIXES: ReadonlyArray<string> = ["uni", "user", "use", "ufo", "ukulele", "euro"];
const ACRONYM_VOWEL_SOUND = new Set<number>([65, 69, 70, 72, 73, 76, 77, 78, 79, 82, 83, 88]);

function startsWithAny(value: string, prefixes: ReadonlyArray<string>): boolean {
	for (const prefix of prefixes) {
		if (value.startsWith(prefix)) return true;
	}

	return false;
}

function getFirstUpperByte(value: string): number | undefined {
	const firstByte = value.codePointAt(0);
	if (firstByte === undefined) return undefined;
	return firstByte >= 97 && firstByte <= 122 ? firstByte - 32 : firstByte;
}

const alphabet = new Set<number>([
	65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 97, 98, 99,
	100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122,
]);

export type IndefiniteArticle = "a" | "an";

/**
 * Attempts to get the correct indefinite article ('a' or 'an') for a word.
 *
 * @param value - The word to get the indefinite article for.
 * @returns The indefinite article ('a' or 'an').
 */
export function getIndefiniteArticle(value: string): IndefiniteArticle {
	let remainingValue = value;
	while (true) {
		if (remainingValue.length === 0) break;

		const firstByte = remainingValue.codePointAt(0);
		if (firstByte === undefined || alphabet.has(firstByte)) break;

		remainingValue = remainingValue.slice(1);
	}

	if (remainingValue.length === 0) return "a";

	const firstUpperByte = getFirstUpperByte(remainingValue);
	if (firstUpperByte === undefined) return "a";
	if (remainingValue === remainingValue.toUpperCase()) return ACRONYM_VOWEL_SOUND.has(firstUpperByte) ? "an" : "a";

	const lower = remainingValue.toLowerCase();
	if (startsWithAny(lower, SILENT_H_PREFIXES)) return "an";
	if (startsWithAny(lower, Y_SOUND_PREFIXES)) return "a";

	const firstByte = remainingValue.codePointAt(0);
	if (firstByte === undefined) return "a";
	return ENGLISH_VOWELS.has(firstByte) ? "an" : "a";
}
