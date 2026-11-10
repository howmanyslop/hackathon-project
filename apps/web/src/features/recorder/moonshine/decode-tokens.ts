/** A byte the vocabulary has no piece for, such as part of an emoji. */
const BYTE_PIECE = /^<0x(?<hex>[\dA-F]{2})>$/u;

/** SentencePiece's word marker, which stands for a space. */
const WORD_MARKER = "▁";

/**
 * Turns Moonshine's token ids into text, the way its tokenizer's decoder
 * does: word markers become spaces, byte pieces join into UTF-8, special
 * tokens (an empty piece in the vocabulary) are skipped, and the one space
 * the first word marker leaves at the start is removed.
 *
 * @param vocabulary - Each id's piece, `""` for special tokens.
 * @param ids - Token ids in order.
 * @returns The text.
 */
export function decodeTokens(vocabulary: ReadonlyArray<string>, ids: Iterable<number>): string {
	const decoder = new TextDecoder();
	const parts = new Array<string>();
	const bytes = new Array<number>();

	function flushBytes(): void {
		if (bytes.length === 0) return;
		parts.push(decoder.decode(Uint8Array.from(bytes)));
		bytes.length = 0;
	}

	for (const id of ids) {
		const piece = vocabulary[id] ?? "";
		if (piece.length === 0) continue;
		const hex = BYTE_PIECE.exec(piece)?.groups?.hex;
		if (hex === undefined) {
			flushBytes();
			parts.push(piece.replaceAll(WORD_MARKER, " "));
		} else {
			bytes.push(Number.parseInt(hex, 16));
		}
	}

	flushBytes();

	const text = parts.join("");
	return text.startsWith(" ") ? text.slice(1) : text;
}
