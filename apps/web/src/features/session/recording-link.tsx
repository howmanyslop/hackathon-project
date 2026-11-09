import { createRecordingLink } from "$lib/recording-link";
import { formatTimeLabel, toWholeSeconds } from "$lib/time-label";

import type { ReactNode } from "react";

export interface RecordingLinkProperties {
	recordingUrl: string | undefined;
	startMs: number;
}

/**
 * "Open the recording at 41:12", when the session has a recording link.
 *
 * @param properties - The session's recording link and the moment.
 * @returns A link that opens the video at that second, or nothing.
 */
export function RecordingLink({ recordingUrl, startMs }: Readonly<RecordingLinkProperties>): ReactNode {
	if (recordingUrl === undefined) return undefined;

	return (
		<a href={createRecordingLink(recordingUrl, toWholeSeconds(startMs))} rel="noreferrer" target="_blank">
			{`Open the recording at ${formatTimeLabel(startMs)}`}
		</a>
	);
}
