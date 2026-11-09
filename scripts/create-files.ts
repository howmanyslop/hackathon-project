#!/usr/bin/env bun

import nodePath from "node:path";
import { argv } from "node:process";
import { Command } from "@cliffy/command";
import { file, write } from "bun";

import { createLogger } from "$script-logging/logger";
import { toKebabCase } from "$script-utilities/casing-utilities";

const log = createLogger("create-files");

const command = new Command()
	.name("create-files")
	.description("Bulk creates files at a path.")
	.version("1.0.0")
	.argument("<paths...:string>", "The file paths.")
	.action(async (_, ...filePaths) => {
		const correctedFilePaths = filePaths.map((filePath) => {
			const extension = nodePath.extname(filePath);
			return nodePath.resolve(
				nodePath.dirname(filePath),
				`${toKebabCase(nodePath.basename(filePath, extension))}${extension}`,
			);
		});

		await Promise.all(
			correctedFilePaths.map(async (filePath) => {
				const bunFile = file(filePath);
				if (await bunFile.exists()) {
					log.info(`File already exists: ${filePath}`);
					return;
				}

				await write(bunFile, "");
				log.info(`Created file: ${filePath}`);
			}),
		);
	});

await command.parse(argv.slice(2));
