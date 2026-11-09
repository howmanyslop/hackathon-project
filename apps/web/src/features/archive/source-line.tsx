import { Link } from "@tanstack/react-router";

import { createSessionSearch } from "$features/session/session-search";
import { formatTimeLabel } from "$lib/time-label";

import type { ReactNode } from "react";

export interface SourceLineProperties {
	readonly sessionId: number;
	readonly sessionTitle: string;
	readonly speaker: string;
	readonly startMs: number;
}

/**
 * Where a search hit was said: the talk, the speaker, and a link to the
 * moment in its transcript.
 *
 * @param properties - The hit's session and time.
 * @returns A line of meta text with the link.
 */
export function SourceLine({ sessionId, sessionTitle, speaker, startMs }: SourceLineProperties): ReactNode {
	return (
		<p className="meta-line">
			<span>{sessionTitle}</span>
			<span>{speaker}</span>
			<Link
				params={{ sessionId: String(sessionId) }}
				search={createSessionSearch(startMs)}
				to="/sessions/$sessionId"
			>
				{`Read it at ${formatTimeLabel(startMs)}`}
			</Link>
		</p>
	);
}
