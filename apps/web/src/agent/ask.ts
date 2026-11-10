import {
	isInteger,
	isMaybeNull,
	isMaybeNumber,
	isNumber,
	isReadonlyArrayOfUnknowns,
	isString,
	isUndefined,
	isUnknown,
} from "@web-template/arktype-utilities";
import { type } from "arktype";

import { readOptionalSetting } from "$search/client";

import { selectQuotedSources } from "./quoted-sources";

import type { AnswerSource, ArchiveAnswer } from "$archive/contract";

import type { TokenUsage } from "./ask-budget";

const TIMEOUT_MS = 60_000;

const isToolResult = type({ "data?": isUnknown }).readonly();

const isModelUsage = type({
	"input_tokens?": isMaybeNumber,
	"output_tokens?": isMaybeNumber,
}).readonly();
const isMessageObject = type({
	message: isString,
}).readonly();

const isConverseStep = type({
	"results?": isToolResult.array().readonly().or(isUndefined),
	type: isString,
}).readonly();

type ConverseStep = typeof isConverseStep.infer;

const isConverseResponse = type({
	"model_usage?": isModelUsage.or(isUndefined),
	response: isMessageObject,
	"steps?": isConverseStep.array().readonly().or(isUndefined),
}).readonly();

const isColumn = type({
	name: isString,
}).readonly();

const isValues = isReadonlyArrayOfUnknowns.array().readonly();

/** An ES|QL tool's answer: named columns and rows of values. */
const isTableData = type({
	columns: isColumn.array().readonly(),
	values: isValues,
}).readonly();

type TableData = typeof isTableData.infer;

const isTableSource = type({
	sessionId: isInteger,
	sessionTitle: isString.or(isMaybeNull),
	startMs: isNumber.or(isMaybeNull),
}).readonly();

interface AgentSettings {
	readonly agentId: string;
	readonly apiKey: string;
	readonly kibanaUrl: string;
}

/** The agent's answer, and the tokens it says it used, if it says. */
interface AgentReply {
	readonly answer: ArchiveAnswer;
	readonly usage: TokenUsage | undefined;
}

/**
 * Kibana's address: `KIBANA_URL`, or else the Elasticsearch address with
 * `.es.` turned into `.kb.`, which is how Elastic Cloud names the two.
 *
 * @returns Kibana's base URL without a trailing slash, or `undefined`.
 */
function getKibanaUrl(): string | undefined {
	const configured = readOptionalSetting("KIBANA_URL");
	if (configured !== undefined) return configured.endsWith("/") ? configured.slice(0, -1) : configured;

	const elasticsearchUrl = readOptionalSetting("ELASTICSEARCH_URL");
	if (elasticsearchUrl === undefined) return undefined;

	const url = new URL(elasticsearchUrl);
	url.hostname = url.hostname.replace(".es.", ".kb.");
	return url.origin;
}

function readAgentSettings(): AgentSettings | undefined {
	const apiKey = readOptionalSetting("ELASTICSEARCH_API_KEY");
	const kibanaUrl = getKibanaUrl();
	if (apiKey === undefined || kibanaUrl === undefined) return undefined;

	return { agentId: readOptionalSetting("ELASTIC_AGENT_ID") ?? "asked-and-answered", apiKey, kibanaUrl };
}

/**
 * Reads the rows of an ES|QL answer that name a session.
 *
 * @param table - The tool's columns and rows.
 * @returns A source per row that has a `sessionId` column value.
 */
function readTableSources(table: TableData): ReadonlyArray<AnswerSource> {
	const names = table.columns.map((column) => column.name);

	return table.values.flatMap((row) => {
		const source = isTableSource({
			sessionId: row[names.indexOf("sessionId")],
			sessionTitle: row[names.indexOf("sessionTitle")],
			startMs: row[names.indexOf("startMs")],
		});

		if (source instanceof type.errors) {
			return [];
		}

		return [{ sessionId: source.sessionId, sessionTitle: source.sessionTitle ?? "", startMs: source.startMs ?? 0 }];
	});
}

/**
 * Reads every session row the agent's ES|QL tools returned.
 *
 * @param steps - Everything the agent did while answering, in order.
 * @returns The rows, in the order the tools returned them.
 */
function collectToolRows(steps: ReadonlyArray<ConverseStep>): ReadonlyArray<AnswerSource> {
	const toolCalls = steps.filter((step) => step.type === "tool_call");
	const results = toolCalls.flatMap((step) => step.results ?? []);

	return results.flatMap((result) => {
		const table = isTableData(result.data);
		return table instanceof type.errors ? [] : readTableSources(table);
	});
}

/**
 * Asks the Elastic Agent Builder agent a question about the archive. The
 * agent searches the archive index with its own tools and writes the answer.
 *
 * @param question - The question, in plain language.
 * @rejects When Kibana answers with an error or takes over a minute.
 * @returns The answer, the sessions it drew on, and the tokens the agent
 *   reported using, or `undefined` when the agent isn't configured.
 */
export async function askArchiveAsync(question: string): Promise<AgentReply | undefined> {
	const settings = readAgentSettings();
	if (settings === undefined) return undefined;

	const response = await fetch(`${settings.kibanaUrl}/api/agent_builder/converse`, {
		body: JSON.stringify({ agent_id: settings.agentId, input: question }),
		headers: {
			Authorization: `ApiKey ${settings.apiKey}`,
			"Content-Type": "application/json",
			"kbn-xsrf": "true",
		},
		method: "POST",
		signal: AbortSignal.timeout(TIMEOUT_MS),
	});

	if (!response.ok) {
		const detail = await response.text();
		throw new Error(`Agent Builder answered ${response.status}: ${detail.slice(0, 500)}`);
	}

	const body = isConverseResponse.assert(await response.json());
	const answer = body.response.message;

	// Agent Builder reports the tokens behind each answer in `model_usage`.
	const usage = body.model_usage;
	const reportsUsage = usage?.input_tokens !== undefined || usage?.output_tokens !== undefined;

	return {
		answer: {
			answer,
			sources: selectQuotedSources(answer, collectToolRows(body.steps ?? [])),
		},
		usage: reportsUsage
			? { inputTokens: usage.input_tokens ?? 0, outputTokens: usage.output_tokens ?? 0 }
			: undefined,
	};
}
