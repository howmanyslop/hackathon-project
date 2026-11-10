import { useQuery } from "@tanstack/react-query";

import { SectionRow } from "$components/section-row";
import { orpc } from "$orpc/client";

import type { ReactNode } from "react";

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
	dateStyle: "medium",
	timeStyle: "short",
	timeZone: "America/Denver",
});

export interface ThemesDigestProperties {
	/** The figure number this section has on the page. */
	readonly figure: number;
}

/**
 * The newest "what people are asking" note, written every hour from the
 * latest questions. Hidden until there is one.
 *
 * @param properties - The section's figure number.
 * @returns The section, or nothing.
 */
export function ThemesDigest({ figure }: ThemesDigestProperties): ReactNode {
	const { data: digest } = useQuery(orpc.getDigest.queryOptions({ input: {} }));
	if (digest === undefined) return undefined;

	return (
		<SectionRow
			head="What people are asking"
			note={`fig. ${figure} — a short note on the themes in the newest questions, written ${DATE_FORMAT.format(new Date(digest.createdAt))}. It is a summary, so check the answers themselves before you rely on it.`}
		>
			<p className="caption whitespace-pre-line">{digest.note}</p>
		</SectionRow>
	);
}
