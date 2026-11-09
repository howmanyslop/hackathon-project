import { SourceLine } from "./source-line";

import type { ReactNode } from "react";

import type { PairHit } from "$archive/contract";

export interface PairHitListProperties {
	readonly pairs: ReadonlyArray<PairHit>;
}

/**
 * Questions already asked, each with its answer and where it was said. The
 * question has a solid rule and the answer a dashed one.
 *
 * @param properties - The pairs a search found.
 * @returns An ordered list, closest match first.
 */
export function PairHitList({ pairs }: PairHitListProperties): ReactNode {
	return (
		<ol className="rule-list">
			{pairs.map((pair) => (
				<li key={`${pair.sessionId}-${pair.startMs}`}>
					<p className="pair-question">{pair.question}</p>
					<p className="pair-answer">{pair.answer}</p>
					<SourceLine
						sessionId={pair.sessionId}
						sessionTitle={pair.sessionTitle}
						speaker={pair.speaker}
						startMs={pair.startMs}
					/>
				</li>
			))}
		</ol>
	);
}
