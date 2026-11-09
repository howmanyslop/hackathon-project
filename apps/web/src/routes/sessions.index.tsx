import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { SectionRow } from "$components/section-row";
import { SessionList } from "$features/session/session-list";
import { orpc } from "$orpc/client";

import type { ReactNode } from "react";

/**
 * The list of every recorded talk, newest first.
 *
 * @returns One notebook row holding the list of sessions.
 */
function SessionsPage(): ReactNode {
	const { data: sessions, error } = useQuery(orpc.listSessions.queryOptions({ input: {} }));

	let list: ReactNode = <p className="quiet body-text">{"Loading the sessions…"}</p>;
	if (error !== null) {
		list = <p className="caption">{"The sessions could not be loaded. Try again in a moment."}</p>;
	} else if (sessions !== undefined) {
		list = <SessionList sessions={sessions} />;
	}

	return (
		<main className="page-main">
			<SectionRow
				head="Sessions"
				note="fig. 1 — every talk in the archive, newest first. A blue dot means the talk is being recorded right now, and its page fills in as the speaker goes."
			>
				{list}
			</SectionRow>
		</main>
	);
}

export const Route = createFileRoute("/sessions/")({
	component: SessionsPage,
	head: () => ({ meta: [{ title: "Sessions · Asked & Answered" }] }),
});
