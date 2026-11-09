import { useEffect, useRef, useState } from "react";
import { ORPCError } from "@orpc/client";

import { orpc } from "$orpc/client";

import { getSpeechRecognitionConstructor } from "./browser-speech-engine";
import { createSegmentQueue, splitLongDraft } from "./segment-queue";
import { createSegmentSender } from "./segment-sender";
import { createSpeechEngine } from "./speech-engine";
import { createScreenWakeLock } from "./wake-lock";

import type { SegmentDraft, SegmentQueue } from "./segment-queue";
import type { SegmentSender, SendBatchAsync } from "./segment-sender";
import type { SpeechEngine } from "./speech-engine";
import type { ScreenWakeLock } from "./wake-lock";

/**
 * Where the recording is: before, during the talk, during Q&A, or after.
 * `stopped` means the microphone is off but the talk is not saved yet.
 */
export type RecorderPhase = "ended" | "idle" | "qa" | "saving" | "starting" | "stopped" | "talk";

/** What the presenter fills in before starting. */
export interface RecordingDetails {
	readonly recordingUrl: string;
	readonly speaker: string;
	readonly title: string;
}

/** One finished sentence on the live screen, keyed by its sequence. */
export interface TranscriptLine {
	readonly sequence: number;
	readonly text: string;
}

/** The recorder's state and the actions the page can take. */
export interface Recorder {
	readonly changeDetails: (details: RecordingDetails) => void;
	readonly changePresenterCode: (code: string) => void;
	/** The form's fields. They live here, so a failed start keeps them. */
	readonly details: RecordingDetails;
	readonly elapsedMs: number;
	readonly errorMessage: string | undefined;
	readonly interimText: string;
	readonly isSpeechAvailable: boolean;
	readonly lines: ReadonlyArray<TranscriptLine>;
	readonly markQuestions: () => void;
	readonly pairCount: number | undefined;
	readonly phase: RecorderPhase;
	readonly presenterCode: string;
	readonly qaStartMs: number | undefined;
	readonly sessionId: number | undefined;
	readonly start: () => void;
	readonly stop: () => void;
}

const FLUSH_INTERVAL_MS = 4000;
const CLOCK_INTERVAL_MS = 1000;
const VISIBLE_LINES = 4;
const STOP_FLUSH_ATTEMPTS = 5;
const PRESENTER_CODE_KEY = "asked-presenter-code";

function readStoredCode(): string {
	try {
		return sessionStorage.getItem(PRESENTER_CODE_KEY) ?? "";
	} catch {
		return "";
	}
}

function storeCode(code: string): void {
	try {
		sessionStorage.setItem(PRESENTER_CODE_KEY, code);
	} catch {
		// Private mode: the code is simply typed again next time.
	}
}

const EMPTY_DETAILS: RecordingDetails = { recordingUrl: "", speaker: "", title: "" };
const UNSENT_LEFT =
	"Some sentences were not sent yet, so the talk is not saved. Check the connection, then tap Stop and save again.";

/**
 * Turns a failed call into a plain sentence for the presenter.
 *
 * @param error - What the call threw.
 * @returns A sentence that ends with a period.
 */
// oxlint-disable-next-line small-rules/no-unknown-parameters -- A catch clause only ever gives `unknown`.
function describeFailure(error: unknown): string {
	if (!(error instanceof ORPCError)) return "The phone could not reach the server.";

	if (error.code === "BAD_REQUEST") {
		return "The server did not accept these details. A recording link has to start with https://.";
	}

	return error.message;
}

function createBatchSender(presenterCode: string, sessionId: number): SendBatchAsync {
	return async function sendBatchAsync(batch): Promise<void> {
		await orpc.appendSegments.call({ presenterCode, segments: [...batch], sessionId });
	};
}

function ignoreFailure(): void {
	// Failures are already shown, or the segments stay queued for next time.
}

/**
 * Runs one recording on the presenter's phone: the speech engine, the queue
 * that sends finished sentences every few seconds, the Q&A mark, and the
 * screen wake lock. Only text leaves the phone. Use it on the client only,
 * since it reads browser storage and speech support while rendering.
 *
 * @returns The recorder's state and actions.
 */
