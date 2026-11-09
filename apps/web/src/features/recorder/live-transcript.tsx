import type { ReactNode } from "react";

import type { Recorder } from "./use-recorder";

export interface LiveTranscriptProperties {
	recorder: Recorder;
}

/**
 * The last few sentences the phone heard, with the unfinished one in gray.
 * Screen readers hear new lines as they arrive.
 *
 * @param properties - The running recorder.
 * @returns The transcript well.
 */
export function LiveTranscript({ recorder }: Readonly<LiveTranscriptProperties>): ReactNode {
	const isQuiet = recorder.lines.length === 0 && recorder.interimText.length === 0;

	return (
		<div aria-live="polite" className="well grid gap-1 p-3">
			{isQuiet ? (
				<p className="quiet body-text">{"Start talking. The words appear here as the phone hears them."}</p>
			) : null}
			{recorder.lines.map((line) => (
				<p key={line.sequence} className="body-text">
					{line.text}
				</p>
			))}
			{recorder.interimText.length > 0 ? <p className="body-text quiet">{recorder.interimText}</p> : null}
		</div>
	);
}
