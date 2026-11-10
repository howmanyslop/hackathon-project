import { describe, expect, it } from "vite-plus/test";

import { selectQuotedSources } from "./quoted-sources";

const NODE_FAILURE = "Surviving a node failure on a small k3s cluster (sample)";
const OPEN_TELEMETRY = "What OpenTelemetry auto-instrumentation actually does (sample)";
const EMBEDDINGS = "Semantic search with embeddings, explained simply (sample)";

// A real answer from the agent, which drops " (sample)" from the titles.
const REAL_ANSWER = [
	'Yes, someone asked what happens when a node dies during "Surviving a node failure on a',
	'small k3s cluster" by Priya Natarajan at 10:13. Additionally, in "What OpenTelemetry',
	'auto-instrumentation actually does" by Hannah Lindqvist at 11:40, someone asked about',
	"traces when a collector node dies.",
].join(" ");

describe("quoted sources", () => {
	// Catches the Ask box listing sessions the answer never mentions.
	it("keeps the rows the answer quotes and drops the rest", () => {
		expect.assertions(1);

		const rows = [
			{ sessionId: 2, sessionTitle: EMBEDDINGS, startMs: 713_894 },
			{ sessionId: 4, sessionTitle: OPEN_TELEMETRY, startMs: 700_979 },
			{ sessionId: 3, sessionTitle: NODE_FAILURE, startMs: 764_868 },
			{ sessionId: 3, sessionTitle: NODE_FAILURE, startMs: 613_412 },
		];

		expect(selectQuotedSources(REAL_ANSWER, rows)).toStrictEqual([
			{ sessionId: 3, sessionTitle: NODE_FAILURE, startMs: 613_412 },
			{ sessionId: 4, sessionTitle: OPEN_TELEMETRY, startMs: 700_979 },
		]);
	});

	// Catches a source pointing at the wrong talk when two talks share a time.
	it("tells two sessions with the same time apart by title", () => {
		expect.assertions(1);

		const answer = 'In "Surviving a node failure on a small k3s cluster" at 10:13, the speaker said yes.';
		const rows = [
			{ sessionId: 2, sessionTitle: EMBEDDINGS, startMs: 613_000 },
			{ sessionId: 3, sessionTitle: NODE_FAILURE, startMs: 613_412 },
		];

		expect(selectQuotedSources(answer, rows)).toStrictEqual([
			{ sessionId: 3, sessionTitle: NODE_FAILURE, startMs: 613_412 },
		]);
	});

	// Catches the same moment listed twice when two tools both found it.
	it("lists a moment once", () => {
		expect.assertions(1);

		const row = { sessionId: 3, sessionTitle: NODE_FAILURE, startMs: 613_412 };

		expect(selectQuotedSources(REAL_ANSWER, [row, row])).toStrictEqual([row]);
	});

	// Catches "1:05" being found inside "11:05" or "1:05:30".
	it("matches a time only as a whole", () => {
		expect.assertions(1);

		const answer = `${NODE_FAILURE} came up at 11:05, and again at 1:05:30.`;
		const rows = [{ sessionId: 3, sessionTitle: NODE_FAILURE, startMs: 65_000 }];

		expect(selectQuotedSources(answer, rows)).toStrictEqual([]);
	});

	// Catches a talk past its first hour never matching the agent's "75:02".
	it("reads times past an hour in minutes, as the agent writes them", () => {
		expect.assertions(1);

		const answer = `${NODE_FAILURE} answered it at 75:02.`;
		const rows = [{ sessionId: 3, sessionTitle: NODE_FAILURE, startMs: 4_502_000 }];

		expect(selectQuotedSources(answer, rows)).toHaveLength(1);
	});

	// Catches a long answer flooding the page with sources.
	it("lists five sources at most", () => {
		expect.assertions(1);

		const answer = `${NODE_FAILURE}: 1:00, 2:00, 3:00, 4:00, 5:00, 6:00.`;
		const rows = [1, 2, 3, 4, 5, 6].map((minute) => ({
			sessionId: 3,
			sessionTitle: NODE_FAILURE,
			startMs: minute * 60_000,
		}));

		expect(selectQuotedSources(answer, rows)).toHaveLength(5);
	});
});
