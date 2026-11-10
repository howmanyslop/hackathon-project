#!/usr/bin/env bun

/**
 * Creates, or updates when they exist, the Elastic pieces Asked & Answered
 * uses: the archive and digest indices, three Agent Builder tools, the
 * agent, and the hourly "What people are asking" workflow. Every definition
 * lives in `elastic/`. Safe to run again.
 */

import { readFile } from "node:fs/promises";
import nodePath from "node:path";
import { argv, env, exit } from "node:process";
import { parseArgs } from "node:util";
import { type } from "arktype";
import { consola } from "consola";

const SCRIPT_NAME = "set-up-elastic";
const log = consola.withTag(SCRIPT_NAME);

const USAGE = `Usage: ${SCRIPT_NAME} [options]

Creates or updates the Elastic indices, tools, agent, and workflow.

Options:
  -h, --help        Show this help.
  --run-workflow    Run the digest workflow once after setting it up.`;

const ELASTIC_DIRECTORY = nodePath.join(import.meta.dirname, "..", "elastic");
const TOOL_FILES = ["search-answered-questions.json", "search-talk-passages.json", "count-questions-by-session.json"];
const WORKFLOW_ID = "asked-themes-digest";

// The tools and the workflow name these indices, so they are fixed here too.
const ARCHIVE_INDEX = "asked-archive";
const DIGEST_INDEX = "asked-digest";

const isJsonObject = type("Record<string, unknown>");

const isToolDefinition = type({
	id: "string",
	configuration: isJsonObject,
	description: "string",
	"tags?": "string[] | undefined",
	type: "string",
}).readonly();

const isAgentDefinition = type({
	id: "string",
	name: "string",
	"access_control?": isJsonObject.or("undefined"),
	configuration: isJsonObject,
	description: "string",
	"labels?": "string[] | undefined",
}).readonly();

// Kibana answers a workflow create or update with whether the YAML is valid.
const isWorkflowReply = type({
	enabled: "boolean",
	valid: "boolean",
	"validationErrors?": "unknown[] | undefined",
}).readonly();

type ToolDefinition = typeof isToolDefinition.infer;

type AgentDefinition = typeof isAgentDefinition.infer;

interface FieldMapping {
	readonly inference_id?: string;
	readonly type: string;
}

interface IndexMappings {
	readonly properties: Readonly<Record<string, FieldMapping>>;
}

interface Connection {
	readonly apiKey: string;
	readonly elasticsearchUrl: string;
	readonly kibanaUrl: string;
}

interface ApiResponse {
	readonly body: unknown;
	readonly status: number;
}

interface Options {
	readonly runWorkflow: boolean;
}

interface ApiRequest {
	readonly body?: unknown;
	readonly method: "GET" | "HEAD" | "POST" | "PUT";
	readonly url: string;
}

// The same mapping the app creates, so the ES|QL tool and the workflow work
// before the first talk is recorded.
const ARCHIVE_MAPPINGS: IndexMappings = {
	properties: {
		answer: { type: "text" },
		content: { inference_id: ".jina-embeddings-v5-text-small", type: "semantic_text" },
		endMs: { type: "integer" },
		indexedAt: { type: "date" },
		kind: { type: "keyword" },
		question: { type: "text" },
		sessionId: { type: "integer" },
		sessionTitle: { type: "text" },
		speaker: { type: "text" },
		startMs: { type: "integer" },
		text: { type: "text" },
	},
};

const DIGEST_MAPPINGS: IndexMappings = {
	properties: {
		createdAt: { type: "date" },
		note: { type: "text" },
	},
};

function readSetting(name: string): string | undefined {
	const value = env[name];
	return value === undefined || value.length === 0 ? undefined : value;
}

function getConnection(): Connection {
	const elasticsearchUrl = readSetting("ELASTICSEARCH_URL");
	const apiKey = readSetting("ELASTICSEARCH_API_KEY");
	if (elasticsearchUrl === undefined || apiKey === undefined) {
		log.error("Set ELASTICSEARCH_URL and ELASTICSEARCH_API_KEY first (see .env.example).");
		exit(1);
	}

	// Kibana's address is Elasticsearch's with `.es.` changed to `.kb.`.
	const kibanaUrl = readSetting("KIBANA_URL") ?? elasticsearchUrl.replace(".es.", ".kb.");
	return {
		apiKey,
		elasticsearchUrl: new URL(elasticsearchUrl).origin,
		kibanaUrl: new URL(kibanaUrl).origin,
	};
}

async function sendRequestAsync(connection: Connection, request: ApiRequest): Promise<ApiResponse> {
	const response = await fetch(request.url, {
		body: request.body === undefined ? undefined : JSON.stringify(request.body),
		headers: {
			Authorization: `ApiKey ${connection.apiKey}`,
			"Content-Type": "application/json",
			"kbn-xsrf": "true",
		},
		method: request.method,
	});
	const text = await response.text();
	let body: unknown = text;
	try {
		body = text.length === 0 ? undefined : JSON.parse(text);
	} catch {
		// Not JSON; keep the text for the error message.
	}

	return { body, status: response.status };
}

async function sendOrFailAsync(connection: Connection, request: ApiRequest): Promise<ApiResponse> {
	const response = await sendRequestAsync(connection, request);
	if (response.status >= 400) {
		const path = new URL(request.url).pathname;
		log.error(`${request.method} ${path} failed with ${response.status}:`, response.body);
		exit(1);
	}

	return response;
}

async function ensureIndexAsync(connection: Connection, name: string, mappings: IndexMappings): Promise<void> {
	const url = `${connection.elasticsearchUrl}/${name}`;
	const existing = await sendRequestAsync(connection, { method: "HEAD", url });
	if (existing.status === 200) {
		log.info(`Index ${name} already exists`);
		return;
	}

	await sendOrFailAsync(connection, { body: { mappings }, method: "PUT", url });
	log.success(`Created index ${name}`);
}

