import { createBrowserSpeechEngine, getSpeechRecognitionConstructor } from "./browser-speech-engine";

import type { SegmentDraft } from "./segment-queue";

/** Called once per finished sentence. */
export type SegmentListener = (segment: SegmentDraft) => void;

/** Called with the words heard so far in the unfinished sentence. */
export type InterimListener = (text: string) => void;

/** Called with a plain-words reason when listening has stopped for good. */
export type SpeechErrorListener = (message: string) => void;

/**
 * Turns speech into finished sentences on this device. Times are
 * milliseconds since `start` was called.
 */
export interface SpeechEngine {
	readonly start: (onSegment: SegmentListener, onInterim: InterimListener, onError: SpeechErrorListener) => void;
	/** Stops listening; resolves once the last sentence has been delivered. */
	readonly stopAsync: () => Promise<void>;
}

/**
 * Picks the speech engine this browser can run.
 *
 * @returns The browser's own recognizer, or undefined when it has none.
 */
export function createSpeechEngine(): SpeechEngine | undefined {
	const Recognition = getSpeechRecognitionConstructor();
	if (Recognition === undefined) return undefined;
	return createBrowserSpeechEngine(Recognition);
}
