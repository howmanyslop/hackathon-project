/**
 * The money math for the Ask box. Every question goes to a paid Elastic
 * agent, so the app keeps a log of what each one cost and stops asking when
 * the total reaches a budget. Money is counted in micros, millionths of a US
 * dollar, so it stays in whole numbers.
 */

/** The most questions the whole app sends the agent in one minute. */
const ASKS_PER_MINUTE = 10;

// Prices per token, in micros. $6 and $30 per million tokens are about
// twice the list price of the model behind the agent, on purpose: the cap
// should run out early, never late.
const MICROS_PER_INPUT_TOKEN = 6;
const MICROS_PER_OUTPUT_TOKEN = 30;

/** The tokens the agent reported using for one answer. */
export interface TokenUsage {
	readonly inputTokens: number;
	readonly outputTokens: number;
}

export type AskVerdict = "allowed" | "busy" | "spent";

/**
 * Converts dollars to micros.
 *
 * @param dollars - An amount in US dollars.
 * @returns The same amount in millionths of a dollar, rounded.
 */
function toMicros(dollars: number): number {
	return Math.round(dollars * 1_000_000);
}

/**
 * Reads a dollar amount from a setting. A missing or unreadable value falls
 * back to the default, so a typo cannot turn the cap off.
 *
 * @param value - The setting's text, if it is set.
 * @param fallback - The amount to use otherwise, in dollars.
 * @returns The amount in micros.
 */
export function readDollarsAsMicros(value: string | undefined, fallback: number): number {
	// `Number("")` is 0, so a blank value has to be caught first.
	const dollars = value === undefined || value.trim().length === 0 ? Number.NaN : Number(value);
	return toMicros(Number.isFinite(dollars) && dollars >= 0 ? dollars : fallback);
}

/**
 * What one answer cost, priced high on purpose.
 *
 * @param usage - The tokens the agent reported.
 * @returns The cost in micros.
 */
export function calculateUsageCost(usage: TokenUsage): number {
	return usage.inputTokens * MICROS_PER_INPUT_TOKEN + usage.outputTokens * MICROS_PER_OUTPUT_TOKEN;
}

/**
 * Decides whether one more question may go to the agent.
 *
 * @param recentAsks - Questions sent in the last minute.
 * @param spentMicros - What every logged question has cost so far.
 * @param budgetMicros - The most the Ask box may spend.
 * @returns `spent` when the budget is used up, `busy` when the minute's
 *   limit is reached, and `allowed` otherwise.
 */
export function judgeAsk(recentAsks: number, spentMicros: number, budgetMicros: number): AskVerdict {
	if (spentMicros >= budgetMicros) return "spent";
	if (recentAsks >= ASKS_PER_MINUTE) return "busy";
	return "allowed";
}
