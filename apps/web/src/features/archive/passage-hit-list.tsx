import { SourceLine } from "./source-line";

import type { ReactNode } from "react";

import type { PassageHit } from "$archive/contract";

export interface PassageHitListProperties {
	readonly passages: ReadonlyArray<PassageHit>;
}

/**
 * Passages from the talks that match a search, quoted as transcribed.
 *
 * @param properties - The passages a search found.
 * @returns An ordered list, closest match first.
 */
export function PassageHitList({ passages }: PassageHitListProperties): ReactNode {
	return (
		<ol className="rule-list">
			{passages.map((passage) => (
				<li key={`${passage.sessionId}-${passage.startMs}`}>
					<p className="body-text">{passage.text}</p>
					<SourceLine
						sessionId={passage.sessionId}
						sessionTitle={passage.sessionTitle}
						speaker={passage.speaker}
						startMs={passage.startMs}
					/>
				</li>
			))}
		</ol>
	);
}
