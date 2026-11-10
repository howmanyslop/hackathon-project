import { createFileRoute } from "@tanstack/react-router";

import { RecorderPending } from "$features/recorder/recorder-pending";
import { RecorderView } from "$features/recorder/recorder-view";
import { useRecorder } from "$features/recorder/use-recorder";

import type { ReactNode } from "react";

/**
 * The presenter's recorder, made for a phone.
 *
 * @returns The recorder step, with any error above it.
 */
function RecordPage(): ReactNode {
	const recorder = useRecorder();

	return (
		<main className="page-main">
			{recorder.errorMessage === undefined ? undefined : (
				<p className="notice mt-6" role="alert">
					{recorder.errorMessage}
				</p>
			)}
			<RecorderView recorder={recorder} />
		</main>
	);
}

// Client only: the recorder reads speech support and browser storage. The
// server sends the pending view, so the page keeps its shape until then.
// oxlint-disable perfectionist/sort-objects -- TanStack Start types loaderData only when validateSearch, ssr, and loader come before head.
export const Route = createFileRoute("/record")({
	ssr: false,
	component: RecordPage,
	head: () => ({ meta: [{ title: "Record · Asked & Answered" }] }),
	pendingComponent: RecorderPending,
});
// oxlint-enable perfectionist/sort-objects
