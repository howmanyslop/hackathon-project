// oxlint-disable typescript/no-implied-eval typescript/no-unsafe-call no-new-func small-rules/no-unknown-parameters -- the benchmark compiles validators the way arktype does
// biome-ignore-all lint/style/useErrorCause: benchmark errors need no cause
// biome-ignore-all lint/nursery/noImpliedEval: measures arktype's own compiled validators

import { faker } from "@faker-js/faker";
import { scope } from "arktype";
import { barplot, bench, do_not_optimize, run, summary } from "mitata";

// Workers forbid `new Function`, so ArkType has to run with `jitless: true`
// there. `jitless` is resolved per scope, so both modes can live in one file.
// If this runs somewhere that blocks `new Function`, the JIT scope silently
// falls back to interpreted mode and the comparison is meaningless.
try {
	new Function("return 1")();
} catch {
	throw new Error("This runtime blocks `new Function`; the JIT baseline would not be JIT.");
}

faker.seed(42);

const DEFINITIONS = {
	clip: {
		id: "string.uuid",
		"consent?": "boolean",
		durationMs: "number.integer >= 0",
		label: "string > 0",
		pitch: {
			mean: "number",
			samples: "number[]",
		},
		tags: "string[]",
	},
	payload: {
		clips: "clip[]",
		email: "string.email",
		userId: "string",
	},
} as const;

function makeScope(jitless: boolean) {
	return scope(DEFINITIONS, { jitless }).export();
}

const jit = makeScope(false);
const jitless = makeScope(true);

function makeClip() {
	return {
		id: faker.string.uuid(),
		consent: faker.datatype.boolean(),
		durationMs: faker.number.int({ max: 60_000, min: 0 }),
		label: faker.lorem.words(2),
		pitch: {
			mean: faker.number.float({ max: 400, min: 80 }),
			samples: faker.helpers.multiple(() => faker.number.float({ max: 400, min: 80 }), {
				count: 64,
			}),
		},
		tags: faker.helpers.multiple(() => faker.lorem.word(), { count: 4 }),
	};
}

function makePayload(clipCount: number) {
	return {
		clips: faker.helpers.multiple(makeClip, { count: clipCount }),
		email: faker.internet.email(),
		userId: faker.string.alphanumeric(24),
	};
}

const smallValid = makePayload(1);
const largeValid = makePayload(200);
const largeInvalid = {
	...largeValid,
	clips: largeValid.clips.map((clip, index) =>
		index % 2 === 0 ? { ...clip, id: "not-a-uuid", durationMs: -1 } : clip,
	),
};

// Sanity check: both modes must agree before timing anything.
for (const input of [smallValid, largeValid, largeInvalid]) {
	const expected = jit.payload(input) instanceof Object && !("problems" in jit.payload(input));
	const actual = !("problems" in jitless.payload(input));
	if (expected !== actual) {
		throw new Error("JIT and jitless disagree on validity.");
	}
}

function runPair(name: string, input: unknown): void {
	summary(() => {
		barplot(() => {
			bench(`${name} (JIT)`, () => {
				do_not_optimize(jit.payload(input));
			});
			bench(`${name} (jitless)`, () => {
				do_not_optimize(jitless.payload(input));
			});
		});
	});
}

runPair("1 clip, valid", smallValid);

runPair("200 clips, valid", largeValid);

runPair("200 clips, 100 invalid", largeInvalid);

// Startup cost: JIT pays to generate and compile code, jitless skips it.
summary(() => {
	barplot(() => {
		bench("define scope (JIT)", () => {
			do_not_optimize(makeScope(false));
		});
		bench("define scope (jitless)", () => {
			do_not_optimize(makeScope(true));
		});
	});
});

await run({});
