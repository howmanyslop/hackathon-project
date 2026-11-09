import { errors } from "@elastic/elasticsearch";
import { isNonEmptyString } from "@web-template/arktype-utilities";
import { type } from "arktype";

import { getSearchClient, readOptionalSetting } from "./client.ts";

import type { Client } from "@elastic/elasticsearch";

import type {
	ArchiveSearchResults,
	PairHit,
	PassageHit,
	QuestionPair,
	ThemesDigest,
	TranscriptSegment,
} from "$archive/contract";

const isIndexName = type(/^[a-z0-9][a-z0-9_-]*$/u);

/**
 * The preconfigured Elastic Inference Service endpoint that embeds `content`
 * with Jina's `jina-embeddings-v5-text-small`. It ships with the project, so
 * the app never creates an inference endpoint of its own.
 */
const EMBEDDING_INFERENCE_ID = ".jina-embeddings-v5-text-small";

/** Fields every search returns; `content` holds embeddings, so it stays out. */
const SOURCE_FIELDS = ["answer", "question", "sessionId", "sessionTitle", "speaker", "startMs", "text"];

type ArchiveDocumentKind = "pair" | "segment";

interface ArchiveDocument {
	readonly answer?: string;
	readonly content: string;
	readonly endMs: number;
	readonly indexedAt: string;
	readonly kind: ArchiveDocumentKind;
	readonly question?: string;
	readonly sessionId: number;
	readonly sessionTitle: string;
	readonly speaker: string;
	readonly startMs: number;
	readonly text: string;
}

/** The session a document belongs to, as search results show it. */
export interface IndexableSession {
	readonly id: number;
	readonly speaker: string;
	readonly title: string;
}

interface ScoredDocument {
	readonly document: ArchiveDocument;
	readonly score: number;
}

const isDigestDocument = type({ createdAt: isNonEmptyString, note: isNonEmptyString });

function readIndexName(name: string, fallback: string): string {
	const configured = readOptionalSetting(name);
	return configured === undefined ? fallback : isIndexName.assert(configured);
}

/**
 * The index that holds every segment and pair: `asked-archive` unless
 * `ELASTICSEARCH_ARCHIVE_INDEX` names another, so a laptop sharing the Elastic
 * project can keep its documents apart from the cluster's.
 *
 * @returns The index name.
 */
function getArchiveIndex(): string {
	return readIndexName("ELASTICSEARCH_ARCHIVE_INDEX", "asked-archive");
}

function getDigestIndex(): string {
	return readIndexName("ELASTICSEARCH_DIGEST_INDEX", "asked-digest");
}

/**
 * Creates the archive index unless it exists.
 *
 * @param client - The Elasticsearch client.
 * @rejects When Elasticsearch fails for any reason other than the race.
 * @returns Whether this call created it. Several copies of the app can race
 *   here, and only the one that wins sees `true`.
 */
