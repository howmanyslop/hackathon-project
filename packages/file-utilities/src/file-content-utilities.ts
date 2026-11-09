import { regex } from "arktype";

// oxlint-disable-next-line unicorn/prefer-string-raw -- arktype
const INDENTATION_REGEXP = regex("^(?<whitespace>\\s+)", "u");

interface IndentationInformation {
	readonly eol: string;
	readonly insertSpaces: boolean;
	readonly tabSize: number;
}

export function detectIndentation(content: string): IndentationInformation {
	const lines = content.split("\n");
	for (const line of lines) {
		const match = INDENTATION_REGEXP.exec(line);
		if (match === null) continue;

		const { whitespace } = match.groups;
		if (whitespace.startsWith("\t")) {
			return { eol: "\n", insertSpaces: false, tabSize: 1 };
		}

		return { eol: "\n", insertSpaces: true, tabSize: whitespace.length };
	}

	return { eol: "\n", insertSpaces: false, tabSize: 1 };
}

const EOL_REGEXP = /\r\n|\r|\n/u;

export function detectEol(content: string): string {
	return EOL_REGEXP.exec(content)?.[0] ?? "\n";
}
