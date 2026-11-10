import { useState } from "react";

import { Button } from "$components/ui/button";

import type { ReactNode, SubmitEvent } from "react";

export interface PresenterCodeFormProperties {
	/** Why the last code didn't work, if it didn't. */
	errorMessage?: string | undefined;
	onCodeSubmit: (presenterCode: string) => void;
}

/**
 * The one field between a presenter and the questions people asked.
 *
 * @param properties - What to say about the last try, and what to do with
 *   the code.
 * @returns The labeled field and the Show the questions button.
 */
export function PresenterCodeForm({ errorMessage, onCodeSubmit }: Readonly<PresenterCodeFormProperties>): ReactNode {
	const [draft, setDraft] = useState("");

	function handleSubmit(event: SubmitEvent<HTMLFormElement>): void {
		event.preventDefault();
		onCodeSubmit(draft);
	}

	return (
		<form className="grid max-w-xl gap-4" onSubmit={handleSubmit}>
			<label className="field">
				<span className="field-label">{"Presenter code"}</span>
				<input
					autoComplete="off"
					className="text-field"
					name="presenterCode"
					type="password"
					value={draft}
					onChange={(event) => {
						setDraft(event.target.value);
					}}
				/>
			</label>
			{errorMessage === undefined ? undefined : (
				<p className="fig-note" role="alert">
					{errorMessage}
				</p>
			)}
			<Button className="primary-button justify-self-start" disabled={draft.length === 0} type="submit">
				{"Show the questions"}
			</Button>
		</form>
	);
}
