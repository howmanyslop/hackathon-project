/** A stretch of speech for the model, at 16 kHz mono. */
export interface SpeechChunk {
	/** Milliseconds from the first sample ever pushed to the chunk's end. */
	readonly endMs: number;
	readonly samples: Float32Array;
	/** Milliseconds from the first sample ever pushed to the chunk's start. */
	readonly startMs: number;
}

/**
 * Splits a stream of samples into stretches of speech:
 *
 * - Loudness is measured in 30 ms frames.
 * - A chunk starts with the first loud frame.
 * - It ends after 600 ms of quiet once it holds at least 1.5 seconds.
 * - At 9 seconds it is cut at the quietest frame of its last 1.5 seconds,
 *   so a word is not split mid-sound; the rest starts the next chunk.
 * - A chunk that never got loud is dropped.
 * - "Loud" means above the room's noise floor times three, and never below a
 *   fixed minimum. The floor follows quiet frames quickly and creeps up over
 *   a few minutes when the room stays loud.
 */
export interface SpeechChunker {
	/** Takes the next 16 kHz samples; returns any chunks they finished. */
	readonly add: (samples: Float32Array) => ReadonlyArray<SpeechChunk>;
	/** Returns the unfinished chunk, if it got loud, and starts over. */
	readonly flush: () => ReadonlyArray<SpeechChunk>;
}

const SAMPLES_PER_MS = 16;
const FRAME_SAMPLES = 30 * SAMPLES_PER_MS;
const QUIET_FRAMES_TO_END = 20;
const MIN_CHUNK_FRAMES = 50;
const MAX_CHUNK_FRAMES = 300;
const CUT_SEARCH_FRAMES = 50;

/** About -44 dBFS: quieter than speech at arm's length from a phone. */
const MIN_THRESHOLD = 0.006;
const FLOOR_FACTOR = 3;
const FLOOR_FOLLOW_QUIET = 0.05;
const FLOOR_FOLLOW_LOUD = 0.0001;

interface Frame {
	readonly isLoud: boolean;
	readonly level: number;
	readonly samples: Float32Array;
}

function measureLevel(samples: Float32Array): number {
	let sum = 0;
	for (const sample of samples) {
		sum += sample * sample;
	}

	return Math.sqrt(sum / Math.max(1, samples.length));
}

function joinParts(parts: ReadonlyArray<Float32Array>): Float32Array {
	let length = 0;
	for (const part of parts) {
		length += part.length;
	}

	const joined = new Float32Array(length);
	let offset = 0;
	for (const part of parts) {
		joined.set(part, offset);
		offset += part.length;
	}

	return joined;
}

function getSamples(frames: ReadonlyArray<Frame>): Array<Float32Array> {
	return frames.map((frame) => frame.samples);
}

function countTrailingQuiet(frames: ReadonlyArray<Frame>): number {
	let count = 0;
	for (let index = frames.length - 1; index >= 0 && !frames[index].isLoud; index -= 1) {
		count += 1;
	}

	return count;
}

function toChunk(parts: ReadonlyArray<Float32Array>, startSample: number): SpeechChunk {
	const samples = joinParts(parts);
	return {
		endMs: (startSample + samples.length) / SAMPLES_PER_MS,
		samples,
		startMs: startSample / SAMPLES_PER_MS,
	};
}

/**
 * Finds where to cut a full chunk: its quietest frame in the last stretch,
 * the latest one on a tie.
 *
 * @param frames - The chunk's frames.
 * @returns How many frames go into the finished chunk.
 */
function findCut(frames: ReadonlyArray<Frame>): number {
	let quietest = frames.length - 1;
	for (let index = frames.length - CUT_SEARCH_FRAMES; index < frames.length; index += 1) {
		if (frames[index].level <= frames[quietest].level) {
			quietest = index;
		}
	}

	return quietest + 1;
}

/**
 * Creates a chunker for one recording.
 *
 * @returns A chunker that keeps its clock from the first sample pushed.
 */
export function createSpeechChunker(): SpeechChunker {
	let partial = new Float32Array(0);
	/** Samples seen in whole frames so far, which is the clock. */
	let framedSamples = 0;
	let noiseFloor = MIN_THRESHOLD / FLOOR_FACTOR;

	let frames: Array<Frame> = [];
	let chunkStartSample = 0;

	function measure(samples: Float32Array): Frame {
		const level = measureLevel(samples);
		const isLoud = level > Math.max(MIN_THRESHOLD, noiseFloor * FLOOR_FACTOR);
		const follow = isLoud ? FLOOR_FOLLOW_LOUD : FLOOR_FOLLOW_QUIET;
		noiseFloor += (level - noiseFloor) * follow;
		return { isLoud, level, samples };
	}

	/**
	 * Adds one frame to the chunk being built.
	 *
	 * @param frame - The next 30 ms.
	 * @param frameStart - Where the frame starts, in samples.
	 * @returns The chunk this frame finished, if any.
	 */
	function addFrame(frame: Frame, frameStart: number): SpeechChunk | undefined {
		if (frames.length === 0) {
			if (!frame.isLoud) return undefined;
			chunkStartSample = frameStart;
		}

		frames.push(frame);

		const isQuietLongEnough = countTrailingQuiet(frames) >= QUIET_FRAMES_TO_END;
		if (isQuietLongEnough && frames.length >= MIN_CHUNK_FRAMES) {
			const chunk = toChunk(getSamples(frames), chunkStartSample);
			frames = [];
			return chunk;
		}

		if (frames.length < MAX_CHUNK_FRAMES) return undefined;

		const cut = findCut(frames);
		const chunk = toChunk(getSamples(frames.slice(0, cut)), chunkStartSample);
		const rest = frames.slice(cut);
		chunkStartSample += chunk.samples.length;
		frames = rest.some((restFrame) => restFrame.isLoud) ? rest : [];
		return chunk;
	}

	function add(samples: Float32Array): ReadonlyArray<SpeechChunk> {
		const joined = new Float32Array(partial.length + samples.length);
		joined.set(partial);
		joined.set(samples, partial.length);

		const finished: Array<SpeechChunk> = [];
		let offset = 0;
		while (offset + FRAME_SAMPLES <= joined.length) {
			const frame = measure(joined.slice(offset, offset + FRAME_SAMPLES));
			const chunk = addFrame(frame, framedSamples);
			if (chunk !== undefined) {
				finished.push(chunk);
			}

			framedSamples += FRAME_SAMPLES;
			offset += FRAME_SAMPLES;
		}

		partial = joined.slice(offset);
		return finished;
	}

	function flush(): ReadonlyArray<SpeechChunk> {
		const tail = partial;
		partial = new Float32Array(0);
		framedSamples += tail.length;

		if (frames.length === 0) {
			return [];
		}

		// The open chunk always runs up to the tail, so the tail joins it.
		const chunk = toChunk([...getSamples(frames), tail], chunkStartSample);
		frames = [];
		return [chunk];
	}

	return { add, flush };
}
