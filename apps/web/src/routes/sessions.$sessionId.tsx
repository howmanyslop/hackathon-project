import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { SectionRow } from "$components/section-row";
import { validateSessionSearch } from "$features/session/session-search";
import { findMarkedSequence } from "$features/session/session-timing";
import { SessionView } from "$features/session/session-view";
import { orpc } from "$orpc/client";

import type { ReactNode } from "react";

import type { SessionDetail } from "$archive/contract";

import type { RouterContext } from "../integrations/tanstack-query/root-provider";

const LIVE_POLL_MS = 3000;

// The final split lands a few seconds after the session is marked ended.
const AFTER_END_POLL_MS = 120_000;

function isPollingWorthwhile(session?: SessionDetail): boolean {
	if (session === undefined) return false;
	if (session.status === "live") return true;
	if (session.endedAt === undefined) return false;
	return Date.now() - Date.parse(session.endedAt) < AFTER_END_POLL_MS;
}

interface SessionParameters {
	readonly sessionId: string;
}

interface SessionTitleOptions {
	readonly context: RouterContext;
	readonly params: SessionParameters;
}

/**
 * Loads the session before the page renders, so the tab can show the talk's
 * title. A missing session is left to the page, which says it is not found.
 *
 * @param options - The router context and the route's parameters.
 * @returns The talk's title, or undefined when there is none.
 */
async function loadSessionTitleAsync({
	context,
	params: parameters,
}: SessionTitleOptions): Promise<string | undefined> {
	const id = Number(parameters.sessionId);
	if (!Number.isInteger(id)) return undefined;

	const session = await context.queryClient
		.query({ ...orpc.getSession.queryOptions({ input: { id } }), staleTime: "static" })
		.catch(() => undefined);

	return session?.title;
}

/**
 * A session's page. It polls every 3 seconds while the talk is live and for
 * two minutes after it ends, so the final pairs show up without a reload. A
 * `?t=` link scrolls to the passage at that second and marks it.
 *
 * @returns The session, a loading line, or a not-found note.
 */
function SessionPage(): ReactNode {
	const { sessionId } = Route.useParams();
	const search = Route.useSearch();
	const id = Number(sessionId);

	const { data: session, error } = useQuery({
		...orpc.getSession.queryOptions({ input: { id } }),
		enabled: Number.isInteger(id),
		refetchInterval(query) {
			return isPollingWorthwhile(query.state.data) ? LIVE_POLL_MS : false;
		},
	});

	const markedSequence = session === undefined ? undefined : findMarkedSequence(session.segments, search.t);

	useEffect(
		function scrollToMarkedPassage() {
			if (markedSequence === undefined) return;
			document.querySelector(`#segment-${markedSequence}`)?.scrollIntoView({ block: "center" });
		},
		[markedSequence],
	);

	if (error !== null || !Number.isInteger(id)) {
		return (
			<main className="page-main">
				<SectionRow head="Not found">
					<p className="caption">
						{"This session is not in the archive. It may have been deleted. "}
						<Link to="/sessions">{"See every session"}</Link>
					</p>
				</SectionRow>
			</main>
		);
	}

	if (session === undefined) {
		return (
			<main className="page-main">
				<p className="quiet body-text py-10">{"Loading the session…"}</p>
			</main>
		);
	}

	return <SessionView markedSequence={markedSequence} session={session} />;
}

// oxlint-disable perfectionist/sort-objects -- TanStack Start types loaderData only when validateSearch, ssr, and loader come before head.
export const Route = createFileRoute("/sessions/$sessionId")({
	validateSearch: validateSessionSearch,
	loader: loadSessionTitleAsync,
	component: SessionPage,
	head: ({ loaderData }) => ({
		meta: [{ title: `${loaderData ?? "Session"} · Asked & Answered` }],
	}),
});
// oxlint-enable perfectionist/sort-objects
