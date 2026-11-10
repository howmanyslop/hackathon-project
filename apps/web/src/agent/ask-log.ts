/**
 * The log of questions sent to the paid Elastic agent. It lives in Postgres,
 * so all three replicas count against the same limit and the same budget.
 */

import { eq, sql } from "drizzle-orm";

import { getDatabase } from "$db/index";
import { askLog } from "$db/schema";

interface AskSpending {
	/** Questions logged in the last minute. */
	readonly recentAsks: number;
	/** What every logged question has cost, in micros. */
	readonly spentMicros: number;
}

/**
 * Reads how busy the Ask box is and what it has spent.
 *
 * @returns The last minute's count and the running total.
 */
export async function readAskSpendingAsync(): Promise<AskSpending> {
	// A count and a sum with no grouping always come back as one row.
	const [spending] = await getDatabase()
		.select({
			recentAsks: sql<number>`count(*) filter (where ${askLog.createdAt} > now() - interval '1 minute')`.mapWith(
				Number,
			),
			spentMicros: sql<number>`coalesce(sum(${askLog.costMicros}), 0)`.mapWith(Number),
		})
		.from(askLog);

	return spending;
}

/**
 * Logs a question before it is sent, with an estimated cost.
 *
 * @param costMicros - The estimate.
 * @returns The new row's id, to correct the cost once the answer is in.
 */
export async function logAskAsync(costMicros: number): Promise<number> {
	// An insert with `returning` always yields the inserted row.
	const [created] = await getDatabase().insert(askLog).values({ costMicros }).returning({ id: askLog.id });
	return created.id;
}

/**
 * Replaces a logged question's estimate with what it really cost.
 *
 * @param id - The row `logAskAsync` returned.
 * @param costMicros - What the answer really cost, from the agent's
 *   reported token usage.
 */
export async function setAskCostAsync(id: number, costMicros: number): Promise<void> {
	await getDatabase().update(askLog).set({ costMicros }).where(eq(askLog.id, id));
}
