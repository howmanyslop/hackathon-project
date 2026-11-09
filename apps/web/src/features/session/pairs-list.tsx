import { Link } from "@tanstack/react-router";

import { formatTimeLabel } from "$lib/time-label";

import { RecordingLink } from "./recording-link";
import { createSessionSearch } from "./session-search";

import type { ReactNode } from "react";

import type { SessionDetail } from "$archive/contract";

export interface PairsListProperties {
	session: SessionDetail;
}

/**
 * A session's questions, each over its answer, with links to the passage and
 * to the recording.
 *
 * @param properties - The session.
 * @returns The list, or a note when there are no questions yet.
 */
export function PairsList({ session }: Readonly<PairsListProperties>): ReactNode {
	if (session.pairs.length === 0) {
		const message =
			session.status === "live"
				? "No questions yet. They appear here a little after the Q&A starts."
				: "No questions were found in this talk.";

		return <p className="caption">{message}</p>;
	}

	return (
		<ol className="rule-list">
			{session.pairs.map((pair) => (
				<li key={pair.ordinal}>
					<p className="pair-question">{pair.question}</p>
					<p className="pair-answer">{pair.answer}</p>
					<p className="meta-line">
						<Link
							params={{ sessionId: String(session.id) }}
							search={createSessionSearch(pair.startMs)}
							to="/sessions/$sessionId"
						>
							{`Read it at ${formatTimeLabel(pair.startMs)}`}
						</Link>
						<RecordingLink recordingUrl={session.recordingUrl} startMs={pair.startMs} />
					</p>
				</li>
			))}
		</ol>
	);
}
