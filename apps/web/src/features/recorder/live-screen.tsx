import { SectionRow } from "$components/section-row";
import { Button } from "$components/ui/button";
import { formatTimeLabel } from "$lib/time-label";

import { LiveTranscript } from "./live-transcript";
import { QuestionsControl } from "./questions-control";
import { MODEL_NOTICE, RECORDING_NOTICE } from "./recording-notice";

import type { ReactNode } from "react";

import type { Readout } from "$components/readout-stack";

import type { Recorder } from "./use-recorder";

export interface LiveScreenProperties {
	recorder: Recorder;
}

/**
 * Step two on the phone: the status, the minutes so far, the last few
 * sentences, and the Q&A and stop buttons.
 *
 * @param properties - The running recorder.
 * @returns A notebook row with the transcript, controls, and readouts.
 */
export function LiveScreen({ recorder }: Readonly<LiveScreenProperties>): ReactNode {
	const minutes = String(Math.floor(recorder.elapsedMs / 60_000));
	const isSaving = recorder.phase === "saving";
	const isRecording = recorder.phase === "talk" || recorder.phase === "qa";
	const isLoadingModel = recorder.modelProgress !== undefined;
	const isListening = isRecording && !isLoadingModel;
	let status = isListening ? "Listening" : "Not listening";

	if (recorder.phase === "starting") {
		status = "Starting";
	}

	const statusReadout: Readout = {
		isLive: isListening,
		label: "Status",
		value: `${status} ${formatTimeLabel(recorder.elapsedMs)}`,
	};

	// The readout's value is set in IBM Plex Mono, so the percentage goes there.
	const modelReadout: Readout = {
		label: "Getting the speech model ready",
		value: `${String(Math.round((recorder.modelProgress ?? 0) * 100))}%`,
	};
	const notice = recorder.engineKind === "model" ? MODEL_NOTICE : RECORDING_NOTICE;

	function handleStop(): void {
		recorder.stop();
	}

	return (
		<SectionRow
			head="Recording"
			headline={{ label: "minutes recorded", value: minutes }}
			note="fig. 1 — the last few sentences the phone heard. Gray words are still being worked out. Tap Start Q&A when the questions begin, so they are easy to find later."
			readouts={isLoadingModel ? [modelReadout] : [statusReadout]}
		>
			<LiveTranscript recorder={recorder} />
			<div className="action-row">
				<QuestionsControl recorder={recorder} />
				<Button
					className="primary-button"
					disabled={isSaving || recorder.phase === "starting"}
					type="button"
					variant="outline"
					onClick={handleStop}
				>
					{isSaving ? "Saving…" : "Stop and save"}
				</Button>
			</div>
			<p className="notice">{notice}</p>
		</SectionRow>
	);
}
