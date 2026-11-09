import { Button } from "$components/ui/button";

import type { ReactNode, SubmitEvent } from "react";

export interface ArchiveSearchFormProperties {
	isBusy: boolean;
	onQueryChange: (query: string) => void;
	onSubmit: () => void;
	query: string;
}

/**
 * The controls band's one field. The search runs on submit, not on every
 * keystroke, because each search embeds the query.
 *
 * @param properties - The query and its handlers.
 * @returns A search landmark holding the field and the Search button.
 */
export function ArchiveSearchForm({
	isBusy,
	onQueryChange,
	onSubmit,
	query,
}: Readonly<ArchiveSearchFormProperties>): ReactNode {
	function handleSubmit(event: SubmitEvent<HTMLFormElement>): void {
		event.preventDefault();
		onSubmit();
	}

	return (
		<search className="controls-band">
			<form className="search-row" onSubmit={handleSubmit}>
				<label className="field">
					<span className="field-label">{"Was your question already asked?"}</span>
					<input
						className="text-field"
						name="query"
						placeholder="How do you test screen readers?"
						type="search"
						value={query}
						onChange={(event) => {
							onQueryChange(event.target.value);
						}}
					/>
				</label>
				<Button className="primary-button" disabled={query.trim().length === 0 || isBusy} type="submit">
					{"Search"}
				</Button>
			</form>
			<p className="fig-note">
				{"Questions typed here are kept without your name, so presenters can see what people want to know."}
			</p>
		</search>
	);
}
