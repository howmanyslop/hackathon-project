/**
 * A read-only MCP server over the archive, so AI agents can search every
 * session the way people do.
 */

import { ArktypeJsonSchemaAdapter } from "@tmcp/adapter-arktype";
import { HttpTransport } from "@tmcp/transport-http";
import { McpServer } from "tmcp";

import { registerGetSessionTool } from "./tools/get-session";
import { registerListSessionsTool } from "./tools/list-sessions";
import { registerSearchArchiveTool } from "./tools/search-archive";

import type { ArchiveServer } from "./archive-server";

const INSTRUCTIONS =
	"Search and read the Asked & Answered conference archive. Start with search_archive; use get_session to read " +
	"a whole talk. Everything here is read-only.";

function createArchiveServer(): ArchiveServer {
	const server: ArchiveServer = new McpServer(
		{
			name: "asked-and-answered",
			description: "Every question asked at the conference, with its answer and the talk it came from.",
			version: "1.0.0",
		},
		{
			adapter: new ArktypeJsonSchemaAdapter(),
			capabilities: { tools: {} },
			instructions: INSTRUCTIONS,
		},
	);

	registerSearchArchiveTool(server);
	registerListSessionsTool(server);
	registerGetSessionTool(server);
	return server;
}

/**
 * Builds the server and its HTTP transport at `/mcp`.
 *
 * The app runs as three replicas with no sticky sessions, so nothing a
 * request needs may live in one replica's memory:
 * - Clients on the per-request protocol (MCP 2026-07-28) never have a
 *   session, so any replica answers any request.
 * - Older clients start with `initialize` and send the session id it
 *   returns. A replica that never saw that id still answers, because the
 *   tools are read-only and use nothing from `initialize`.
 * - The GET event stream is off (GET answers 405, which the protocol allows),
 *   since there are no notifications to send and a stream would be stuck to
 *   one replica.
 *
 * @returns The transport. Hand it every request to `/mcp`.
 */
export function createMcpTransport(): HttpTransport {
	return new HttpTransport(createArchiveServer(), {
		// The route refuses cross-site posts with the same check as oRPC.
		// The transport's own check also compares the scheme, which differs
		// behind the Cloudflare Tunnel, so it is turned off here.
		allowedOrigins: true,
		disableSse: true,
		path: "/mcp",
	});
}
