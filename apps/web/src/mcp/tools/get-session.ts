import { tool } from "tmcp/utils";

import { readSessionAsync } from "$archive/read-sessions";
import { isGetSessionInput } from "$mcp/schemas";
import { runToolAsync, toJsonResult } from "$mcp/to-tool-result";

import type { ArchiveServer } from "$mcp/archive-server";

export function registerGetSessionTool(server: ArchiveServer): void {
	server.tool(
		{
			name: "get_session",
			annotations: { idempotentHint: true, openWorldHint: false, readOnlyHint: true },
			description: "Read one session: its full timed transcript and its question-and-answer pairs.",
			schema: isGetSessionInput,
			title: "Read a session",
		},
		async ({ id }) =>
			runToolAsync(async () => {
				const session = await readSessionAsync(id);
				return session === undefined ? tool.error(`There is no session ${id}.`) : toJsonResult(session);
			}),
	);
}
