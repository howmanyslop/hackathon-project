import { Button } from "$components/ui/button";
import { formatTimeLabel } from "$lib/time-label";

import { REPEAT_QUESTION_HINT } from "./recording-notice";

import type { ReactNode } from "react";

import type { Recorder } from "./use-recorder";

export interface QuestionsControlProperties {
	recorder: Recorder;
}

/**
 * The "Start Q&A" button, which turns into a quiet note of when Q&A began.
 * Both carry the hint to repeat each question, since the phone hears the
 * presenter far better than the room.
 *
 * @param properties - The running recorder.
 * @returns The button or the note.
 */
export function QuestionsControl({ recorder }: Readonly<QuestionsControlProperties>): ReactNode {
	function handleStartQuestions(): void {
		recorder.markQuestions();
	}

	if (recorder.qaStartMs !== undefined) {
		return (
			<p className="quiet body-text">
				{`Q&A started at ${formatTimeLabel(recorder.qaStartMs)}. ${REPEAT_QUESTION_HINT}`}
			</p>
		);
	}

	return (
		<>
			<Button
				className="primary-button"
				disabled={recorder.phase !== "talk"}
				type="button"
				onClick={handleStartQuestions}
			>
				{"Start Q&A"}
			</Button>
			<p className="quiet body-text">{REPEAT_QUESTION_HINT}</p>
		</>
	);
}
