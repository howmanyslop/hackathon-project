import { useState } from "react";
import { ORPCError } from "@orpc/client";
import { useMutation } from "@tanstack/react-query";

import { Button } from "$components/ui/button";
import { orpc } from "$orpc/client";

import { AskAnswer } from "./ask-answer";

import type { ReactNode, SubmitEvent } from "react";

/**
 * Refusals the server words for people: the minute's limit, the spent
 * budget, and an agent that is down or not set up.
 */
const READABLE_CODES = new Set(["BAD_GATEWAY", "SERVICE_UNAVAILABLE", "TOO_MANY_REQUESTS"]);

/**
 * The sentence to show when a question gets no answer.
 *
 * @param error - What the call failed with.
 * @returns The server's own message when it wrote one for people, or a
 *   general one.
 */
function describeAskError(error: Error): string {
	if (error instanceof ORPCError && READABLE_CODES.has(String(error.code))) return error.message;
	return "The archive's assistant is not available right now. The search above still works.";
}

/**
 * A question box backed by the archive's agent. It reads the talks and
 * answers in its own words, with links to where each answer came from.
 *
 * @returns The form and its answer.
 */
export function AskArchive(): ReactNode {
	const [question, setQuestion] = useState("");
	const ask = useMutation(orpc.askArchive.mutationOptions());

	function handleSubmit(event: SubmitEvent<HTMLFormElement>): void {
		event.preventDefault();
		const trimmed = question.trim();
		if (trimmed.length > 0) {
			ask.mutate({ question: trimmed });
		}
	}

	let result: ReactNode;
	if (ask.isPending) {
		result = <p className="quiet body-text">{"Reading the talks…"}</p>;
	} else if (ask.isError) {
		result = <p className="quiet body-text">{describeAskError(ask.error)}</p>;
	} else if (ask.data !== undefined) {
		result = <AskAnswer answer={ask.data} />;
	}

	return (
		<div className="grid gap-4">
			<form className="search-row" onSubmit={handleSubmit}>
				<label className="field">
					<span className="field-label">{"Your question"}</span>
					<input
						className="text-field"
						name="question"
						placeholder="What did people ask about accessibility?"
						type="text"
						value={question}
						onChange={(event) => {
							setQuestion(event.target.value);
						}}
					/>
				</label>
				<Button
					className="primary-button"
					disabled={question.trim().length === 0 || ask.isPending}
					type="submit"
				>
					{"Ask"}
				</Button>
			</form>
			<div aria-live="polite">{result}</div>
		</div>
	);
}
