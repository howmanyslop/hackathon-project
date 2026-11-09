import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "$components/ui/button";
import { orpc } from "$orpc/client";

import type { ReactNode, SubmitEvent } from "react";

/**
 * Semantic search over the todos, through Elasticsearch and Jina embeddings.
 * The query runs when the form is submitted, not on every keystroke, since
 * each search embeds the query text.
 *
 * @returns A search form and its results.
 */
export function TodoSearch(): ReactNode {
	const [query, setQuery] = useState("");
	const [submittedQuery, setSubmittedQuery] = useState("");

	const {
		data: results,
		error,
		isFetching,
	} = useQuery({
		...orpc.searchTodos.queryOptions({ input: { query: submittedQuery } }),
		enabled: submittedQuery.length > 0,
	});

	function handleSubmit(event: SubmitEvent<HTMLFormElement>): void {
		event.preventDefault();
		setSubmittedQuery(query.trim());
	}

	let resultsView: ReactNode;
	if (results !== undefined) {
		resultsView =
			results.length === 0 ? (
				<p className="text-muted-foreground mt-4">{"No matches."}</p>
			) : (
				<ol className="mt-4 list-inside list-decimal">
					{results.map((result) => (
						<li key={result.id}>{result.name}</li>
					))}
				</ol>
			);
	}

	return (
		<section className="mt-8">
			<search>
				<form className="flex max-w-md gap-2" onSubmit={handleSubmit}>
					<input
						aria-label="Search todos"
						className="border-border bg-background focus-visible:ring-ring/30 h-9 min-w-0 flex-1 rounded-4xl border px-3 text-base outline-none focus-visible:ring-3 sm:text-sm"
						name="query"
						placeholder="Search by meaning, like “groceries”"
						type="search"
						value={query}
						onChange={(event) => {
							setQuery(event.target.value);
						}}
					/>
					<Button disabled={query.trim().length === 0 || isFetching} type="submit">
						{"Search"}
					</Button>
				</form>
			</search>
			{error === null ? undefined : <p className="text-destructive mt-3 text-sm">{error.message}</p>}
			{resultsView}
		</section>
	);
}
