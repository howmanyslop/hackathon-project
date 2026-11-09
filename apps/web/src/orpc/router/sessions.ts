import { ORPCError, os } from "@orpc/server";
import { isPositiveInteger } from "@web-template/arktype-utilities";
import { type } from "arktype";

import { listSessionsAsync, readArchiveStatsAsync, readSessionAsync } from "$archive/read-sessions";

import type { ArchiveStats, SessionDetail, SessionSummary } from "$archive/contract";

export const getArchiveStats = os
	.input(type({}).readonly())
	.handler(async function getArchiveStatsHandler(): Promise<ArchiveStats> {
		return readArchiveStatsAsync();
	});

export const listSessions = os.input(type({}).readonly()).handler(async function listSessionsHandler(): Promise<
	ReadonlyArray<SessionSummary>
> {
	return listSessionsAsync();
});

export const getSession = os
	.input(type({ id: isPositiveInteger }).readonly())
	.handler(async function getSessionHandler({ input }): Promise<SessionDetail> {
		const session = await readSessionAsync(input.id);
		if (session === undefined) {
			throw new ORPCError("NOT_FOUND", { message: "There is no session with that id." });
		}

		return session;
	});
