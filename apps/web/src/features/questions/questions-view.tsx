import { SectionRow } from "$components/section-row";

import { AskedQuestionList } from "./asked-question-list";

import type { ReactNode } from "react";

import type { AskedQuestion } from "$archive/contract";

const NUMBER_FORMAT = new Intl.NumberFormat("en-US");

export interface QuestionsViewProperties {
	questions: ReadonlyArray<AskedQuestion>;
}

/**
 * What people asked the archive: the questions it had no answer for first,
 * then the ones it did, with the counts beside them.
 *
 * @param properties - The questions, newest first.
 * @returns One or two notebook rows.
 */
export function QuestionsView({ questions }: Readonly<QuestionsViewProperties>): ReactNode {
	const unanswered = questions.filter((question) => !question.isAnswered);
	const answered = questions.filter((question) => question.isAnswered);

	let askedInTotal = 0;
	for (const question of questions) {
		askedInTotal += question.timesAsked;
	}

	let unansweredFigure: ReactNode = <AskedQuestionList questions={unanswered} />;
	if (questions.length === 0) {
		unansweredFigure = (
			<p className="caption">
				{"Nobody has asked anything yet. Questions typed into the archive will show up here."}
			</p>
		);
	} else if (unanswered.length === 0) {
		unansweredFigure = <p className="caption">{"The archive had an answer for every question so far."}</p>;
	}

	return (
		<>
			<SectionRow
				head="Not answered yet"
				headline={{ label: "different questions asked", value: NUMBER_FORMAT.format(questions.length) }}
				note="fig. 1 — questions people typed that the archive had no answered question for, newest first. These are worth covering in your talk."
				readouts={[
					{ label: "Without an answer", value: NUMBER_FORMAT.format(unanswered.length) },
					{ label: "Asked in total", value: NUMBER_FORMAT.format(askedInTotal) },
				]}
			>
				{unansweredFigure}
			</SectionRow>
			{answered.length === 0 ? undefined : (
				<SectionRow
					head="Already answered"
					note="fig. 2 — questions the archive had an answer for, newest first. The way people word them can still show what to explain more clearly."
				>
					<AskedQuestionList questions={answered} />
				</SectionRow>
			)}
		</>
	);
}
