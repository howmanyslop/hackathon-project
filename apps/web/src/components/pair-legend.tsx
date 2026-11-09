import type { ReactNode } from "react";

/**
 * The inline legend above a figure of questions and answers: a solid line
 * in the question color and a dashed line in the answer color.
 *
 * @returns The two legend entries on one line.
 */
export function PairLegend(): ReactNode {
	return (
		<p className="legend">
			<span className="legend-entry">
				<span aria-hidden="true" className="legend-line is-question" />
				{"question"}
			</span>
			<span className="legend-entry">
				<span aria-hidden="true" className="legend-line is-answer" />
				{"answer"}
			</span>
		</p>
	);
}
