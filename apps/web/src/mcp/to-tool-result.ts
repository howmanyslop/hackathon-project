import { tool } from "tmcp/utils";

import type { CallToolResult } from "tmcp";

import type { ArchiveSearchResults, SessionDetail, SessionSummary } from "$archive/contract";

type ToolResult = CallToolResult<undefined>;

/** Everything a tool can send back. */
type ToolOutput = ArchiveSearchResults | ReadonlyArray<SessionSummary> | SessionDetail;

/**
 * Runs a tool's work and turns a failure into a tool error. The endpoint is
 * public, so the real error goes to the log and the client gets a plain
 * sentence.
 *
 * @param work - The tool's body.
 * @returns Its result, or a tool error when it throws.
 */
export async function runToolAsync(work: () => Promise<ToolResult>): Promise<ToolResult> {
	try {
		return await work();
	} catch (error) {
		console.error("An MCP tool failed:", error);
		return tool.error("The archive couldn't answer that right now. Try again in a moment.");
	}
}

/**
 * Sends what a tool found back as indented JSON text.
 *
 * @param output - Search results, sessions, or one session.
 * @returns The tool result.
 */
export function toJsonResult(output: ToolOutput): ToolResult {
	return tool.text(JSON.stringify(output, undefined, 2));
}
