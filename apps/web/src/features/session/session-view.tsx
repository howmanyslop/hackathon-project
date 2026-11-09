import { PairLegend } from "$components/pair-legend";
import { SectionRow } from "$components/section-row";
import { formatTimeLabel } from "$lib/time-label";

import { DeleteSession } from "./delete-session";
import { PairsList } from "./pairs-list";
import { measureSessionLength } from "./session-timing";
import { TimelineStrip } from "./timeline-strip";
import { Transcript } from "./transcript";

import type { ReactNode } from "react";

import type { SessionDetail } from "$archive/contract";

export interface SessionViewProperties {
	/** The passage a `?t=` link points at. */
	markedSequence: number | undefined;
	session: SessionDetail;
}

/**
 * One talk: the timeline, its questions, and the full transcript.
 *
 * @param properties - The session and the marked passage.
 * @returns The page body.
 */
export function SessionView({ markedSequence, session }: Readonly<SessionViewProperties>): ReactNode {
	const lengthMs = measureSessionLength(session);
	const isLive = session.status === "live";

	return (
		<main className="page-main">
			<SectionRow
				head={session.title}
				headline={{ label: "questions in this session", value: String(session.pairs.length) }}
				note="fig. 1 — the talk from left to right. The thin line is where the Q&A starts, and each purple tick is a question. Tap a tick to read it."
				readouts={[
					{ label: "Length of the talk", value: formatTimeLabel(lengthMs) },
					{ isLive, label: "Status", value: isLive ? "Live" : "Ended" },
				]}
				subhead={session.speaker}
			>
				<PairLegend />
				<TimelineStrip
					lengthMs={lengthMs}
					pairs={session.pairs}
					qaStartMs={session.qaStartMs}
					sessionId={session.id}
				/>
			</SectionRow>
			<SectionRow
				head="Questions and answers"
				note="fig. 2 — each question with a solid rule and its answer with a dashed one. The wording is tidied a little; the link shows exactly what was said."
			>
				<PairsList session={session} />
			</SectionRow>
			<SectionRow
				head="Transcript"
				note="fig. 3 — everything that was said, as the phone heard it, in minutes and seconds into the talk. Speech recognition makes mistakes, so read a little around a passage."
			>
				<Transcript markedSequence={markedSequence} session={session} />
			</SectionRow>
			<div className="py-6">
				<DeleteSession sessionId={session.id} />
			</div>
		</main>
	);
}
