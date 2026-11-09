#!/usr/bin/env node

/**
 * Records the sample talks in `apps/web/seed/` through the app's own
 * procedures, as a presenter's phone would: start the session, send the
 * transcript in batches, mark the Q&A, end the session. Ending it splits the
 * Q&A into question-and-answer pairs and indexes them, for real.
 *
 * Talks whose title is already in the archive are skipped, so running it
 * twice is safe.
 *
 * Usage: node apps/web/scripts/seed-archive.ts <base-url>
 * Needs PRESENTER_CODE in the environment (`mise run seed` finds it).
 */

import { readdir, readFile } from "node:fs/promises";
import nodePath from "node:path";
import { argv, env, exit } from "node:process";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { SimpleCsrfProtectionLinkPlugin } from "@orpc/client/plugins";
import { type } from "arktype";

import type { RouterClient } from "@orpc/server";

import type router from "../src/orpc/router/index.ts";

/** How many segments go in one `appendSegments` call. */
const BATCH_SIZE = 50;

const SEED_DIRECTORY = nodePath.join(import.meta.dirname, "..", "seed");

const isSeedSegment = type({
	endMs: "number",
	startMs: "number",
	text: "string",
});

const isSeedTalk = type({
	"qaStartMs?": "number",
	"recordingUrl?": "string",
	segments: isSeedSegment.array(),
	speaker: "string",
	title: "string",
});

type SeedTalk = typeof isSeedTalk.infer;

type ArchiveClient = RouterClient<typeof router>;

interface RecordTalkParameters {
	readonly client: ArchiveClient;
	readonly presenterCode: string;
	readonly talk: SeedTalk;
}

function readRequiredSetting(name: string, hint: string): string {
	const value = env[name];
	if (value === undefined || value.length === 0) {
		console.error(`Set ${name}. ${hint}`);
		exit(1);
	}

	return value;
}

function createArchiveClient(baseUrl: string): ArchiveClient {
	const link = new RPCLink({
		plugins: [new SimpleCsrfProtectionLinkPlugin()],
		url: new URL("/api/rpc", baseUrl).href,
	});

	return createORPCClient(link);
}

async function readTalkAsync(fileName: string): Promise<SeedTalk> {
	const contents = await readFile(nodePath.join(SEED_DIRECTORY, fileName), "utf8");
	return isSeedTalk.assert(JSON.parse(contents));
}

async function readTalksAsync(): Promise<ReadonlyArray<SeedTalk>> {
	const entries = await readdir(SEED_DIRECTORY);
	const fileNames = entries.filter((name) => name.endsWith(".json"));
	fileNames.sort();

	return Promise.all(fileNames.map(async (fileName) => readTalkAsync(fileName)));
}

async function recordTalkAsync({ client, presenterCode, talk }: RecordTalkParameters): Promise<void> {
	const { id: sessionId } = await client.startSession({
		presenterCode,
		recordingUrl: talk.recordingUrl,
		speaker: talk.speaker,
		title: talk.title,
	});

	const segments = talk.segments.map((segment, sequence) => ({ ...segment, sequence }));
	for (let start = 0; start < segments.length; start += BATCH_SIZE) {
		// oxlint-disable-next-line eslint/no-await-in-loop -- sent in order, as the phone does
		await client.appendSegments({
			presenterCode,
			segments: segments.slice(start, start + BATCH_SIZE),
			sessionId,
		});
	}

	if (talk.qaStartMs !== undefined) {
		await client.markQaStart({ offsetMs: talk.qaStartMs, presenterCode, sessionId });
	}

	const { pairCount } = await client.endSession({ presenterCode, sessionId });
	console.info(`Recorded session ${sessionId}: ${talk.title} (${segments.length} segments, ${pairCount} pairs)`);
}

const baseUrl = argv.at(2);

if (baseUrl === undefined || baseUrl.length === 0) {
	console.error("Usage: node apps/web/scripts/seed-archive.ts <base-url>");
	exit(1);
}

const presenterCode = readRequiredSetting("PRESENTER_CODE", "`mise run seed` reads it from the cluster.");
const client = createArchiveClient(baseUrl);
const talks = await readTalksAsync();
const sessions = await client.listSessions({});
const existingByTitle = new Map(sessions.map((session) => [session.title, session]));

for (const talk of talks) {
	const existing = existingByTitle.get(talk.title);
	if (existing?.status === "ended" && existing.pairCount > 0) {
		console.info(`Skipped, already recorded: ${talk.title}`);
		continue;
	}

	// A run that failed halfway left the talk live or without pairs. Ending it
	// again is harmless and splits it again.
	if (existing !== undefined) {
		// oxlint-disable-next-line eslint/no-await-in-loop -- one talk at a time keeps the LLM calls gentle
		const { pairCount } = await client.endSession({ presenterCode, sessionId: existing.id });
		console.info(`Finished session ${existing.id}: ${talk.title} (${pairCount} pairs)`);
		continue;
	}

	// oxlint-disable-next-line eslint/no-await-in-loop -- one talk at a time keeps the LLM calls gentle
	await recordTalkAsync({ client, presenterCode, talk });
}

console.info(`Done: ${talks.length} sample talks in ${baseUrl}`);
