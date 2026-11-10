import { SectionRow } from "$components/section-row";

import { LiveScreen } from "./live-screen";
import { NO_SPEECH_NOTICE, RECORDER_NOTE } from "./recording-notice";
import { SavedScreen } from "./saved-screen";
import { StartForm } from "./start-form";

import type { ReactNode } from "react";

import type { Recorder } from "./use-recorder";

export interface RecorderViewProperties {
	recorder: Recorder;
}

/**
 * The recorder's three steps: the form, the live screen, and the saved note.
 *
 * @param properties - The recorder whose step to show.
 * @returns The step the recorder is on.
 */
export function RecorderView({ recorder }: Readonly<RecorderViewProperties>): ReactNode {
	if (recorder.phase === "ended") return <SavedScreen recorder={recorder} />;
	if (recorder.phase !== "idle") return <LiveScreen recorder={recorder} />;

	return (
		<SectionRow head="Record a talk" note={RECORDER_NOTE}>
			{recorder.isSpeechAvailable ? (
				<StartForm recorder={recorder} />
			) : (
				<p className="caption">{NO_SPEECH_NOTICE}</p>
			)}
		</SectionRow>
	);
}