export function useRecorder(): Recorder {
	const [phase, setPhase] = useState<RecorderPhase>("idle");
	const [presenterCode, setPresenterCode] = useState(readStoredCode);
	const [sessionId, setSessionId] = useState<number | undefined>();
	const [lines, setLines] = useState<ReadonlyArray<TranscriptLine>>([]);
	const [interimText, setInterimText] = useState("");
	const [elapsedMs, setElapsedMs] = useState(0);
	const [qaStartMs, setQaStartMs] = useState<number | undefined>();
	const [pairCount, setPairCount] = useState<number | undefined>();
	const [errorMessage, setErrorMessage] = useState<string | undefined>();
	const [details, setDetails] = useState<RecordingDetails>(EMPTY_DETAILS);

	// One recording's machinery, made in the Start tap.
	const engineRef = useRef<SpeechEngine | undefined>(undefined);
	const queueRef = useRef<SegmentQueue | undefined>(undefined);
	const senderRef = useRef<SegmentSender | undefined>(undefined);
	const wakeLockRef = useRef<ScreenWakeLock | undefined>(undefined);
	const startedAtRef = useRef(0);
	const sessionIdRef = useRef<number | undefined>(undefined);

	const isSpeechAvailable = getSpeechRecognitionConstructor() !== undefined;
	const isRecording = phase === "talk" || phase === "qa";

	useEffect(
		function runTimersWhileRecording() {
			if (!isRecording) return undefined;

			function updateClock(): void {
				setElapsedMs(performance.now() - startedAtRef.current);
			}

			function send(): void {
				senderRef.current?.flushAsync().catch(ignoreFailure);
			}

			const clockTimer = window.setInterval(updateClock, CLOCK_INTERVAL_MS);
			const sendTimer = window.setInterval(send, FLUSH_INTERVAL_MS);
			return function stopTimers(): void {
				window.clearInterval(clockTimer);
				window.clearInterval(sendTimer);
			};
		},
		[isRecording],
	);

	function changePresenterCode(code: string): void {
		setPresenterCode(code);
		storeCode(code);
	}

	function handleSegment(draft: SegmentDraft): void {
		const queue = queueRef.current;
		if (queue === undefined) return;

		for (const piece of splitLongDraft(draft)) {
			const segment = queue.add(piece);
			const line = { sequence: segment.sequence, text: segment.text };
			setLines((previous) => [...previous, line].slice(-VISIBLE_LINES));
		}
	}

	/**
	 * Stops the microphone and lets the screen sleep.
	 *
	 * @returns Resolves once the recognizer has handed over its last sentence.
	 */
	async function releaseDeviceAsync(): Promise<void> {
		const engine = engineRef.current;
		engineRef.current = undefined;
		await engine?.stopAsync();
		wakeLockRef.current?.release();
		wakeLockRef.current = undefined;
		setInterimText("");
	}

	function handleSpeechError(message: string): void {
		releaseDeviceAsync().catch(ignoreFailure);
		setErrorMessage(message);
		setPhase("stopped");
	}

	function start(): void {
		const engine = createSpeechEngine();
		if (engine === undefined) return;

		// iOS wants both inside the tap itself, before any await.
		const wakeLock = createScreenWakeLock();
		wakeLock.acquire();
		const queue = createSegmentQueue();
		engine.start(handleSegment, setInterimText, handleSpeechError);
		engineRef.current = engine;
		wakeLockRef.current = wakeLock;
		queueRef.current = queue;
		startedAtRef.current = performance.now();
		setLines([]);
		setErrorMessage(undefined);
		setPhase("starting");

		const code = presenterCode;
		const recordingUrl = details.recordingUrl.trim();
		const required = { presenterCode: code, speaker: details.speaker.trim(), title: details.title.trim() };
		const input = recordingUrl.length > 0 ? { ...required, recordingUrl } : required;

		async function openSessionAsync(): Promise<void> {
			try {
				const { id } = await orpc.startSession.call(input);
				senderRef.current = createSegmentSender(queue, createBatchSender(code, id));
				sessionIdRef.current = id;
				setSessionId(id);
				// The microphone may have been refused while this call was out.
				setPhase((current) => (current === "starting" ? "talk" : current));
			} catch (error) {
				releaseDeviceAsync().catch(ignoreFailure);
				setErrorMessage(describeFailure(error));
				setPhase("idle");
			}
		}

		openSessionAsync().catch(ignoreFailure);
	}

	function markQuestions(): void {
		const id = sessionIdRef.current;
		if (id === undefined || phase !== "talk") return;

		const offsetMs = Math.round(performance.now() - startedAtRef.current);
		setQaStartMs(offsetMs);
		setPhase("qa");

		async function saveMarkAsync(sessionNumber: number): Promise<void> {
			try {
				const result = await orpc.markQaStart.call({ offsetMs, presenterCode, sessionId: sessionNumber });
				setQaStartMs(result.qaStartMs);
			} catch (error) {
				setErrorMessage(`The Q&A mark was not saved. ${describeFailure(error)}`);
			}
		}

		saveMarkAsync(id).catch(ignoreFailure);
	}

	/**
	 * Waits for the last sentence, sends everything, and only then ends the
	 * session, because the server refuses sentences for an ended session.
	 *
	 * @param id - The session to end.
	 * @returns Resolves once the talk is saved or the error is shown.
	 */
	async function saveAsync(id: number): Promise<void> {
		try {
			await releaseDeviceAsync();
			await senderRef.current?.drainAsync(STOP_FLUSH_ATTEMPTS);

			if ((queueRef.current?.size() ?? 0) > 0) {
				setErrorMessage(UNSENT_LEFT);
				setPhase("stopped");
				return;
			}

			const result = await orpc.endSession.call({ presenterCode, sessionId: id });
			setPairCount(result.pairCount);
			setPhase("ended");
		} catch (error) {
			setErrorMessage(`The talk is not saved yet. ${describeFailure(error)} Tap Stop and save to try again.`);
			setPhase("stopped");
		}
	}

	function stop(): void {
		const id = sessionIdRef.current;
		if (id === undefined) {
			releaseDeviceAsync().catch(ignoreFailure);
			setPhase("idle");
			return;
		}

		setPhase("saving");
		saveAsync(id).catch(ignoreFailure);
	}

	return {
		changeDetails: setDetails,
		changePresenterCode,
		details,
		elapsedMs,
		errorMessage,
		interimText,
		isSpeechAvailable,
		lines,
		markQuestions,
		pairCount,
		phase,
		presenterCode,
		qaStartMs,
		sessionId,
		start,
		stop,
	};
}
