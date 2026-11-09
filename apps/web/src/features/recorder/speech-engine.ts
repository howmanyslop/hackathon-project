import { startSpeechChunksAsync } from "./audio/speech-chunks";
import { createBrowserSpeechEngine, getSpeechRecognitionConstructor } from "./browser-speech-engine";
import { createModelSpeechEngine } from "./model-speech-engine";
import { createModelTranscriber } from "./moonshine/model-transcriber";

import type { SegmentDraft } from "./segment-queue";

/** Called once per finished sentence. */
export type SegmentListener = (segment: SegmentDraft) => void;

/** Called with the words heard so far in the unfinished sentence. */
export type InterimListener = (text: string) => void;

/** Called with a plain-words reason when listening has stopped for good. */
export type SpeechErrorListener = (message: string) => void;

/** The speech model is downloading; `fraction` runs from 0 to 1. */
export interface LoadingModelStatus {
	readonly fraction: number;
	readonly kind: "loading-model";
}

/** The engine is hearing the room and turning it into text. */
export interface ListeningStatus {
	readonly kind: "listening";
}

/** Where an engine is before it listens. The browser's own never loads. */
export type SpeechEngineStatus = ListeningStatus | LoadingModelStatus;

/** Called when the engine's status changes. */
export type StatusListener = (status: SpeechEngineStatus) => void;

/**
 * Turns speech into finished sentences on this device. Times are
 * milliseconds since `start` was called.
 */
export interface SpeechEngine {
	readonly start: (
		onSegment: SegmentListener,
		onInterim: InterimListener,
		onError: SpeechErrorListener,
		onStatus: StatusListener,
	) => void;
	/** Stops listening; resolves once the last sentence has been delivered. */
	readonly stopAsync: () => Promise<void>;
}

/**
 * Which engine a browser runs: its own recognizer, or a small speech model
 * on the phone.
 */
export type SpeechEngineKind = "browser" | "model";

/**
 * Whether this browser can run the speech model: it needs an audio worklet,
 * WebAssembly, and a microphone (which needs https).
 *
 * @returns True when the model engine can run.
 */
function canRunModel(): boolean {
	return "AudioWorkletNode" in window && "WebAssembly" in globalThis && "mediaDevices" in navigator;
}

/**
 * Picks the engine: the browser's own recognizer when it has one, otherwise
 * the speech model. `?engine=model` in the address picks the model, for
 * testing.
 *
 * @returns The engine's kind, or undefined when neither can run.
 */
export function getSpeechEngineKind(): SpeechEngineKind | undefined {
	if (typeof window === "undefined") return undefined;

	const hasRecognizer = getSpeechRecognitionConstructor() !== undefined;
	const isModelForced = new URLSearchParams(window.location.search).get("engine") === "model";
	if (hasRecognizer && !isModelForced) return "browser";
	if (canRunModel()) return "model";
	return hasRecognizer ? "browser" : undefined;
}

/**
 * Creates the speech engine this browser can run.
 *
 * @returns The browser's own recognizer, the speech model, or undefined when
 *   neither can run.
 */
export function createSpeechEngine(): SpeechEngine | undefined {
	const kind = getSpeechEngineKind();
	if (kind === "model") {
		return createModelSpeechEngine({
			startChunkSourceAsync: startSpeechChunksAsync,
			transcriber: createModelTranscriber(),
		});
	}

	const Recognition = getSpeechRecognitionConstructor();
	if (kind === undefined || Recognition === undefined) return undefined;
	return createBrowserSpeechEngine(Recognition);
}
