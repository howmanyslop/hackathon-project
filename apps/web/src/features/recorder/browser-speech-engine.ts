import type { InterimListener, SegmentListener, SpeechEngine, SpeechErrorListener } from "./speech-engine";

// The parts of the Web Speech API this file uses. TypeScript's DOM library
// does not declare SpeechRecognition, so they are written out here.

interface RecognitionAlternative {
	readonly transcript: string;
}

interface RecognitionResult {
	readonly isFinal: boolean;
	readonly length: number;
	readonly [index: number]: RecognitionAlternative | undefined;
}

interface RecognitionResultList {
	readonly length: number;
	readonly [index: number]: RecognitionResult | undefined;
}

interface RecognitionResultEvent extends Event {
	readonly resultIndex: number;
	readonly results: RecognitionResultList;
}

interface RecognitionErrorEvent extends Event {
	readonly error: string;
}

interface Recognition extends EventTarget {
	abort(): void;
	continuous: boolean;
	interimResults: boolean;
	lang: string;
	start(): void;
	stop(): void;
}

/** The SpeechRecognition constructor, under either of its names. */
export type RecognitionConstructor = new () => Recognition;

/** The window, seen through the two names the recognizer goes by. */
interface SpeechWindow {
	readonly document: Document;
	readonly SpeechRecognition?: unknown;
	readonly webkitSpeechRecognition?: unknown;
}

function isRecognitionConstructor(value: unknown): value is RecognitionConstructor {
	return typeof value === "function";
}

function isResultEvent(event: Event): event is RecognitionResultEvent {
	return "results" in event && "resultIndex" in event;
}

function isErrorEvent(event: Event): event is RecognitionErrorEvent {
	return "error" in event && typeof event.error === "string";
}

/**
 * Finds the browser's speech recognizer.
 *
 * @returns The constructor, or undefined when there is no recognizer.
 */
export function getSpeechRecognitionConstructor(): RecognitionConstructor | undefined {
	if (typeof window === "undefined") return undefined;

	const speechWindow: SpeechWindow = window;
	const candidate = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
	return isRecognitionConstructor(candidate) ? candidate : undefined;
}

const PERMISSION_ERRORS = new Set(["not-allowed", "service-not-allowed"]);
const STOP_WAIT_MS = 2500;

/**
 * The browser's own recognizer. Each final result becomes one segment, timed
 * from when its first words appeared to when it became final. Safari on
 * iPhone ends recognition often, so it starts again until `stop` is called.
 *
 * @param RecognitionClass - The recognizer's constructor.
 * @returns An engine that can be started and stopped once per recording.
 */
export function createBrowserSpeechEngine(RecognitionClass: RecognitionConstructor): SpeechEngine {
	let recognition: Recognition | undefined;
	let isRecording = false;
	let startedAt = 0;
	const firstHeardAt = new Map<number, number>();
	let lastFinalText = "";

	function now(): number {
		return Math.round(performance.now() - startedAt);
	}

	/**
	 * Notes when a result's first words appeared, and turns a final result
	 * into a segment.
	 *
	 * @param index - The result's place in this recognition session.
	 * @param result - The result, if the browser sent one.
	 * @param onSegment - Receives the finished segment.
	 * @returns The unfinished words, or "" once the result is final.
	 */
	function takeResult(index: number, result: RecognitionResult | undefined, onSegment: SegmentListener): string {
		const text = result?.[0]?.transcript.trim() ?? "";
		if (result === undefined || text.length === 0) return "";

		const startMs = firstHeardAt.get(index) ?? now();
		if (!result.isFinal) {
			firstHeardAt.set(index, startMs);
			return text;
		}

		firstHeardAt.delete(index);

		// Chrome on Android sends each finished sentence twice in a row.
		if (text === lastFinalText) return "";
		lastFinalText = text;

		onSegment({ endMs: Math.max(startMs, now()), startMs, text });
		return "";
	}

	function start(onSegment: SegmentListener, onInterim: InterimListener, onError: SpeechErrorListener): void {
		const instance = new RecognitionClass();
		instance.continuous = true;
		instance.interimResults = true;
		instance.lang = "en-US";
		recognition = instance;
		isRecording = true;
		startedAt = performance.now();
		firstHeardAt.clear();
		lastFinalText = "";

		function handleResult(resultEvent: Event): void {
			if (!isResultEvent(resultEvent)) return;

			const interimParts: Array<string> = [];
			for (let index = resultEvent.resultIndex; index < resultEvent.results.length; index += 1) {
				const interim = takeResult(index, resultEvent.results[index], onSegment);
				if (interim.length > 0) {
					interimParts.push(interim);
				}
			}

			onInterim(interimParts.join(" "));
		}

		function handleEnd(): void {
			// A new session numbers its results from zero again.
			firstHeardAt.clear();
			lastFinalText = "";
			onInterim("");

			if (!isRecording) return;

			try {
				instance.start();
			} catch {
				// Already starting again; nothing to do.
			}
		}

		function handleError(event: Event): void {
			if (!isErrorEvent(event) || !PERMISSION_ERRORS.has(event.error)) return;
			isRecording = false;
			instance.abort();
			onError(
				"This browser was not allowed to use the microphone. Allow it in the site settings, then start again.",
			);
		}

		instance.addEventListener("result", handleResult);
		instance.addEventListener("end", handleEnd);
		instance.addEventListener("error", handleError);
		instance.start();
	}

	/**
	 * Stops listening. The browser delivers the last final result after
	 * `stop`, just before `end`, so this waits for `end` (or gives up after a
	 * few seconds).
	 *
	 * @returns Resolves once the last sentence is in.
	 */
	async function stopAsync(): Promise<void> {
		const instance = recognition;
		isRecording = false;
		recognition = undefined;

		if (instance === undefined) return;

		const ended = new Promise<void>(function waitForEnd(resolve) {
			function finish(): void {
				resolve();
			}

			instance.addEventListener("end", finish, { once: true });
			window.setTimeout(finish, STOP_WAIT_MS);
		});

		instance.stop();
		await ended;
	}

	return { start, stopAsync };
}
