import { Overprint } from "$components/overprint";

import type { ReactNode } from "react";

const HAS_DIGIT = /\d/u;

/** One readout: a label over its value. */
export interface Readout {
	/** Shows the live status dot before the value. */
	readonly isLive?: boolean | undefined;
	readonly label: string;
	readonly value: string;
}

/** The overprinted number and the label over it. */
export interface Headline {
	readonly label: string;
	readonly value: string;
}

export interface ReadoutStackProperties {
	headline?: Headline | undefined;
	readouts: ReadonlyArray<Readout>;
}

/**
 * The readouts column: the overprinted number on top, then label-over-value
 * pairs split by hairlines.
 *
 * @param properties - The headline number and the label-value pairs.
 * @returns A column of readouts split by hairlines.
 */
export function ReadoutStack({ headline, readouts }: Readonly<ReadoutStackProperties>): ReactNode {
	return (
		<div className="readout-stack">
			{headline === undefined ? undefined : (
				<div className="readout">
					<p className="readout-label">{headline.label}</p>
					{/* The overprint is only for numbers, never a placeholder dash. */}
					{HAS_DIGIT.test(headline.value) ? (
						<Overprint value={headline.value} />
					) : (
						<p className="readout-value quiet">{headline.value}</p>
					)}
				</div>
			)}
			<dl className="m-0">
				{readouts.map((readout) => (
					<div key={readout.label} className="readout">
						<dt className="readout-label">{readout.label}</dt>
						<dd className="readout-value m-0">
							{readout.isLive === true ? <span aria-hidden="true" className="status-dot" /> : null}
							{readout.value}
						</dd>
					</div>
				))}
			</dl>
		</div>
	);
}
