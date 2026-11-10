import { Link } from "@tanstack/react-router";

import { PairHitList } from "./pair-hit-list";

import type { ReactNode } from "react";

import type { ArchiveSearchResults, ArchiveStats } from "$archive/contract";

export interface AnsweredViewProperties {
	hasError: boolean;
	isSearching: boolean;
	/** The submitted query, or "" before the first search. */
	query: string;
	results: ArchiveSearchResults | undefined;
	stats: ArchiveStats | undefined;
}

/**
 * The "Asked and answered" figure: a short welcome before a search, then the
 * matching pairs, the nearest ones when none match closely, or a kind word
 * when the archive has none at all.
 *
 * @param properties - The search state.
 * @returns The figure's content.
 */
export function AnsweredView({
	hasError,
	isSearching,
	query,
	results,
	stats,
}: Readonly<AnsweredViewProperties>): ReactNode {
	if (hasError) return <p className="caption">{"The search did not go through. Try again in a moment."}</p>;

	if (isSearching && results === undefined && query.length > 0) {
		return <p className="quiet body-text">{"Searching…"}</p>;
	}

	if (results !== undefined && query.length > 0) {
		if (results.pairs.length > 0) return <PairHitList pairs={results.pairs} />;

		if (results.nearestPairs.length > 0) {
			return (
				<>
					<p className="caption">
						{`Nothing in the archive matches “${query}” closely. These are the nearest questions people asked, in case one of them is yours.`}
					</p>
					<PairHitList pairs={results.nearestPairs} />
				</>
			);
		}

		return (
			<p className="caption">
				{`Nobody has asked about “${query}” yet, as far as the archive can tell. It may be a good one to raise.`}
			</p>
		);
	}

	if (stats?.sessionCount === 0) {
		return (
			<p className="caption">
				{
					"The archive is empty for now. When the first talk is recorded, its questions and answers show up here. "
				}
				<Link to="/record">{"Record a talk"}</Link>
			</p>
		);
	}

	return (
		<p className="caption">
			{
				"Type your question above before you raise your hand. If someone already asked it, you will find the answer here, with a link to the moment it was said."
			}
		</p>
	);
}
