import type { ReactNode } from "react";

export interface OverprintProperties {
	/** The numeral, already formatted. */
	value: string;
}

/**
 * The one riso overprint on a screen: the numeral with two off-register
 * copies behind it. Plex Mono's dotted zero muddies under the halo, so a
 * number with a zero is set in Plex Sans.
 *
 * @param properties - The numeral to print.
 * @returns The overprinted numeral.
 */
export function Overprint({ value }: Readonly<OverprintProperties>): ReactNode {
	const className = value.includes("0") ? "overprint is-sans" : "overprint";
	return (
		<span className={className} data-value={value}>
			{value}
		</span>
	);
}
