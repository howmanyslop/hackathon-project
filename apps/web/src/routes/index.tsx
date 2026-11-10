import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { PairLegend } from "$components/pair-legend";
import { SectionRow } from "$components/section-row";
import { AnsweredView } from "$features/archive/answered-view";
import { ArchiveSearchForm } from "$features/archive/archive-search-form";
import { AskArchive } from "$features/archive/ask-archive";
import { PassageHitList } from "$features/archive/passage-hit-list";
import { ThemesDigest } from "$features/archive/themes-digest";
import { orpc } from "$orpc/client";

import type { ReactNode } from "react";

import type { ArchiveStats } from "$archive/contract";

const NUMBER_FORMAT = new Intl.NumberFormat("en-US");

function formatCount(stats: ArchiveStats | undefined, key: keyof ArchiveStats): string {
	return stats === undefined ? "–" : NUMBER_FORMAT.format(stats[key]);
}

/**
 * The archive page: one search over every question and passage, the
 * readouts, the Ask box, and the hourly digest.
 *
 * @returns The search band, the results, the Ask box, and the digest.
 */
function ArchivePage(): ReactNode {
	const [query, setQuery] = useState("");
	const [submittedQuery, setSubmittedQuery] = useState("");

	const { data: stats } = useQuery(orpc.getArchiveStats.queryOptions({ input: {} }));
	const {
		data: results,
		error,
		isFetching,
	} = useQuery({
		...orpc.searchArchive.queryOptions({ input: { query: submittedQuery } }),
		enabled: submittedQuery.length > 0,
		// A search is saved for presenters each time it runs, so the same
		// results are never fetched again just because the window got focus.
		staleTime: Number.POSITIVE_INFINITY,
	});

	function handleSubmit(): void {
		setSubmittedQuery(query.trim());
	}

	const passages = submittedQuery.length > 0 ? (results?.passages ?? []) : [];
	// Figures count 1, 2, 3 down the page, and "From the talks" is optional.
	const askFigure = passages.length > 0 ? 3 : 2;

	return (
		<>
			<ArchiveSearchForm isBusy={isFetching} query={query} onQueryChange={setQuery} onSubmit={handleSubmit} />
			<main className="page-main">
				<SectionRow
					head="Asked and answered"
					headline={{ label: "questions answered", value: formatCount(stats, "pairCount") }}
					note="fig. 1 — questions from the audience, closest to yours first. The solid rule marks the question and the dashed rule its answer, tidied a little. Each one links to the words as they were said."
					readouts={[
						{ label: "Sessions", value: formatCount(stats, "sessionCount") },
						{ label: "Live now", value: formatCount(stats, "liveCount") },
					]}
				>
					<PairLegend />
					<div aria-live="polite">
						<AnsweredView
							hasError={error !== null}
							isSearching={isFetching}
							query={submittedQuery}
							results={results}
							stats={stats}
						/>
					</div>
				</SectionRow>
				{passages.length > 0 ? (
					<SectionRow
						head="From the talks"
						note="fig. 2 — moments in the talks themselves that match your words, quoted as they were transcribed."
					>
						<PassageHitList passages={passages} />
					</SectionRow>
				) : null}
				<SectionRow
					head="Ask the archive"
					note={`fig. ${askFigure} — an assistant reads every talk and answers in its own words, with links to where the answer came from. It can be wrong, so follow the links.`}
				>
					<AskArchive />
				</SectionRow>
				<ThemesDigest figure={askFigure + 1} />
			</main>
		</>
	);
}

export const Route = createFileRoute("/")({ component: ArchivePage });
