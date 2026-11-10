import { tool } from "tmcp/utils";

import { isSearchArchiveInput } from "$mcp/schemas";
import { runToolAsync, toJsonResult } from "$mcp/to-tool-result";
import { searchArchiveAsync } from "$search/archive";

import type { ArchiveServer } from "$mcp/archive-server";

export function registerSearchArchiveTool(server: ArchiveServer): void {
	server.tool(
		{
			name: "search_archive",
			annotations: { idempotentHint: true, openWorldHint: false, readOnlyHint: true },
			description:
				"Search every conference session by meaning. Returns answered audience questions first, then passages " +
				"from the talks, each with its session id and the millisecond it starts at.",
			schema: isSearchArchiveInput,
			title: "Search the archive",
		},
		async ({ limit, query }) =>
			runToolAsync(async () => {
				const results = await searchArchiveAsync(query, limit);
				return results === undefined
					? tool.error("Search isn't set up on this server.")
					: toJsonResult(results);
			}),
	);
}
