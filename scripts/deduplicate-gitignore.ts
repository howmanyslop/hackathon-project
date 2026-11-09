#!/usr/bin/env bun

import { readFile, writeFile } from "node:fs/promises";
import nodePath from "node:path";
import { argv, cwd } from "node:process";
import { consola } from "consola";

import { createBaseCommand } from "$script-functions/create-base-command";
import { getScriptName } from "$script-functions/get-script-name";

const NEWLINE_REGEXP = /\r?\n/u;

const scriptName = getScriptName(true);
const log = consola.withTag(scriptName);

function removeConsecutiveEmptyLines(lines: ReadonlyArray<string>): ReadonlyArray<string> {
	const outputLines = new Array<string>();
	let size = 0;
	let lastWasEmpty = false;

	for (const line of lines) {
		if (line.trim().length === 0) {
			if (!lastWasEmpty) {
				outputLines[size++] = line;
				lastWasEmpty = true;
			}
		} else {
			outputLines[size++] = line;
			lastWasEmpty = false;
		}
	}

	return outputLines.slice(0, size);
}

function isPattern(trimmedLine: string): boolean {
	return trimmedLine.length > 0 && !trimmedLine.startsWith("#");
}

function removeDuplicatePatterns(lines: ReadonlyArray<string>): ReadonlyArray<string> {
	const seenPatterns = new Set<string>();

	return lines.filter((line) => {
		const trimmedLine = line.trim();
		if (!isPattern(trimmedLine)) return true;

		const isDuplicate = seenPatterns.has(trimmedLine);
		seenPatterns.add(trimmedLine);
		return !isDuplicate;
	});
}

function cleanGitignore(fileContent: string): string {
	const lines = removeDuplicatePatterns(fileContent.split(NEWLINE_REGEXP));
	return `${removeConsecutiveEmptyLines(lines).join("\n").trimEnd()}\n`;
}

const command = createBaseCommand(scriptName, "1.1.1", "Removes duplicate entries in a `.gitignore` file.")
	.option("--dry-run", "Perform a dry run without modifying the file.")
	.argument("<file:file>", "The path to the `.gitignore` file.", { default: nodePath.join(cwd(), ".gitignore") })
	.action(async ({ dryRun }, file: string) => {
		const fileContent = await readFile(file, "utf8");
		const newContents = cleanGitignore(fileContent);

		if (dryRun) {
			if (fileContent === newContents) {
				log.success("No changes needed. The `.gitignore` file is already clean.");
			} else {
				log.info("The `.gitignore` file would be modified.");
			}

			return;
		}

		await writeFile(file, newContents, "utf8");
	});

await command.parse(argv.slice(2));
