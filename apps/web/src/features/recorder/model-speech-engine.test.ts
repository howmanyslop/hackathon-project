import { describe, expect, it } from "vite-plus/test";

import { MicrophoneError } from "./audio/microphone";
import { createModelSpeechEngine } from "./model-speech-engine";

import type { ChunkListener, ChunkSource } from "./audio/speech-chunks";
import type { ModelTranscriber } from "./moonshine/model-transcriber";
import type { SegmentDraft } from "./segment-queue";
import type { SpeechChunk } from "./speech-chunker";
import type { SpeechEngineStatus } from "./speech-engine";

/** What the fake model "hears" in a chunk, and how long it takes. */
interface Spoken {
	readonly delayMs: number;
	readonly text: string;
}

/** The fake model reads the chunk's first sample as an index into this. */
const SPOKEN: ReadonlyArray<Spoken> = [
	{ delayMs: 30, text: "The first sentence is slow." },
	{ delayMs: 1, text: "The second is quick." },
	{ delayMs: 1, text: "" },
	{ delayMs: 20, text: "The last words before stop." },
];

function makeChunk(index: number, startMs: number): SpeechChunk {
	const samples = new Float32Array(16);
	samples[0] = index;
	return { endMs: startMs + 1000, samples, startMs };
}

async function waitAsync(milliseconds: number): Promise<void> {
	await new Promise(function wait(resolve) {
		setTimeout(resolve, milliseconds);
	});
}

function createTranscriber(isInstalled: boolean): ModelTranscriber {
	async function loadAsync(onProgress: (fraction: number) => void): Promise<void> {
		onProgress(0.5);
		await waitAsync(5);

		if (!isInstalled) {
			throw new Error("404");
		}

		onProgress(1);
	}

	async function transcribeAsync(samples: Float32Array): Promise<string> {
		const spoken = SPOKEN[samples[0]];
		await waitAsync(spoken.delayMs);
		return spoken.text;
	}

	function dispose(): void {
		// Nothing to release.
	}

	return { dispose, loadAsync, transcribeAsync };
}

interface FakeMicrophone {
	/** Hands the engine a chunk, as the chunker would. */
	readonly hear: (chunk: SpeechChunk) => void;
	readonly startAsync: (onChunk: ChunkListener) => Promise<ChunkSource>;
}

/**
 * A microphone that hears the given chunks on cue and holds `tail` as the
 * unfinished chunk until it is stopped.
 *
 * @param tail - The chunk still open when Stop is tapped.
 * @returns The fake.
 */
function createMicrophone(tail: ReadonlyArray<SpeechChunk>): FakeMicrophone {
	let listener: ChunkListener | undefined;

	function hear(chunk: SpeechChunk): void {
		listener?.(chunk);
	}

	async function startAsync(onChunk: ChunkListener): Promise<ChunkSource> {
		await Promise.resolve();
		listener = onChunk;
		return {
			stop(): ReadonlyArray<SpeechChunk> {
				return tail;
			},
		};
	}

	return { hear, startAsync };
}

async function refuseMicrophoneAsync(): Promise<ChunkSource> {
	await Promise.resolve();
	throw new MicrophoneError("This browser was not allowed to use the microphone.");
}

interface Heard {
	readonly errors: Array<string>;
	readonly segments: Array<SegmentDraft>;
	readonly statuses: Array<SpeechEngineStatus>;
}

function createHeard(): Heard {
	return { errors: [], segments: [], statuses: [] };
}

function startListening(heard: Heard, engine: ReturnType<typeof createModelSpeechEngine>): void {
	function keepSegment(segment: SegmentDraft): void {
		heard.segments.push(segment);
	}

	function ignoreInterim(): void {
		// The model engine's gray text is not under test.
	}

	function keepError(message: string): void {
		heard.errors.push(message);
	}

	function keepStatus(status: SpeechEngineStatus): void {
		heard.statuses.push(status);
	}

	engine.start(keepSegment, ignoreInterim, keepError, keepStatus);
}

describe("model speech engine", () => {
	// Catches sentences reaching the server out of the order they were
	// spoken when a later one is quicker to transcribe.
	it("delivers sentences in the order they were spoken", async () => {
		expect.assertions(1);

		const microphone = createMicrophone([]);
		const engine = createModelSpeechEngine({
			startChunkSourceAsync: microphone.startAsync,
			transcriber: createTranscriber(true),
		});
		const heard = createHeard();

		startListening(heard, engine);
		await waitAsync(10);
		microphone.hear(makeChunk(0, 0));
		microphone.hear(makeChunk(1, 2000));
		await engine.stopAsync();

		expect(heard.segments.map((segment) => segment.text)).toStrictEqual([
			"The first sentence is slow.",
			"The second is quick.",
		]);
	});

	// Catches Stop saving the talk before the last words are text, and a
	// chunk where nothing was said becoming a blank sentence.
	it("delivers the unfinished chunk before stop resolves", async () => {
		expect.assertions(1);

		const microphone = createMicrophone([makeChunk(3, 6000)]);
		const engine = createModelSpeechEngine({
			startChunkSourceAsync: microphone.startAsync,
			transcriber: createTranscriber(true),
		});
		const heard = createHeard();

		startListening(heard, engine);
		await waitAsync(10);
		microphone.hear(makeChunk(1, 0));
		microphone.hear(makeChunk(2, 2000));
		await engine.stopAsync();

		expect(heard.segments.map((segment) => segment.text)).toStrictEqual([
			"The second is quick.",
			"The last words before stop.",
		]);
	});

	// Catches the screen showing "listening" before the model can hear.
	it("reports loading, then listening once the model is ready", async () => {
		expect.assertions(2);

		const microphone = createMicrophone([]);
		const engine = createModelSpeechEngine({
			startChunkSourceAsync: microphone.startAsync,
			transcriber: createTranscriber(true),
		});
		const heard = createHeard();

		startListening(heard, engine);
		await waitAsync(20);

		expect(heard.statuses.at(0)).toStrictEqual({ fraction: 0, kind: "loading-model" });
		expect(heard.statuses.at(-1)).toStrictEqual({ kind: "listening" });
	});

	// Catches a refused microphone leaving the presenter with a silent screen.
	it("explains a refused microphone", async () => {
		expect.assertions(1);

		const engine = createModelSpeechEngine({
			startChunkSourceAsync: refuseMicrophoneAsync,
			transcriber: createTranscriber(true),
		});
		const heard = createHeard();

		startListening(heard, engine);
		await waitAsync(20);

		expect(heard.errors).toStrictEqual(["This browser was not allowed to use the microphone."]);
	});

	// Catches a model that cannot download leaving the recorder stuck loading.
	it("explains a model that cannot be downloaded", async () => {
		expect.assertions(2);

		const microphone = createMicrophone([]);
		const engine = createModelSpeechEngine({
			startChunkSourceAsync: microphone.startAsync,
			transcriber: createTranscriber(false),
		});
		const heard = createHeard();

		startListening(heard, engine);
		await waitAsync(20);

		expect(heard.errors).toHaveLength(1);
		expect(heard.statuses).not.toContainEqual({ kind: "listening" });
	});
});