async function readToolAsync(fileName: string): Promise<ToolDefinition> {
	const text = await readFile(nodePath.join(ELASTIC_DIRECTORY, "tools", fileName), "utf8");
	return isToolDefinition.assert(JSON.parse(text));
}

async function readAgentAsync(): Promise<AgentDefinition> {
	const text = await readFile(nodePath.join(ELASTIC_DIRECTORY, "agent.json"), "utf8");
	return isAgentDefinition.assert(JSON.parse(text));
}

async function upsertToolAsync(connection: Connection, fileName: string): Promise<void> {
	const tool = await readToolAsync(fileName);
	const url = `${connection.kibanaUrl}/api/agent_builder/tools/${encodeURIComponent(tool.id)}`;
	const existing = await sendRequestAsync(connection, { method: "GET", url });
	if (existing.status === 404) {
		await sendOrFailAsync(connection, {
			body: tool,
			method: "POST",
			url: `${connection.kibanaUrl}/api/agent_builder/tools`,
		});
		log.success(`Created tool ${tool.id}`);
		return;
	}

	// An update may not change the id or the type.
	const update = { configuration: tool.configuration, description: tool.description, tags: tool.tags };
	await sendOrFailAsync(connection, { body: update, method: "PUT", url });
	log.success(`Updated tool ${tool.id}`);
}

async function upsertAgentAsync(connection: Connection): Promise<void> {
	const agent = await readAgentAsync();
	const url = `${connection.kibanaUrl}/api/agent_builder/agents/${encodeURIComponent(agent.id)}`;
	const existing = await sendRequestAsync(connection, { method: "GET", url });
	if (existing.status === 404) {
		await sendOrFailAsync(connection, {
			body: agent,
			method: "POST",
			url: `${connection.kibanaUrl}/api/agent_builder/agents`,
		});
		log.success(`Created agent ${agent.id}`);
		return;
	}

	// An update may not change the id or who can use the agent.
	const update = {
		name: agent.name,
		configuration: agent.configuration,
		description: agent.description,
		labels: agent.labels,
	};

	await sendOrFailAsync(connection, { body: update, method: "PUT", url });
	log.success(`Updated agent ${agent.id}`);
}

function assertWorkflowUsable(response: ApiResponse): void {
	const workflow = isWorkflowReply(response.body);
	if (workflow instanceof type.errors) {
		log.error(`Kibana's workflow reply has an unexpected shape: ${workflow.summary}`, response.body);
		exit(1);
	}

	if (!workflow.valid) {
		log.error(`Workflow ${WORKFLOW_ID} is not valid:`, workflow.validationErrors ?? []);
		exit(1);
	}

	if (!workflow.enabled) {
		log.error(`Workflow ${WORKFLOW_ID} came back disabled.`, workflow.validationErrors ?? []);
		exit(1);
	}
}

async function upsertWorkflowAsync(connection: Connection): Promise<void> {
	const yaml = await readFile(nodePath.join(ELASTIC_DIRECTORY, "workflows", "themes-digest.yaml"), "utf8");
	const url = `${connection.kibanaUrl}/api/workflows/workflow/${WORKFLOW_ID}`;
	const existing = await sendRequestAsync(connection, { method: "GET", url });
	if (existing.status === 404) {
		const created = await sendOrFailAsync(connection, {
			body: { id: WORKFLOW_ID, yaml },
			method: "POST",
			url: `${connection.kibanaUrl}/api/workflows/workflow`,
		});

		assertWorkflowUsable(created);
		log.success(`Created workflow ${WORKFLOW_ID}`);
		return;
	}

	const updated = await sendOrFailAsync(connection, { body: { yaml }, method: "PUT", url });
	assertWorkflowUsable(updated);
	log.success(`Updated workflow ${WORKFLOW_ID}`);
}

async function runWorkflowAsync(connection: Connection): Promise<void> {
	const run = await sendOrFailAsync(connection, {
		body: { inputs: {} },
		method: "POST",
		url: `${connection.kibanaUrl}/api/workflows/workflow/${WORKFLOW_ID}/run`,
	});

	log.success("Started the digest workflow:", run.body);
}

function parseOptions(): Options {
	let runWorkflow = false;
	try {
		const { values } = parseArgs({
			args: argv.slice(2),
			options: {
				help: { short: "h", type: "boolean" },
				"run-workflow": { type: "boolean" },
			},
		});

		if (values.help === true) {
			console.log(USAGE);
			exit(0);
		}

		runWorkflow = values["run-workflow"] === true;
	} catch (error) {
		console.error(`${error instanceof Error ? error.message : String(error)}\n\n${USAGE}`);
		exit(1);
	}

	return { runWorkflow };
}

async function setUpElasticAsync(): Promise<void> {
	const { runWorkflow } = parseOptions();
	const connection = getConnection();
	log.info(`Kibana: ${new URL(connection.kibanaUrl).host}`);

	await ensureIndexAsync(connection, ARCHIVE_INDEX, ARCHIVE_MAPPINGS);
	await ensureIndexAsync(connection, DIGEST_INDEX, DIGEST_MAPPINGS);

	// The agent names the tools, so they must exist first.
	await Promise.all(TOOL_FILES.map(async (fileName) => upsertToolAsync(connection, fileName)));
	await upsertAgentAsync(connection);
	await upsertWorkflowAsync(connection);

	if (runWorkflow) {
		await runWorkflowAsync(connection);
	}

	log.success("Elastic is set up.");
}

await setUpElasticAsync();
