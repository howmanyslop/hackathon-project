import { ENGLISH_CONSONANTS } from "./constants";

/**
 * Returns the plural form of an English word based on the given amount.
 *
 * Handles common pluralization rules for English nouns, including special
 * endings for pronunciation and words ending in "y" preceded by a consonant.
 *
 * This function does not handle irregular plurals (e.g., "child" ->
 * "children").
 *
 * @example
 *
 * ```typescript
 * toPlural(1, "apple"); // "apple"
 * toPlural(2, "apple"); // "apples"
 * toPlural(2, "box"); // "boxes"
 * toPlural(2, "city"); // "cities"
 * ```
 *
 * @param amount - The quantity to determine singular or plural form.
 * @param word - The word to pluralize.
 * @returns The pluralized word if `amount` is not 1; otherwise, the original
 *   word.
 */
export function toPlural(amount: number, word: string): string {
	if (amount === 1) return word;

	const { length } = word;
	const lastByte = word.codePointAt(length - 1);
	if (lastByte === 115 || lastByte === 120 || lastByte === 122) return `${word}es`;

	const secondToLastByte = word.codePointAt(length - 2);
	if (lastByte === 104 && (secondToLastByte === 99 || secondToLastByte === 115)) return `${word}es`;

	if (secondToLastByte !== undefined && lastByte === 121 && ENGLISH_CONSONANTS.has(secondToLastByte)) {
		return `${word.slice(0, -1)}ies`;
	}

	// irregular plurals are cringe
	return `${word}s`;
}
