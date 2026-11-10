#!/usr/bin/env node

/**
 * Downloads Moonshine Tiny, the on-device speech model, into
 * `apps/web/public/models/moonshine-tiny/` when it is missing. The app serves
 * it to phones whose browser has no speech recognition of its own. The folder
 * is git-ignored (27 MB), so a fresh checkout runs this once.
 *
 * Every file is checked against its SHA-256 before it is written. Files that
 * are already there are checked and left alone.
 *
 * Usage: `node apps/web/scripts/fetch-speech-model.ts` (or `bun run`).
 */

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { exit } from "node:process";
import { type } from "arktype";

/** `onnx-community/moonshine-tiny-ONNX`, the revision the app was tested on. */
const SOURCE =
	"https://huggingface.co/onnx-community/moonshine-tiny-ONNX/resolve/a6da1241cd305dcd64eab1edbd615f2bb9aabb95/";

const FOLDER = new URL("../public/models/moonshine-tiny/", import.meta.url);

/** The parts of `tokenizer.json` the vocabulary is made from. */
const isTokenizer = type({
	added_tokens: type({ id: "number", special: "boolean" }).array(),
	model: { vocab: "Record<string, number>" },
});

interface ModelFile {
	/** The name the app loads it by. */
	readonly name: string;
	/** Turns the downloaded bytes into the file's contents. */
	readonly convert: (bytes: Uint8Array) => Uint8Array;
	readonly sha256: string;
	/** Its path in the Hugging Face repository. */
	readonly source: string;
}

/**
 * Makes `moonshine-vocab.json` from `tokenizer.json`: each piece in id order,
 * with special tokens as `""`, as the app's detokenizer expects.
 *
 * @param bytes - The downloaded `tokenizer.json`.
 * @returns The vocabulary file's bytes.
 */
function convertTokenizer(bytes: Uint8Array): Uint8Array {
	const tokenizer = isTokenizer.assert(JSON.parse(new TextDecoder().decode(bytes)));
	const pieces = Object.entries(tokenizer.model.vocab)
		.toSorted((left, right) => left[1] - right[1])
		.map(([piece]) => piece);
	const specials = new Set<number>();
	for (const token of tokenizer.added_tokens) {
		if (token.special) {
			specials.add(token.id);
		}
	}

	const vocabulary = pieces.map((piece, id) => (specials.has(id) ? "" : piece));
	return new TextEncoder().encode(`${JSON.stringify(vocabulary)}\n`);
}

function keepBytes(bytes: Uint8Array): Uint8Array {
	return bytes;
}

const MODEL_FILES: ReadonlyArray<ModelFile> = [
	{
		name: "moonshine-encoder.onnx",
		convert: keepBytes,
		sha256: "c6fc4b7bc5af75c0591fd157a1f3829b533d18e9769a888fd95a62e470dd4f4a",
		source: "onnx/encoder_model_quantized.onnx",
	},
	{
		name: "moonshine-decoder.onnx",
		convert: keepBytes,
		sha256: "eed87831c3a6103534aae7d47a5d485025c659a1323901513961c39fe8a1a367",
		source: "onnx/decoder_model_merged_quantized.onnx",
	},
	{
		name: "moonshine-vocab.json",
		convert: convertTokenizer,
		sha256: "13155ad51b72b2b3a17d6c856bc42bfeaf001813c9b3d6701ccd7d5b0a08552f",
		source: "tokenizer.json",
	},
];

function getSha256(bytes: Uint8Array): string {
	return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Makes sure one model file is in place and intact.
 *
 * @param file - The file to check or download.
 * @returns A line saying what happened.
 * @rejects {Error} When the download fails or its SHA-256 does not match.
 */
async function ensureFileAsync(file: ModelFile): Promise<string> {
	const target = new URL(file.name, FOLDER);
	if (existsSync(target)) {
		const present = getSha256(await readFile(target));
		if (present !== file.sha256) {
			throw new Error(`${file.name} is there but its SHA-256 is ${present}; delete it and run this again.`);
		}

		return `${file.name}: already there`;
	}

	const response = await fetch(SOURCE + file.source);
	if (!response.ok) {
		throw new Error(`${file.source} did not download (${response.status}).`);
	}

	const contents = file.convert(new Uint8Array(await response.arrayBuffer()));
	const received = getSha256(contents);
	if (received !== file.sha256) {
		throw new Error(`${file.name} has SHA-256 ${received}, expected ${file.sha256}.`);
	}

	await writeFile(target, contents);
	return `${file.name}: downloaded`;
}

async function fetchSpeechModelAsync(): Promise<void> {
	await mkdir(FOLDER, { recursive: true });
	const lines = await Promise.all(MODEL_FILES.map(ensureFileAsync));
	console.log(lines.join("\n"));
}

try {
	await fetchSpeechModelAsync();
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	exit(1);
}
