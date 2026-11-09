import { env } from "node:process";
import { Client } from "@elastic/elasticsearch";
import { type } from "arktype";

const parseSearchEnvironment = type({
	"ELASTICSEARCH_API_KEY?": "string > 0",
	"ELASTICSEARCH_URL?": "string.url",
}).readonly();

const parseConfiguredSearchEnvironment = type({
	ELASTICSEARCH_API_KEY: "string > 0",
	ELASTICSEARCH_URL: "string.url",
}).readonly();

function createSearchClient(): Client | undefined {
	const environment = parseSearchEnvironment.assert(env);
	if (environment.ELASTICSEARCH_URL === undefined && environment.ELASTICSEARCH_API_KEY === undefined) {
		return undefined;
	}

	// Setting only one of the two is a mistake, so say so instead of quietly
	// running without search.
	const { ELASTICSEARCH_API_KEY, ELASTICSEARCH_URL } = parseConfiguredSearchEnvironment.assert(environment);
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
