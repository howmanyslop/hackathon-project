import { OpenRouter } from "@openrouter/sdk";
import { isString } from "@web-template/arktype-utilities";
import { type } from "arktype";

import { getSearchClient, readOptionalSetting } from "$search/client";

import type { Client } from "@elastic/elasticsearch";
import type { Type } from "arktype";
import type { JsonObject } from "type-fest";

export type { JsonObject } from "type-fest";

/** What to ask, and the JSON Schema the answer has to follow. */
export interface CompleteJsonRequest {
	/** A short name for the answer's shape, such as `question_pairs`. */
	readonly name: string;
	readonly schema: JsonObject;
	readonly system: string;
	readonly user: string;
}

/** Long talks make long prompts, and the model writes every pair out. */
const TIMEOUT_MS = 120_000;
const MAX_COMPLETION_TOKENS = 16_000;

const isToolCall = type({
	function: type({ arguments: isString }).readonly(),
}).readonly();
const isToolCallChoice = type({
	message: type({
		tool_calls: isToolCall.array().readonly().atLeastLength(1),
	}).readonly(),
}).readonly();
const isToolCallResponse = type({
	choices: isToolCallChoice.array().readonly().atLeastLength(1),
}).readonly();

interface ChatMessage {
	readonly content: string;
	readonly role: "system" | "user";
}

function getMessages(request: CompleteJsonRequest): ReadonlyArray<ChatMessage> {
	return [
		{ content: request.system, role: "system" },
		{ content: request.user, role: "user" },
	];
}

/**
 * Asks Elastic's managed LLM through the inference API. The API has no JSON
 * mode, so the answer's shape is forced with a single tool whose parameters
 * are the schema, and a `tool_choice` that names it.
 *
 * @template Validator - The ArkType type of the answer.
 * @param client - The shared Elasticsearch client from `search/client.ts`.
 * @param request - The prompts and schema.
 * @param validator - Checks the tool call's arguments.
 * @rejects When the call fails or the model doesn't call the tool.
 * @returns The tool call's checked arguments.
 */
async function completeWithElasticAsync<Validator extends Type>(
	client: Client,
	request: CompleteJsonRequest,
	validator: Validator,
): Promise<Validator["infer"]> {
	const inferenceId = readOptionalSetting("ELASTIC_LLM_INFERENCE_ID") ?? ".anthropic-claude-5-sonnet-chat_completion";

	// The installed client has no method for the non-streaming path.
	const response = await client.transport.request(
		{
			body: {
				max_completion_tokens: MAX_COMPLETION_TOKENS,
				messages: getMessages(request),
				tool_choice: { function: { name: request.name }, type: "function" },
				tools: [
					{
						function: {
							name: request.name,
							description: "Return the answer in this shape.",
							parameters: request.schema,
						},
						type: "function",
					},
				],
			},
			method: "POST",
			path: `/_inference/chat_completion/${encodeURIComponent(inferenceId)}`,
		},
		{ requestTimeout: TIMEOUT_MS },
	);

	const { choices } = isToolCallResponse.assert(response);
	return validator.assert(JSON.parse(choices[0].message.tool_calls[0].function.arguments));
}

/**
 * Asks a model on OpenRouter through its SDK. OpenRouter enforces the
 * schema. Anthropic models answer with reasoning off; others, such as
 * Meta's Muse models, reason at their maximum unless told to keep it low.
 *
 * @template Validator - The ArkType type of the answer.
 * @param apiKey - The key from `OPENROUTER_API_KEY`.
 * @param request - The prompts and schema.
 * @param validator - Checks the answer.
 * @rejects When the call fails or the reply isn't the expected JSON.
 * @returns The checked answer.
 */
async function completeWithOpenRouterAsync<Validator extends Type>(
	apiKey: string,
	request: CompleteJsonRequest,
	validator: Validator,
): Promise<Validator["infer"]> {
	const model = readOptionalSetting("OPENROUTER_MODEL") ?? "anthropic/claude-haiku-5.5";
	const openRouter = new OpenRouter({ apiKey, timeoutMs: TIMEOUT_MS });

	const result = await openRouter.chat.send({
		chatRequest: {
			maxTokens: MAX_COMPLETION_TOKENS,
			messages: [
				{ content: request.system, role: "system" },
				{ content: request.user, role: "user" },
			],
			model,
			reasoning: { effort: model.startsWith("anthropic/") ? "none" : "low" },
			responseFormat: {
				jsonSchema: { name: request.name, schema: request.schema, strict: true },
				type: "json_schema",
			},
			stream: false,
		},
	});

	// A text reply is a string; anything else isn't the JSON that was asked for.
	const text = result.choices[0]?.message.content;
	if (!isString.allows(text) || text.trim().length === 0) {
		throw new Error("OpenRouter replied with no text.");
	}

	return validator.assert(JSON.parse(text));
}

/**
 * Asks a language model for JSON in a given shape. Elastic's managed LLM goes
 * first; when Elastic isn't configured or the call fails, OpenRouter answers
 * instead if `OPENROUTER_API_KEY` is set. The answer is checked with the
 * validator either way, because a tool call isn't held to its schema.
 *
 * @template Validator - The ArkType type of the answer.
 * @param request - The prompts, and the schema the answer must follow.
 * @param validator - The ArkType type matching that schema.
 * @rejects When no model is configured, every configured one fails, or the
 *   answer doesn't pass the validator.
 * @returns The checked answer.
 */
export async function completeJsonAsync<Validator extends Type>(
	request: CompleteJsonRequest,
	validator: Validator,
): Promise<Validator["infer"]> {
	const client = getSearchClient();
	const openRouterKey = readOptionalSetting("OPENROUTER_API_KEY");

	if (client !== undefined) {
		try {
			return await completeWithElasticAsync(client, request, validator);
		} catch (error) {
			if (openRouterKey === undefined) {
				throw error;
			}

			console.warn("Elastic's LLM failed; asking OpenRouter instead:", error);
		}
	}

	if (openRouterKey === undefined) {
		throw new Error("No language model is set up: set ELASTICSEARCH_URL and its key, or OPENROUTER_API_KEY.");
	}

	return completeWithOpenRouterAsync(openRouterKey, request, validator);
}
