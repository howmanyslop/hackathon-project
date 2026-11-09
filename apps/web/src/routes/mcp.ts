// The one route outside oRPC: MCP clients speak JSON-RPC over Streamable
// HTTP, not oRPC, so the archive's read-only MCP server is mounted here.
// docs/adr/0002-mcp-route-outside-orpc.md says why.

import { createFileRoute } from "@tanstack/react-router";

import { createMcpTransport } from "$mcp/create-server";
import { isCsrfSafeRequest } from "$server/csrf";
import { createRateLimiter } from "$server/rate-limit";
import { isBodyTooLarge } from "$server/request-body";

import type { HttpTransport } from "@tmcp/transport-http";

interface HandleAsyncOptions {
	readonly request: Request;
}

/** Made on the first request, so loading this route never builds a server. */
let transport: HttpTransport | undefined;

// A search tool call runs paid embeddings, so one address gets 60 calls a
// minute, the same budget idea as the search box.
const isCallAllowed = createRateLimiter(60);

async function handleAsync({ request }: HandleAsyncOptions): Promise<Response> {
	// A page on another site must not drive this endpoint from a browser.
	if (!isCsrfSafeRequest(request)) return new Response("Forbidden", { status: 403 });

	if (isBodyTooLarge(request)) return new Response("Payload too large", { status: 413 });

	if (!isCallAllowed(request.headers.get("cf-connecting-ip") ?? "this-server")) {
		return new Response("Too many requests", { status: 429 });
	}

	transport ??= createMcpTransport();
	const response = await transport.respond(request);
	return response ?? new Response("Not found", { status: 404 });
}

export const Route = createFileRoute("/mcp")({
	server: {
		handlers: {
			DELETE: handleAsync,
			GET: handleAsync,
			POST: handleAsync,
		},
	},
});
