import { env } from "node:process";
import { Client } from "@elastic/elasticsearch";
import { isNonEmptyString, isUrlString } from "@web-template/arktype-utilities";
import { type } from "arktype";

const isConfiguredSearchEnvironment = type({
	ELASTICSEARCH_API_KEY: isNonEmptyString,
	ELASTICSEARCH_URL: isUrlString,
}).readonly();

/**
 * Reads an optional environment variable. `.env.example` lists the search
 * variables with blank values, so blank means "not set" too.
 *
 * @param name - The variable's name.
 * @returns Its value, or `undefined` when it is missing or blank.
 */
export function readOptionalSetting(name: string): string | undefined {
	const value = env[name];
	return value === undefined || value.length === 0 ? undefined : value;
}

function createSearchClient(): Client | undefined {
	const url = readOptionalSetting("ELASTICSEARCH_URL");
	const apiKey = readOptionalSetting("ELASTICSEARCH_API_KEY");
	if (url === undefined && apiKey === undefined) return undefined;

	// Setting only one of the two is a mistake, so say so instead of quietly
	// running without search.
	const { ELASTICSEARCH_API_KEY, ELASTICSEARCH_URL } = isConfiguredSearchEnvironment.assert({
		ELASTICSEARCH_API_KEY: apiKey,
		ELASTICSEARCH_URL: url,
	});

	return new Client({
		auth: { apiKey: ELASTICSEARCH_API_KEY },
		node: ELASTICSEARCH_URL,
		serverMode: "serverless",
	});
}

let client: Client | undefined;
let isCreated = false;

/**
 * The Elasticsearch client for the team's Elastic Cloud Serverless project,
 * from `ELASTICSEARCH_URL` and `ELASTICSEARCH_API_KEY`. Search is optional:
 * without either variable the app runs as before and this returns
 * `undefined`.
 *
 * @returns The shared client, or `undefined` when search isn't configured.
 */
export function getSearchClient(): Client | undefined {
	if (!isCreated) {
		client = createSearchClient();
		isCreated = true;
	}

	return client;
}
