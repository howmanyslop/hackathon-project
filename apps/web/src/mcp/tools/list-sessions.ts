import { listSessionsAsync } from "$archive/read-sessions";
import { runToolAsync, toJsonResult } from "$mcp/to-tool-result";

import type { ArchiveServer } from "$mcp/archive-server";

export function registerListSessionsTool(server: ArchiveServer): void {
	server.tool(
		{
			name: "list_sessions",
			annotations: { idempotentHint: true, openWorldHint: false, readOnlyHint: true },
			description:
				"List every session in the archive, newest first, with its speaker and how many questions it has.",
			title: "List sessions",
		},
		async () => runToolAsync(async () => toJsonResult(await listSessionsAsync())),
	);
}
