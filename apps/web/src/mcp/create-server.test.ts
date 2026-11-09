import { type } from "arktype";
import { describe, expect, it } from "vite-plus/test";

import { createMcpTransport } from "./create-server";

import type { HttpTransport } from "@tmcp/transport-http";
import type { JsonObject } from "type-fest";

const ENDPOINT = "https://asked.example.com/mcp";

const isToolList = type({
	result: {
		tools: type({ name: "string", "annotations?": { "readOnlyHint?": "boolean" } }).array(),
	},
});

type ToolList = typeof isToolList.infer;

interface Reply {
	readonly body: unknown;
	readonly sessionId: null | string;
	readonly status: number;
}

/**
 * Posts one JSON-RPC message to a transport, as an MCP client would.
 *
 * @param transport - The replica that receives it.
 * @param message - The message, without `jsonrpc`.
 * @param headers - Extra headers, such as the session id.
 * @rejects When the transport ignores the request.
 * @returns The reply's status, session id, and JSON body.
 */
async function postAsync(
	transport: HttpTransport,
	message: JsonObject,
	headers: Readonly<Record<string, string>> = {},
): Promise<Reply> {
	const response = await transport.respond(
		new Request(ENDPOINT, {
			body: JSON.stringify({ jsonrpc: "2.0", ...message }),
			headers: { accept: "application/json, text/event-stream", "content-type": "application/json", ...headers },
			method: "POST",
		}),
	);

	if (response === null) {
		throw new Error("The transport ignored a request to /mcp.");
	}

	// The reply comes back as a short event stream: one `data:` line.
	const text = await response.text();
	const data = text
		.split("\n")
		.filter((line) => line.startsWith("data: "))
		.map((line) => line.slice("data: ".length))
		.join("");
	const body: unknown = JSON.parse(data);

	return { body, sessionId: response.headers.get("mcp-session-id"), status: response.status };
}

async function startSessionAsync(transport: HttpTransport): Promise<string> {
	const reply = await postAsync(transport, {
		id: 1,
		method: "initialize",
		params: {
			capabilities: {},
			clientInfo: { name: "test-client", version: "1.0.0" },
			protocolVersion: "2025-06-18",
		},
	});

	if (reply.sessionId === null) {
		throw new Error("initialize returned no session id.");
	}

	return reply.sessionId;
}

function listToolNames(list: ToolList): Array<string> {
	return list.result.tools.map((tool) => tool.name).toSorted();
}

describe("mcp endpoint", () => {
	// Catches a client that started its session on one replica being refused
	// when the load balancer sends its next request to another.
	it("answers a session that began on another replica", async () => {
		expect.assertions(2);

		const sessionId = await startSessionAsync(createMcpTransport());
		const otherReplica = createMcpTransport();
		const listed = await postAsync(
			otherReplica,
			{ id: 2, method: "tools/list", params: {} },
			{ "mcp-protocol-version": "2025-06-18", "mcp-session-id": sessionId },
		);
		const tools = isToolList.assert(listed.body);

		expect(listToolNames(tools)).toStrictEqual(["get_session", "list_sessions", "search_archive"]);
		expect(tools.result.tools.map((tool) => tool.annotations?.readOnlyHint)).toStrictEqual([true, true, true]);
	});

	// Catches a client on the sessionless protocol (MCP 2026-07-28) being
	// handed a session that only one replica knows about.
	it("answers a sessionless client without starting a session", async () => {
		expect.assertions(3);

		const listed = await postAsync(
			createMcpTransport(),
			{
				id: 3,
				method: "tools/list",
				params: {
					_meta: {
						"io.modelcontextprotocol/clientCapabilities": {},
						"io.modelcontextprotocol/clientInfo": { name: "test-client", version: "1.0.0" },
						"io.modelcontextprotocol/protocolVersion": "2026-07-28",
					},
				},
			},
			{ "mcp-method": "tools/list", "mcp-protocol-version": "2026-07-28" },
		);

		expect(listed.status).toBe(200);
		expect(listed.sessionId).toBeNull();
		expect(listToolNames(isToolList.assert(listed.body))).toHaveLength(3);
	});

	// Catches a long-lived event stream being opened, which would tie a
	// client to one replica.
	it("refuses to open an event stream", async () => {
		expect.assertions(1);

		const response = await createMcpTransport().respond(
			new Request(ENDPOINT, { headers: { accept: "text/event-stream" }, method: "GET" }),
		);

		expect(response?.status).toBe(405);
	});
});
