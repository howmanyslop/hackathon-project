import { Link } from "@tanstack/react-router";

import { SectionRow } from "$components/section-row";

import type { ReactNode } from "react";

import type { Recorder } from "./use-recorder";

export interface SavedScreenProperties {
	recorder: Recorder;
}

/**
 * Step three: how many questions were found, and a link to the session.
 *
 * @param properties - The finished recorder.
 * @returns The saved note.
 */
export function SavedScreen({ recorder }: Readonly<SavedScreenProperties>): ReactNode {
	const count = recorder.pairCount ?? 0;
	const found = count === 1 ? "1 question found." : `${count} questions found.`;

	return (
		<SectionRow head="Saved">
			<p className="caption">{`Saved. ${found}`}</p>
			{recorder.sessionId === undefined ? undefined : (
				<p className="body-text">
					<Link params={{ sessionId: String(recorder.sessionId) }} to="/sessions/$sessionId">
						{"Open the session"}
					</Link>
				</p>
			)}
		</SectionRow>
	);
}
