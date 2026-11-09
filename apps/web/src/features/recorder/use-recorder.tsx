import { useEffect, useRef, useState } from "react";
import { ORPCError } from "@orpc/client";

import { orpc } from "$orpc/client";

import { createSegmentQueue, splitLongDraft } from "./segment-queue";
import { createSegmentSender } from "./segment-sender";
import { createSpeechEngine, getSpeechEngineKind } from "./speech-engine";
import { createScreenWakeLock } from "./wake-lock";

import type { RefObject } from "react";

import type { SegmentDraft, SegmentQueue } from "./segment-queue";
import type { SegmentSender, SendBatchAsync } from "./segment-sender";
import type { SpeechEngine, SpeechEngineKind, SpeechEngineStatus } from "./speech-engine";
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
	/** Which engine this browser runs, or undefined when it has none. */
	readonly engineKind: SpeechEngineKind | undefined;
	readonly errorMessage: string | undefined;
	readonly interimText: string;
	readonly isSpeechAvailable: boolean;
	readonly lines: ReadonlyArray<TranscriptLine>;
	readonly markQuestions: () => void;
	/** From 0 to 1 while the speech model loads; otherwise undefined. */
	readonly modelProgress: number | undefined;
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

/** One recording's machinery, made in the Start tap. */
interface Machinery {
	engine: SpeechEngine | undefined;
	queue: SegmentQueue | undefined;
	sender: SegmentSender | undefined;
	sessionId: number | undefined;
	startedAt: number;
	wakeLock: ScreenWakeLock | undefined;
}

function createMachinery(): Machinery {
	return {
		engine: undefined,
		queue: undefined,
		sender: undefined,
		sessionId: undefined,
		startedAt: 0,
		wakeLock: undefined,
	};
}

/**
 * The machinery, made on first use. Call it from handlers and effects, not
 * while rendering.
 *
 * @param machineryRef - The ref that holds it.
 * @returns The same object for the life of the component.
 */
function getMachinery(machineryRef: RefObject<Machinery | undefined>): Machinery {
	machineryRef.current ??= createMachinery();
	return machineryRef.current;
}

interface StartInput {
	readonly presenterCode: string;
	readonly recordingUrl?: string;
	readonly speaker: string;
	readonly title: string;
}

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

function getModelProgress(status: SpeechEngineStatus): number | undefined {
	return status.kind === "loading-model" ? status.fraction : undefined;
}

/**
 * The microphone may have been refused while the session was being opened.
 *
 * @param current - The phase when the failure arrived.
 * @returns The talk screen if it was still starting, otherwise unchanged.
 */
function leaveStarting(current: RecorderPhase): RecorderPhase {
	return current === "starting" ? "talk" : current;
}

function getStartInput(presenterCode: string, details: RecordingDetails): StartInput {
	const recordingUrl = details.recordingUrl.trim();
	const required = { presenterCode, speaker: details.speaker.trim(), title: details.title.trim() };
	return recordingUrl.length > 0 ? { ...required, recordingUrl } : required;
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
	const [modelProgress, setModelProgress] = useState<number | undefined>();

	const machineryRef = useRef<Machinery | undefined>(undefined);

	const engineKind = getSpeechEngineKind();
	const isSpeechAvailable = engineKind !== undefined;
	const isRecording = phase === "talk" || phase === "qa";

	useEffect(
		function runTimersWhileRecording() {
			if (!isRecording) return undefined;

			function updateClock(): void {
				setElapsedMs(performance.now() - getMachinery(machineryRef).startedAt);
			}

			function send(): void {
				getMachinery(machineryRef).sender?.flushAsync().catch(ignoreFailure);
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
		const { queue } = getMachinery(machineryRef);
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
		const { engine } = getMachinery(machineryRef);
		getMachinery(machineryRef).engine = undefined;
		await engine?.stopAsync();
		getMachinery(machineryRef).wakeLock?.release();
		getMachinery(machineryRef).wakeLock = undefined;
		setInterimText("");
		setModelProgress(undefined);
	}

	function handleStatus(status: SpeechEngineStatus): void {
		setModelProgress(getModelProgress(status));
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
		setModelProgress(undefined);
		engine.start(handleSegment, setInterimText, handleSpeechError, handleStatus);
		getMachinery(machineryRef).engine = engine;
		getMachinery(machineryRef).wakeLock = wakeLock;
		getMachinery(machineryRef).queue = queue;
		getMachinery(machineryRef).startedAt = performance.now();
		setLines([]);
		setErrorMessage(undefined);
		setPhase("starting");

		const code = presenterCode;
		const input = getStartInput(code, details);

		async function openSessionAsync(): Promise<void> {
			try {
				const { id } = await orpc.startSession.call(input);
				getMachinery(machineryRef).sender = createSegmentSender(queue, createBatchSender(code, id));
				getMachinery(machineryRef).sessionId = id;
				setSessionId(id);
				setPhase(leaveStarting);
			} catch (error) {
				releaseDeviceAsync().catch(ignoreFailure);
				setErrorMessage(describeFailure(error));
				setPhase("idle");
			}
		}

		openSessionAsync().catch(ignoreFailure);
	}

	function markQuestions(): void {
		const id = getMachinery(machineryRef).sessionId;
		if (id === undefined || phase !== "talk") return;

		const offsetMs = Math.round(performance.now() - getMachinery(machineryRef).startedAt);
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
			await getMachinery(machineryRef).sender?.drainAsync(STOP_FLUSH_ATTEMPTS);

			if ((getMachinery(machineryRef).queue?.size() ?? 0) > 0) {
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
		const id = getMachinery(machineryRef).sessionId;
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
		engineKind,
		errorMessage,
		interimText,
		isSpeechAvailable,
		lines,
		markQuestions,
		modelProgress,
		pairCount,
		phase,
		presenterCode,
		qaStartMs,
		sessionId,
		start,
		stop,
	};
}
