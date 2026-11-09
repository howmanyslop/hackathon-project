import { applyEdits, modify, parse } from "jsonc-parser";
import { diff } from "just-diff";

import { detectEol, detectIndentation } from "$file-content-utilities";

import type { FormattingOptions } from "jsonc-parser";

function buildFormattingOptions(content: string): FormattingOptions {
	const { insertSpaces, tabSize } = detectIndentation(content);
	return {
		eol: detectEol(content),
		insertFinalNewline: false,
		insertSpaces,
		tabSize,
	};
}

/**
 * Edits a JSONC string while preserving comments and the original formatting
 * style.
 *
 * @template TIn - The type of the parsed data.
 * @param content - The JSONC content to edit.
 * @param validator - A function that validates and returns the parsed data.
 * @param callback - A function that receives a draft of the data and returns the modified version.
 * @returns The modified JSONC string with comments preserved.
 */
export function editJsonc<TIn extends object>(
	content: string,
	// oxlint-disable-next-line small-rules/no-unknown-parameters -- type guard.
	validator: (data: unknown) => TIn,
	callback: (draft: TIn) => TIn,
): string {
	const parsed = validator(parse(content));
	const formattingOptions = buildFormattingOptions(content);

	const modified = callback(structuredClone(parsed));
	const changes = diff(parsed, modified);

	let updatedContent = content;
	for (const change of changes) {
		const edits = modify(updatedContent, change.path, change.value, { formattingOptions });
		updatedContent = applyEdits(updatedContent, edits);
	}

	return updatedContent;
}
