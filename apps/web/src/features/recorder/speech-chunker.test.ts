import { describe, expect, it } from "vite-plus/test";

import { createSpeechChunker } from "./speech-chunker";

import type { SpeechChunk } from "./speech-chunker";

const SAMPLES_PER_MS = 16;

function makeSilence(milliseconds: number): Float32Array {
	return new Float32Array(milliseconds * SAMPLES_PER_MS);
}

/**
 * A loud buzz whose every sample is different, so a lost or repeated sample
 * shows up when the chunks are joined again.
 *
 * @param milliseconds - How long it lasts.
 * @returns The samples.
 */
function makeSound(milliseconds: number): Float32Array {
	const samples = new Float32Array(milliseconds * SAMPLES_PER_MS);
	for (let index = 0; index < samples.length; index += 1) {
		const sign = index % 2 === 0 ? 1 : -1;
		samples[index] = sign * (0.2 + (index % 997) / 10_000);
	}

	return samples;
}

function joinAll(parts: ReadonlyArray<Float32Array>): Float32Array {
	const joined = new Float32Array(parts.reduce((total, part) => total + part.length, 0));
	let offset = 0;
	for (const part of parts) {
		joined.set(part, offset);
		offset += part.length;
	}

	return joined;
}

function pushInPieces(samples: Float32Array, pieceLength: number): Array<SpeechChunk> {
	const chunker = createSpeechChunker();
	const chunks: Array<SpeechChunk> = [];
	for (let offset = 0; offset < samples.length; offset += pieceLength) {
		const finished = chunker.add(samples.subarray(offset, offset + pieceLength));
		for (const chunk of finished) {
			chunks.push(chunk);
		}
	}

	return [...chunks, ...chunker.flush()];
}

function describeTimes(chunks: ReadonlyArray<SpeechChunk>): Array<[number, number]> {
	return chunks.map((chunk) => [chunk.startMs, chunk.endMs]);
}

describe("speech chunker", () => {
	// Catches a quiet room being sent to the model as if someone spoke.
	it("gives nothing for silence", () => {
		expect.assertions(1);

		const chunks = pushInPieces(makeSilence(10_000), 2048);

		expect(chunks).toHaveLength(0);
	});

	// Catches two sentences with a pause between them being merged, or timed
	// from the wrong moment. Expected: each starts when its sound starts and
	// ends 600 ms into the following quiet.
	it("splits speech at a pause and times each part", () => {
		expect.assertions(1);

		const recording = joinAll([
			makeSilence(900),
			makeSound(2100),
			makeSilence(1200),
			makeSound(1800),
			makeSilence(1200),
		]);

		const chunks = pushInPieces(recording, 1000);

		expect(describeTimes(chunks)).toStrictEqual([
			[900, 3600],
			[4200, 6600],
		]);
	});

	// Catches a long stretch without pauses growing past what the model takes,
	// or losing or repeating sound where it is cut.
	it("cuts 20 seconds of sound into pieces of at most 9 seconds", () => {
		expect.assertions(3);

		const recording = makeSound(20_000);

		const chunks = pushInPieces(recording, 1234);
		const lengths = chunks.map((chunk) => chunk.endMs - chunk.startMs);

		expect(lengths.every((length) => length <= 9000)).toBe(true);
		expect(chunks.length).toBeGreaterThanOrEqual(3);
		expect(joinAll(chunks.map((chunk) => chunk.samples))).toStrictEqual(recording);
	});

	// Catches the last words being lost when the presenter stops mid-sentence.
	it("returns the unfinished chunk on flush", () => {
		expect.assertions(2);

		const chunker = createSpeechChunker();
		const pushed = chunker.add(joinAll([makeSilence(900), makeSound(1000)]));
		const flushed = chunker.flush();

		expect(pushed).toHaveLength(0);
		expect(describeTimes(flushed)).toStrictEqual([[900, 1900]]);
	});
});
