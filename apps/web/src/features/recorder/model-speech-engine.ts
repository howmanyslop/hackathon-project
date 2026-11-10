import { MicrophoneError } from "./audio/microphone";

import type { ChunkListener, ChunkSource } from "./audio/speech-chunks";
import type { ModelTranscriber } from "./moonshine/model-transcriber";
import type { SpeechChunk } from "./speech-chunker";
import type {
	InterimListener,
	SegmentListener,
	SpeechEngine,
	SpeechErrorListener,
	StatusListener,
} from "./speech-engine";

/** Opens the microphone and hands over stretches of speech. */
export type StartChunkSourceAsync = (onChunk: ChunkListener) => Promise<ChunkSource>;

/** What the model engine is built from, so tests can swap in fakes. */
export interface ModelEngineParts {
	readonly startChunkSourceAsync: StartChunkSourceAsync;
	readonly transcriber: ModelTranscriber;
}

/** The longest Stop waits for the last chunks to be turned into text. */
const STOP_WAIT_MS = 15_000;

const MICROPHONE_FAILED = "The microphone could not be opened. Close other apps that use it, then start again.";
const MODEL_MISSING = "The speech model could not be downloaded. Check the connection, then start again.";
const MODEL_FAILED = "The speech model stopped working. Reload the page, then start again.";

/** Shown in gray while a stretch of speech is being turned into text. */
const WORKING = "…";

function ignoreFailure(): void {
	// Failures are already reported through the error listener.
}

async function waitAsync(milliseconds: number): Promise<void> {
	await new Promise(function wait(resolve) {
		setTimeout(resolve, milliseconds);
	});
}

/**
 * The fallback for browsers without built-in speech recognition: a small
 * speech model on this phone. The microphone opens and the model downloads
 * at the same time, so nothing said while it loads is lost. Each stretch of
 * speech is turned into text one at a time, in order, and becomes a segment.
 *
 * @param parts - The microphone's chunk source and the model.
 * @returns An engine that can be started and stopped once per recording.
 */
export function createModelSpeechEngine({ startChunkSourceAsync, transcriber }: ModelEngineParts): SpeechEngine {
	let source: ChunkSource | undefined;
	let queue = Promise.resolve();
	let isStopped = false;
	let hasFailed = false;
	let isDisposed = false;
	let enqueueChunk: ChunkListener | undefined;

	/**
	 * Whether to drop work: the model failed, or Stop gave up waiting. Both
	 * can change while a chunk is being turned into text.
	 *
	 * @returns True once nothing more should be delivered.
	 */
	function isFinished(): boolean {
		return hasFailed || isDisposed;
	}

	function start(
		onSegment: SegmentListener,
		onInterim: InterimListener,
		onError: SpeechErrorListener,
		onStatus: StatusListener,
	): void {
		const startedAt = performance.now();
		/** When the microphone opened, in milliseconds since start. */
		let captureOffsetMs = 0;
		let isModelReady = false;

		function fail(message: string): void {
			if (hasFailed || isStopped) return;
			hasFailed = true;
			source?.stop();
			source = undefined;
			onInterim("");
			onError(message);
		}

		function announceIfListening(): void {
			if (isModelReady && source !== undefined && !hasFailed) {
				onStatus({ kind: "listening" });
			}
		}

		function reportProgress(fraction: number): void {
			if (!isModelReady && !hasFailed) {
				onStatus({ fraction, kind: "loading-model" });
			}
		}

		async function loadModelAsync(): Promise<void> {
			try {
				await transcriber.loadAsync(reportProgress);
				isModelReady = true;
				announceIfListening();
			} catch {
				fail(MODEL_MISSING);
			}
		}

		async function deliverAsync(chunk: SpeechChunk): Promise<void> {
			if (isFinished()) return;

			onInterim(WORKING);

			try {
				const heard = await transcriber.transcribeAsync(chunk.samples);
				const text = heard.trim();
				if (!isFinished() && text.length > 0) {
					onSegment({
						endMs: Math.round(chunk.endMs + captureOffsetMs),
						startMs: Math.round(chunk.startMs + captureOffsetMs),
						text,
					});
				}
			} catch {
				fail(MODEL_FAILED);
			}

			onInterim("");
		}

		function enqueue(chunk: SpeechChunk): void {
			queue = queue.then(async function deliverNextAsync(): Promise<void> {
				return deliverAsync(chunk);
			});
		}

		enqueueChunk = enqueue;

		async function openMicrophoneAsync(): Promise<void> {
			try {
				const opened = await startChunkSourceAsync(enqueue);
				if (isStopped || hasFailed) {
					opened.stop();
					return;
				}

				captureOffsetMs = performance.now() - startedAt;
				source = opened;
				announceIfListening();
			} catch (error) {
				fail(error instanceof MicrophoneError ? error.message : MICROPHONE_FAILED);
			}
		}

		onStatus({ fraction: 0, kind: "loading-model" });
		// The model must be ready before any chunk is turned into text.
		queue = loadModelAsync();
		// Opened inside the tap, which some browsers need for the microphone.
		openMicrophoneAsync().catch(ignoreFailure);
	}

	/**
	 * Turns the microphone off, then waits until every chunk heard so far is
	 * text (or 15 seconds pass).
	 *
	 * @returns Resolves once the last sentence has been delivered.
	 */
	async function stopAsync(): Promise<void> {
		if (isStopped) return;
		isStopped = true;

		// The unfinished chunk still holds the last words.
		const opened = source;
		source = undefined;
		const unfinished = opened?.stop() ?? [];

		for (const chunk of unfinished) {
			enqueueChunk?.(chunk);
		}

		await Promise.race([queue, waitAsync(STOP_WAIT_MS)]);
		isDisposed = true;
		transcriber.dispose();
	}

	return { start, stopAsync };
}
