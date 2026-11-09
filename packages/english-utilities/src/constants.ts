function toByteSet(array: ReadonlyArray<string>): ReadonlySet<number> {
	const byteSet = new Set<number>();
	for (const character of array) {
		const upper = character.toUpperCase().codePointAt(0);
		if (upper !== undefined) {
			byteSet.add(upper);
		}

		const lower = character.toLowerCase().codePointAt(0);
		if (lower !== undefined) {
			byteSet.add(lower);
		}
	}

	return byteSet;
}

export const ENGLISH_VOWELS = toByteSet(["a", "e", "i", "o", "u"]);
export const ENGLISH_CONSONANTS = toByteSet(
	"abcdefghijklmnopqrstuvwxyz".split("").filter((character) => !ENGLISH_VOWELS.has(character.codePointAt(0) ?? 0)),
);
