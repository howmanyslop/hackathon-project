import { ORPCError, os } from "@orpc/server";
import { isUndefined } from "@web-template/arktype-utilities";
import { type } from "arktype";

import { askArchiveAsync } from "$agent/ask";
import { calculateUsageCost, judgeAsk, readDollarsAsMicros } from "$agent/ask-budget";
import { logAskAsync, readAskSpendingAsync, setAskCostAsync } from "$agent/ask-log";
import { recordQuestionAsync } from "$archive/question-log";
import { readDigestAsync, searchArchiveAsync } from "$search/archive";
import { readOptionalSetting } from "$search/client";
import { createRateLimiter } from "$server/rate-limit";
import { createShortCache } from "$server/short-cache";

import type { ArchiveAnswer, ArchiveSearchResults, ThemesDigest } from "$archive/contract";
import type { RequestContext } from "$server/request-context";

// Every search runs two paid embeddings, so one address gets 30 a minute.
const isSearchAllowed = createRateLimiter(30);

// A room often types the same question at once. The same search within half
// a minute is answered from memory: no embeddings, and no count against the
// address's limit, which a whole venue's Wi-Fi may share.
const recentSearches = createShortCache<ArchiveSearchResults>(30_000, 200);

export const searchArchive = os
	.$context<RequestContext>()
	.input(
		type({
			"limit?": isUndefined.or("1 <= number % 1 <= 50"),
			query: "1 <= string <= 500",
		}).readonly(),
	)
	.handler(async function searchArchiveHandler({ context, input }): Promise<ArchiveSearchResults> {
		const cacheKey = `${input.limit ?? ""}|${input.query.trim().toLowerCase()}`;
		const remembered = recentSearches.read(cacheKey);
		if (remembered !== undefined) {
			await recordQuestionAsync({ matchCount: remembered.pairs.length, source: "search", text: input.query });
			return remembered;
		}

		if (!isSearchAllowed(context.clientAddress ?? "this-server")) {
			throw new ORPCError("TOO_MANY_REQUESTS", { message: "Too many searches this minute. Try again shortly." });
		}

		const results = await searchArchiveAsync(input.query, input.limit);
		if (results === undefined) {
			throw new ORPCError("SERVICE_UNAVAILABLE", { message: "Search isn't set up on this server." });
		}

		recentSearches.write(cacheKey, results);

		// It never throws, so a lost log row can't fail the search.
		await recordQuestionAsync({ matchCount: results.pairs.length, source: "search", text: input.query });

		return results;
	});

/**
 * Logs a question before it goes to the paid agent, or refuses it when the
 * Ask box has had too many questions this minute or has used its budget.
 * Logging first means replicas asking at the same moment see each other's
 * questions, so together they cannot overshoot by much.
 *
 * @rejects
 * @returns The log row's id.
 * @throws {ORPCError} `SERVICE_UNAVAILABLE` once the budget is used up, or
 *   `TOO_MANY_REQUESTS` when the minute's limit is reached.
 */
async function reserveAskAsync(): Promise<number> {
	const budgetMicros = readDollarsAsMicros(readOptionalSetting("ASK_BUDGET_USD"), 15);
	const { recentAsks, spentMicros } = await readAskSpendingAsync();

	const verdict = judgeAsk(recentAsks, spentMicros, budgetMicros);
	if (verdict === "spent") {
		throw new ORPCError("SERVICE_UNAVAILABLE", {
			message: "The Ask box has used its budget for now. Search still works.",
		});
	}

	if (verdict === "busy") {
		throw new ORPCError("TOO_MANY_REQUESTS", {
			message: "The archive is answering a lot of questions right now. Try again in a minute.",
		});
	}

	return logAskAsync(readDollarsAsMicros(readOptionalSetting("ASK_COST_ESTIMATE_USD"), 0.1));
}

export const askArchive = os
	.input(
		type({
			question: "1 <= string <= 1000",
		}).readonly(),
	)
	.handler(async function askArchiveHandler({ input }): Promise<ArchiveAnswer> {
		const logId = await reserveAskAsync();

		let reply: Awaited<ReturnType<typeof askArchiveAsync>>;
		try {
			reply = await askArchiveAsync(input.question);
		} catch (error) {
			// The estimate stays logged: Elastic may have charged for the try.
			console.error("The archive agent failed:", error);
			throw new ORPCError("BAD_GATEWAY", {
				cause: error,
				message: "The archive agent didn't answer. Try again.",
			});
		}

		if (reply === undefined) {
			// Nothing was sent, so nothing was spent.
			await setAskCostAsync(logId, 0);
			throw new ORPCError("SERVICE_UNAVAILABLE", { message: "The archive agent isn't set up on this server." });
		}

		// The agent reports its token usage; when it doesn't, the estimate stays.
		if (reply.usage !== undefined) {
			await setAskCostAsync(logId, calculateUsageCost(reply.usage));
		}

		// It never throws, so a lost log row can't fail the answer.
		await recordQuestionAsync({ matchCount: reply.answer.sources.length, source: "ask", text: input.question });

		return reply.answer;
	});

export const getDigest = os.input(type({}).readonly()).handler(async function getDigestHandler(): Promise<
	ThemesDigest | undefined
> {
	// The digest is a nice extra on the home page; it never breaks it.
	try {
		return await readDigestAsync();
	} catch (error) {
		console.error("Couldn't read the themes digest:", error);
		return undefined;
	}
});