async function createArchiveIndexAsync(client: Client): Promise<boolean> {
	if (await client.indices.exists({ index: getArchiveIndex() })) return false;

	try {
		await client.indices.create({
			index: getArchiveIndex(),
			mappings: {
				properties: {
					answer: { type: "text" },
					// Elasticsearch embeds this field with Jina at ingest, and
					// `match` queries on it embed the query text the same way.
					content: { inference_id: EMBEDDING_INFERENCE_ID, type: "semantic_text" },
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

/**
 * Sets up search once the database is migrated by creating the archive index
 * if it is missing. Postgres stays the source of truth; Elasticsearch only
 * answers searches.
 *
 * @returns A short description of what happened, for the startup log.
 */
export async function setUpArchiveSearchAsync(): Promise<string> {
	const client = getSearchClient();
	if (client === undefined) return "Search is off: ELASTICSEARCH_URL and ELASTICSEARCH_API_KEY are not set.";

	return (await createArchiveIndexAsync(client))
		? `Search is on: created the ${getArchiveIndex()} index.`
		: `Search is on: the ${getArchiveIndex()} index already exists.`;
}

async function writeDocumentsAsync(
	client: Client,
	documents: ReadonlyArray<readonly [id: string, document: ArchiveDocument]>,
): Promise<void> {
	if (documents.length === 0) return;

	const index = getArchiveIndex();
	const operations = documents.flatMap(([id, document]) => [{ index: { _id: id, _index: index } }, document]);
	const response = await client.bulk({ operations });
	if (response.errors) {
		throw new Error(`Elasticsearch rejected some documents for the ${index} index.`);
	}
}

/**
 * Copies finished sentences into the search index as they arrive. Does
 * nothing when search is off.
 *
 * @param session - The session they were spoken in.
 * @param segments - The new segments.
 * @returns Resolves once Elasticsearch has accepted them.
 */
export async function indexSegmentsAsync(
	session: IndexableSession,
	segments: ReadonlyArray<TranscriptSegment>,
): Promise<void> {
	const client = getSearchClient();
	if (client === undefined) return;

	const indexedAt = new Date().toISOString();
	await writeDocumentsAsync(
		client,
		segments.map((segment) => [
			`segment-${session.id}-${segment.sequence}`,
			{
				content: segment.text,
				endMs: segment.endMs,
				indexedAt,
				kind: "segment",
				sessionId: session.id,
				sessionTitle: session.title,
				speaker: session.speaker,
				startMs: segment.startMs,
				text: segment.text,
			},
		]),
	);
}

/**
 * Replaces a session's pairs in the search index with a new split: deletes
 * the old pair documents, then indexes the new ones. Does nothing when search
 * is off.
 *
 * @param session - The session the pairs belong to.
 * @param pairs - Every pair the session has now.
 * @returns Resolves once Elasticsearch has accepted the change.
 */
export async function replaceSessionPairsAsync(
	session: IndexableSession,
	pairs: ReadonlyArray<QuestionPair>,
): Promise<void> {
	const client = getSearchClient();
	if (client === undefined) return;

	await client.deleteByQuery({
		conflicts: "proceed",
		index: getArchiveIndex(),
		query: { bool: { filter: [{ term: { kind: "pair" } }, { term: { sessionId: session.id } }] } },
	});

	const indexedAt = new Date().toISOString();
	await writeDocumentsAsync(
		client,
		pairs.map((pair) => {
			const text = `${pair.question} ${pair.answer}`;
			return [
				`pair-${session.id}-${pair.ordinal}`,
				{
					answer: pair.answer,
					content: text,
					endMs: pair.endMs,
					indexedAt,
					kind: "pair",
					question: pair.question,
					sessionId: session.id,
					sessionTitle: session.title,
					speaker: session.speaker,
					startMs: pair.startMs,
					text,
				},
			];
		}),
	);
}

/**
 * Removes every document of a deleted session, and the themes note, which
 * may summarize it. The hourly workflow writes a fresh note. Does nothing
 * when search is off.
 *
 * @param sessionId - The deleted session's id.
 * @returns Resolves once Elasticsearch has removed them.
 */
export async function deleteSessionDocumentsAsync(sessionId: number): Promise<void> {
	const client = getSearchClient();
	if (client === undefined) return;

	await client.deleteByQuery({
		conflicts: "proceed",
		index: getArchiveIndex(),
		query: { term: { sessionId } },
	});
	await client.delete({ id: "latest", index: getDigestIndex() }, { ignore: [404] });
}

/** The most answered questions one search shows. */
const MAXIMUM_PAIRS = 6;

/** The most passages one search shows; past six they repeat each other. */
const MAXIMUM_PASSAGES = 6;

/**
 * The lowest score each kind of hit needs. A meaning search always returns
 * its nearest documents, however unrelated, so without a floor "where can I
 * park" would list answered questions. Scores run from 0.5 (unrelated) to 1
 * (same meaning). Measured on the four sample talks with 15 reworded real
 * questions and 9 unrelated ones (lunch, parking, wifi password, and so on).
 */
const MINIMUM_SCORES: Readonly<Record<ArchiveDocumentKind, number>> = {
	// Every reworded question found its pair at 0.645 or more ("what happens
	// when a machine goes down" was the lowest). The best unrelated hit was
	// 0.611 ("when does the keynote start"); the rest stayed under 0.57.
	pair: 0.63,
	// The passage holding each reworded question's answer scored 0.674 or
	// more. Unrelated queries scored 0.57 to 0.65, except four that hit a
	// passage with the same word, such as "free coffee" (0.76) or "right
	// after lunch" (0.70). Those four stay; real matches matter more.
	segment: 0.66,
};

async function searchKindAsync(
	client: Client,
	kind: ArchiveDocumentKind,
	query: string,
	limit: number,
): Promise<ReadonlyArray<ScoredDocument>> {
	const response = await client.search<ArchiveDocument>({
		_source: SOURCE_FIELDS,
		index: getArchiveIndex(),
		min_score: MINIMUM_SCORES[kind],
		query: { bool: { filter: [{ term: { kind } }], must: [{ match: { content: query } }] } },
		size: limit,
	});

	return response.hits.hits.flatMap((hit) =>
		hit._source === undefined ? [] : [{ document: hit._source, score: hit._score ?? 0 }],
	);
}

/**
 * Finds answered questions and passages by meaning rather than exact words,
 * so "does it work without wifi" finds "can I use it offline?".
 *
 * @param query - What to look for, in plain language.
 * @param limit - The most results of each kind to return, six at most.
 * @returns The best matches first, or `undefined` when search is off.
 */
export async function searchArchiveAsync(
	query: string,
	limit = MAXIMUM_PAIRS,
): Promise<ArchiveSearchResults | undefined> {
	const client = getSearchClient();
	if (client === undefined) return undefined;

	const [pairHits, passageHits] = await Promise.all([
		searchKindAsync(client, "pair", query, Math.min(limit, MAXIMUM_PAIRS)),
		searchKindAsync(client, "segment", query, Math.min(limit, MAXIMUM_PASSAGES)),
	]);

	const pairs = pairHits.map(({ document, score }): PairHit => ({
		answer: document.answer ?? "",
		question: document.question ?? "",
		score,
		sessionId: document.sessionId,
		sessionTitle: document.sessionTitle,
		speaker: document.speaker,
		startMs: document.startMs,
	}));
	const passages = passageHits.map(({ document, score }): PassageHit => ({
		score,
		sessionId: document.sessionId,
		sessionTitle: document.sessionTitle,
		speaker: document.speaker,
		startMs: document.startMs,
		text: document.text,
	}));

	return { pairs, passages };
}

/**
 * Reads the newest "what people are asking" note, which an Elastic workflow
 * writes every hour as document `latest` in the digest index.
 *
 * @rejects When Elasticsearch fails for any reason but a missing note.
 * @returns The note, or `undefined` when search is off or no note exists yet.
 */
export async function readDigestAsync(): Promise<ThemesDigest | undefined> {
	const client = getSearchClient();
	if (client === undefined) return undefined;

	try {
		const response = await client.get({ id: "latest", index: getDigestIndex() });
		const digest = isDigestDocument(response._source);
		return digest instanceof type.errors ? undefined : { createdAt: digest.createdAt, note: digest.note };
	} catch (error) {
		if (error instanceof errors.ResponseError && error.statusCode === 404) return undefined;

		throw error;
	}
}
