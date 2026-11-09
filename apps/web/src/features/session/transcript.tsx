import { formatTimeLabel } from "$lib/time-label";

import { RecordingLink } from "./recording-link";

import type { ReactNode } from "react";

import type { SessionDetail } from "$archive/contract";

export interface TranscriptProperties {
	/** The passage a `?t=` link points at. */
	markedSequence: number | undefined;
	session: SessionDetail;
}

/**
 * Every passage with its time label. The passage a link points at is marked
 * and has an id the page scrolls to.
 *
 * @param properties - The session and the marked passage.
 * @returns The transcript list.
 */
export function Transcript({ markedSequence, session }: Readonly<TranscriptProperties>): ReactNode {
	if (session.segments.length === 0) return <p className="caption">{"Nothing has been transcribed yet."}</p>;

	return (
		<ol aria-live={session.status === "live" ? "polite" : undefined} className="m-0 list-none p-0">
			{session.segments.map((segment) => {
				const isMarked = segment.sequence === markedSequence;
				return (
					<li
						key={segment.sequence}
						className={isMarked ? "transcript-line is-marked" : "transcript-line"}
						id={`segment-${segment.sequence}`}
					>
						<span className="axis-label pt-1">{formatTimeLabel(segment.startMs)}</span>
						<span>
							{segment.text}
							{isMarked ? (
								<span className="meta-line">
									<RecordingLink recordingUrl={session.recordingUrl} startMs={segment.startMs} />
								</span>
							) : null}
						</span>
					</li>
				);
			})}
		</ol>
	);
}
