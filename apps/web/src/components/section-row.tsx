import { useId } from "react";

import { ReadoutStack } from "$components/readout-stack";

import type { PropsWithChildren, ReactNode } from "react";

import type { Headline, Readout } from "$components/readout-stack";

export interface SectionRowProperties {
	/** The margin head, in Newsreader italic. */
	head: string;
	/** The overprinted number on top of the readouts. */
	headline?: Headline | undefined;
	/** The fig. Note: what the figure shows and how to read it. */
	note?: string | undefined;
	/** The readouts. Without them the figure takes the rest of the row. */
	readouts?: ReadonlyArray<Readout> | undefined;
	/** A line under the head, such as the speaker's name. */
	subhead?: string | undefined;
}

/**
 * One notebook row: a 220px margin note, the figure, then the readouts. On a
 * phone they stack in the same order.
 *
 * @param properties - The head, note, figure, and readouts.
 * @returns A labeled section that stacks on a phone.
 */
export function SectionRow({
	head,
	headline,
	note,
	readouts,
	subhead,
	children,
}: Readonly<PropsWithChildren<SectionRowProperties>>): ReactNode {
	const headId = useId();
	const hasReadouts = readouts !== undefined || headline !== undefined;

	return (
		<section aria-labelledby={headId} className={hasReadouts ? "section-row" : "section-row is-wide"}>
			<div>
				<h2 className="margin-head" id={headId}>
					{head}
				</h2>
				{subhead === undefined ? undefined : <p className="subhead">{subhead}</p>}
				{note === undefined ? undefined : <p className="fig-note">{note}</p>}
			</div>
			<div className="figure">{children}</div>
			{hasReadouts ? <ReadoutStack headline={headline} readouts={readouts ?? []} /> : null}
		</section>
	);
}
