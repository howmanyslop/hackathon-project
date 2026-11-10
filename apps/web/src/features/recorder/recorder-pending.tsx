import { SectionRow } from "$components/section-row";

import { RECORDER_NOTE } from "./recording-notice";

import type { ReactNode } from "react";

/**
 * What /record shows before the recorder loads in the browser: the same
 * margin note and one quiet line, so the page does not jump.
 *
 * @returns The page with a placeholder where the form will be.
 */
export function RecorderPending(): ReactNode {
	return (
		<main className="page-main">
			<SectionRow head="Record a talk" note={RECORDER_NOTE}>
				<p className="quiet body-text">{"Getting the recorder ready."}</p>
			</SectionRow>
		</main>
	);
}
