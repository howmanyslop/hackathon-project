import { errors } from "@elastic/elasticsearch";
import { type } from "arktype";
import { asc } from "drizzle-orm";

import { getDatabase } from "$db/index";
import { todos } from "$db/schema";

import { getSearchClient, readOptionalSetting } from "./client.ts";

import type { Client } from "@elastic/elasticsearch";

const isIndexName = type(/^[a-z0-9][a-z0-9_-]*$/u);

/**
 * The Elasticsearch index that mirrors the `todos` table: `todos` in the
 * cluster. Every Postgres database numbers its todos from 1, so a laptop
 * sharing the Elastic project sets `ELASTICSEARCH_TODO_INDEX` to its own name
 * rather than overwriting the cluster's documents. Read on use, like the
 * client, so importing this module needs no environment.
 *
 * @returns The index name.
 */
function getTodoIndex(): string {
	const configured = readOptionalSetting("ELASTICSEARCH_TODO_INDEX");
	return configured === undefined ? "todos" : isIndexName.assert(configured);
}

/**
 * The inference endpoint that embeds todo names. It runs Jina's
 * `jina-embeddings-v3` on the Elastic Inference Service, so the project needs
 * no machine learning nodes of its own.
 */
const EMBEDDING_INFERENCE_ID = "jina-embeddings-v3";

interface TodoDocument {
	readonly id: number;
	readonly name: string;
	readonly createdAt: string;
}

export interface TodoSearchResult {
	readonly id: number;
	readonly name: string;
	readonly score: number;
}

interface IndexableTodo {
	readonly id: number;
	readonly name: string;
	readonly createdAt: Date;
}

function toDocument(todo: IndexableTodo): TodoDocument {
	return { id: todo.id, name: todo.name, createdAt: todo.createdAt.toISOString() };
}

async function ensureInferenceEndpointAsync(client: Client): Promise<void> {
	try {
		await client.inference.get({ inference_id: EMBEDDING_INFERENCE_ID });
		return;
	} catch (error) {
		const isMissing = error instanceof errors.ResponseError && error.statusCode === 404;
		if (!isMissing) {
			throw error;
		}
	}

	await client.inference.put({
		inference_config: {
			service: "elastic",
			service_settings: { model_id: "jina-embeddings-v3" },
		},
		inference_id: EMBEDDING_INFERENCE_ID,
		task_type: "text_embedding",
	});
}

/**
 * Creates the todo index unless it exists.
 *
 * @param client - The Elasticsearch client.
 * @rejects When Elasticsearch fails for any reason other than the race.
 * @returns Whether this call created it. Two copies of the app can race here,
 *   and only the one that wins sees `true`.
 */
async function createTodoIndexAsync(client: Client): Promise<boolean> {
	if (await client.indices.exists({ index: getTodoIndex() })) return false;

	try {
		await client.indices.create({
			index: getTodoIndex(),
			mappings: {
				properties: {
					id: { type: "integer" },
					// Elasticsearch embeds this field with Jina at ingest, and
					// `semantic` queries embed the query text the same way.
					name: { inference_id: EMBEDDING_INFERENCE_ID, type: "semantic_text" },
					createdAt: { type: "date" },
				},
			},
		});
		return true;
	} catch (error) {
		// Another copy of the app created it between the check and here.
		const isAlreadyCreated = error instanceof errors.ResponseError && error.statusCode === 400;
		if (isAlreadyCreated) return false;

		throw error;
	}
}

async function backfillTodosAsync(client: Client): Promise<number> {
	const rows = await getDatabase().select().from(todos).orderBy(asc(todos.id));
	if (rows.length === 0) return 0;

	const operations = rows.flatMap((todo) => [
		{ index: { _id: String(todo.id), _index: getTodoIndex() } },
		toDocument(todo),
	]);
	const response = await client.bulk({ operations });
	if (response.errors) {
		throw new Error(`Elasticsearch rejected some todos while backfilling the ${getTodoIndex()} index.`);
	}

	return rows.length;
}

/**
 * Sets up search once the database is migrated: the Jina inference endpoint,
 * the todo index, and, when the index is new, a copy of every existing todo.
 * Postgres stays the source of truth; Elasticsearch only answers searches.
 *
 * @returns A short description of what happened, for the startup log.
 */
export async function setUpTodoSearchAsync(): Promise<string> {
	const client = getSearchClient();
	if (client === undefined) return "Search is off: ELASTICSEARCH_URL and ELASTICSEARCH_API_KEY are not set.";

	await ensureInferenceEndpointAsync(client);

	if (!(await createTodoIndexAsync(client))) return `Search is on: the ${getTodoIndex()} index already exists.`;

	const count = await backfillTodosAsync(client);
	return `Search is on: created the ${getTodoIndex()} index and copied ${count} todos into it.`;
}

/**
 * Copies one todo into the search index. Does nothing when search is off.
 *
 * @param todo - The todo as stored in Postgres.
 * @returns Resolves once Elasticsearch has accepted the document.
 */
export async function indexTodoAsync(todo: IndexableTodo): Promise<void> {
	const client = getSearchClient();
	if (client === undefined) return;

	await client.index({ id: String(todo.id), document: toDocument(todo), index: getTodoIndex() });
}

/**
 * Finds todos by meaning rather than exact words, so "buy milk" finds
 * "pick up groceries".
 *
 * @param query - What to look for, in plain language.
 * @param limit - The most results to return.
 * @returns The best matches first, or `undefined` when search is off.
 */
export async function searchTodosAsync(
	query: string,
	limit: number,
): Promise<ReadonlyArray<TodoSearchResult> | undefined> {
	const client = getSearchClient();
	if (client === undefined) return undefined;

	const response = await client.search<TodoDocument>({
		_source: ["id", "name"],
		index: getTodoIndex(),
		query: { semantic: { field: "name", query } },
		size: limit,
	});

	return response.hits.hits.flatMap((hit) =>
		hit._source === undefined ? [] : [{ id: hit._source.id, name: hit._source.name, score: hit._score ?? 0 }],
	);
}
