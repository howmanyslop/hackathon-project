import { Link } from "@tanstack/react-router";

import type { ReactNode } from "react";

import type { AskedQuestion } from "$archive/contract";

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
	dateStyle: "medium",
	timeStyle: "short",
	timeZone: "America/Denver",
});

function describeTimesAsked(count: number): string {
	return count === 1 ? "Asked once" : `Asked ${count} times`;
}

export interface AskedQuestionListProperties {
	questions: ReadonlyArray<AskedQuestion>;
}

/**
 * Questions people typed into the archive, each with how often and when it
 * was last asked. Answered ones link to the archive.
 *
 * @param properties - The questions, newest first.
 * @returns An ordered list split by hairlines.
 */
export function AskedQuestionList({ questions }: Readonly<AskedQuestionListProperties>): ReactNode {
	return (
		<ol className="rule-list">
			{questions.map((question) => {
				let answerLink: ReactNode;
				if (question.isAnswered) {
					answerLink = <Link to="/">{"See the answers"}</Link>;
				}

				return (
					<li key={question.text}>
						<p className="caption">{question.text}</p>
						<p className="meta-line">
							<span className="axis-label">{describeTimesAsked(question.timesAsked)}</span>
							<time className="axis-label" dateTime={question.lastAskedAt}>
								{`Last ${DATE_FORMAT.format(new Date(question.lastAskedAt))}`}
							</time>
							{answerLink}
						</p>
					</li>
				);
			})}
		</ol>
	);
}
