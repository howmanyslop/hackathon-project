import { Link } from "@tanstack/react-router";

import { createSessionSearch } from "$features/session/session-search";
import { formatTimeLabel } from "$lib/time-label";

import { stripEmphasis } from "./strip-emphasis";

import type { ReactNode } from "react";

import type { ArchiveAnswer } from "$archive/contract";

export interface AskAnswerProperties {
	readonly answer: ArchiveAnswer;
}

/**
 * The assistant's answer as a plain caption, then one link per talk it
 * quotes: the talk's title and the time into it.
 *
 * @param properties - The answer and its sources.
 * @returns The caption and, when there are sources, the list of links.
 */
export function AskAnswer({ answer }: AskAnswerProperties): ReactNode {
	return (
		<div className="grid gap-3">
			<p className="caption whitespace-pre-line">{stripEmphasis(answer.answer)}</p>
			{answer.sources.length > 0 ? (
				<ul className="source-list">
					{answer.sources.map((source) => (
						<li key={`${source.sessionId}-${source.startMs}`}>
							<Link
								params={{ sessionId: String(source.sessionId) }}
								search={createSessionSearch(source.startMs)}
								to="/sessions/$sessionId"
							>
								{source.sessionTitle}
							</Link>
							<span className="axis-label">{formatTimeLabel(source.startMs)}</span>
						</li>
					))}
				</ul>
			) : null}
		</div>
	);
}
