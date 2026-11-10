import { createSpeechChunker } from "../speech-chunker";
import { startCaptureAsync } from "./capture";

import type { SpeechChunk } from "../speech-chunker";

/** Receives each finished stretch of speech, in order. */
export type ChunkListener = (chunk: SpeechChunk) => void;

/** A running microphone that hands over stretches of speech. */
export interface ChunkSource {
	/** Turns the microphone off; returns the unfinished chunk, if any. */
	readonly stop: () => ReadonlyArray<SpeechChunk>;
}

/**
 * Opens the microphone and splits what it hears into stretches of speech.
 *
 * @param onChunk - Receives each chunk as soon as it is finished.
 * @returns A handle whose `stop` turns the microphone off.
 * @rejects {Error} With a sentence for the presenter when the microphone or
 *   the audio cannot start.
 */
export async function startSpeechChunksAsync(onChunk: ChunkListener): Promise<ChunkSource> {
	const chunker = createSpeechChunker();

	function takeSamples(samples: Float32Array): void {
		const finished = chunker.add(samples);
		for (const chunk of finished) {
			onChunk(chunk);
		}
	}

	const capture = await startCaptureAsync(takeSamples);

	function stop(): ReadonlyArray<SpeechChunk> {
		capture.stop();
		return chunker.flush();
	}

	return { stop };
}
