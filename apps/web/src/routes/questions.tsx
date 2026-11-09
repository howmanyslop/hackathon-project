import { useState } from "react";
import { ORPCError } from "@orpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { SectionRow } from "$components/section-row";
import { PresenterCodeForm } from "$features/questions/presenter-code-form";
import { readStoredPresenterCode, storePresenterCode } from "$features/questions/presenter-code-storage";
import { QuestionsView } from "$features/questions/questions-view";
import { orpc } from "$orpc/client";

import type { ReactNode } from "react";

const CODE_NOTE =
	"Questions people typed into the archive, with no names attached. Strangers write them, so only presenters can read them. Enter the presenter code to see what people want to know.";

/**
 * What attendees asked the archive, for presenters: the presenter code
 * first, then the questions.
 *
 * @returns The code form, or the questions once the code is right.
 */
function QuestionsPage(): ReactNode {
	const [presenterCode, setPresenterCode] = useState(readStoredPresenterCode);

	const { data: questions, error } = useQuery({
		...orpc.listAskedQuestions.queryOptions({ input: { presenterCode } }),
		enabled: presenterCode.length > 0,
		// A wrong code should say so at once, not after three retries.
		retry: false,
	});

	function handleCodeSubmit(code: string): void {
		storePresenterCode(code);
		setPresenterCode(code);
	}

	const isWrongCode = error instanceof ORPCError && error.code === "UNAUTHORIZED";

	let content: ReactNode = <QuestionsView questions={questions ?? []} />;
	if (isWrongCode || presenterCode.length === 0) {
		content = (
			<SectionRow head="Questions" note={CODE_NOTE}>
				<PresenterCodeForm
					errorMessage={isWrongCode ? error.message : undefined}
					onCodeSubmit={handleCodeSubmit}
				/>
			</SectionRow>
		);
	} else if (error !== null) {
		content = (
			<SectionRow head="Questions">
				<p className="caption">{"The questions could not be loaded. Reload the page to try again."}</p>
			</SectionRow>
		);
	} else if (questions === undefined) {
		content = (
			<SectionRow head="Questions">
				<p className="quiet body-text">{"Loading the questions…"}</p>
			</SectionRow>
		);
	}

	return <main className="page-main">{content}</main>;
}

// Client only: the presenter code lives in this tab's storage.
export const Route = createFileRoute("/questions")({ component: QuestionsPage, ssr: false });
