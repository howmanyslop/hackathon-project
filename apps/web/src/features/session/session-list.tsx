import { Link } from "@tanstack/react-router";

import type { ReactNode } from "react";

import type { SessionSummary } from "$archive/contract";

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
	dateStyle: "medium",
	timeStyle: "short",
	timeZone: "America/Denver",
});

function describeQuestions(count: number): string {
	return count === 1 ? "1 question" : `${count} questions`;
}

export interface SessionListProperties {
	sessions: ReadonlyArray<SessionSummary>;
}

/**
 * Every session as a row split by hairlines: title, speaker, date, how many
 * questions, and a dot when it is live.
 *
 * @param properties - The sessions, newest first.
 * @returns An ordered list, or a note when there are no talks yet.
 */
export function SessionList({ sessions }: Readonly<SessionListProperties>): ReactNode {
	if (sessions.length === 0) {
		return (
			<p className="caption">
				{"No talks have been recorded yet. The first one will appear here as soon as it starts. "}
				<Link to="/record">{"Record a talk"}</Link>
			</p>
		);
	}

	return (
		<ol className="rule-list">
			{sessions.map((session) => (
				<li key={session.id}>
					<Link className="caption" params={{ sessionId: String(session.id) }} to="/sessions/$sessionId">
						{session.title}
					</Link>
					<p className="meta-line">
						<span>{session.speaker}</span>
						<time dateTime={session.startedAt}>{DATE_FORMAT.format(new Date(session.startedAt))}</time>
						<span className="axis-label">{describeQuestions(session.pairCount)}</span>
						{session.status === "live" ? (
							<span>
								<span aria-hidden="true" className="status-dot" />
								{"Live now"}
							</span>
						) : null}
					</p>
				</li>
			))}
		</ol>
	);
}
