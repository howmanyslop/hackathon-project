// oxlint-disable small-rules/no-unknown-returns small-rules/no-unknown-parameters -- benchmarks feed validators arbitrary input

import { Validator as CfworkerValidator } from "@cfworker/json-schema";
import { compile as piCompile } from "@earendil-works/pi-schema";
import { formats as piFormats } from "@earendil-works/pi-schema/formats";
import { faker } from "@faker-js/faker";
import { ArkErrors, scope } from "arktype";
import { barplot, bench, do_not_optimize, run, summary } from "mitata";
import TypeBoxSchema from "typebox/schema";
import TypeBoxSystem from "typebox/system";

import type { Schema as JsonSchema } from "@cfworker/json-schema";

// Every contender here has to work on Cloudflare Workers, which forbid
// `new Function`:
// - ArkType: `jitless: true`.
// - pi-schema: never uses eval, so there is no switch.
// - TypeBox: JIT is on by default and only falls back when it detects a
//   restrictive runtime. Bun and Node are not restrictive, so the fallback is
//   forced with `useAcceleration: false`.
// - @cfworker/json-schema: interpreted only.
// All four validate the same plain JSON Schema (ArkType gets the equivalent
// definition), including the `uuid` and `email` format checks.

faker.seed(42);

const CLIP_SCHEMA: JsonSchema = {
	properties: {
		id: { format: "uuid", type: "string" },
		consent: { type: "boolean" },
		durationMs: { minimum: 0, type: "integer" },
		label: { minLength: 1, type: "string" },
		pitch: {
			properties: {
				mean: { type: "number" },
				samples: { items: { type: "number" }, type: "array" },
			},
			required: ["mean", "samples"],
			type: "object",
		},
		tags: { items: { type: "string" }, type: "array" },
	},
	required: ["id", "label", "durationMs", "tags", "pitch"],
	type: "object",
};

const PAYLOAD_SCHEMA: JsonSchema = {
	properties: {
		clips: { items: CLIP_SCHEMA, type: "array" },
		email: { format: "email", type: "string" },
		userId: { type: "string" },
	},
	required: ["userId", "email", "clips"],
	type: "object",
};

const ARKTYPE_DEFINITIONS = {
	clip: {
		id: "string.uuid",
		"consent?": "boolean",
		durationMs: "number.integer >= 0",
		label: "string > 0",
		pitch: { mean: "number", samples: "number[]" },
		tags: "string[]",
	},
	payload: {
		clips: "clip[]",
		email: "string.email",
		userId: "string",
	},
} as const;

interface Contender {
	/** Compile the schema from scratch. Used for the startup benchmark. */
	readonly build: () => unknown;
	/** Whether `input` is valid. */
	readonly check: (input: unknown) => boolean;
	/** Reject and report: the call an app makes when it needs the reasons. */
	readonly report: (input: unknown) => unknown;
}

function buildArkType(): Contender {
	const { payload } = scope(ARKTYPE_DEFINITIONS, { jitless: true }).export();
	return {
		build: () => scope(ARKTYPE_DEFINITIONS, { jitless: true }).export(),
		check: (input) => !(payload(input) instanceof ArkErrors),
		report: (input) => payload(input),
	};
}

function buildPiSchema(): Contender {
	const validator = piCompile(PAYLOAD_SCHEMA, { formats: piFormats });
	return {
		build: () => piCompile(PAYLOAD_SCHEMA, { formats: piFormats }),
		check: (input) => validator.check(input),
		report: (input) => validator.errors(input),
	};
}

function compileTypeBoxWithoutEval() {
	TypeBoxSystem.Settings.Set({ useAcceleration: false });

	try {
		return TypeBoxSchema.Compile(PAYLOAD_SCHEMA);
	} finally {
		TypeBoxSystem.Settings.Reset();
	}
}

function buildTypeBox(): Contender {
	const validator = compileTypeBoxWithoutEval();
	if (validator.IsAccelerated()) {
		throw new Error("TypeBox is still accelerated; the comparison would not be Workers-safe.");
	}

	return {
		build: compileTypeBoxWithoutEval,
		check: (input) => validator.Check(input),
		report: (input) => validator.Errors(input),
	};
}

function buildCfworker(): Contender {
	const validator = new CfworkerValidator(PAYLOAD_SCHEMA, "2020-12");
	return {
		build: () => new CfworkerValidator(PAYLOAD_SCHEMA, "2020-12"),
		check: (input) => validator.validate(input).valid,
		report: (input) => validator.validate(input),
	};
}

const contenders = {
	"@cfworker/json-schema": buildCfworker(),
	"arktype (jitless)": buildArkType(),
	"pi-schema": buildPiSchema(),
	"typebox (no eval)": buildTypeBox(),
} satisfies Record<string, Contender>;

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

// One bad clip at the end, so every library has to walk the 199 good ones first
// and then report the same two problems (the `id` format and `durationMs`).
const largeInvalid = {
	...largeValid,
	clips: largeValid.clips.map((clip, index, clips) =>
		index === clips.length - 1 ? { ...clip, id: "not-a-uuid", durationMs: -1 } : clip,
	),
};

// Every library must agree with the expected verdict before anything is timed.
// Otherwise a library that ignores `format` (or anything else) would look fast
// by doing less work.
for (const [name, contender] of Object.entries(contenders)) {
	const verdicts = [contender.check(smallValid), contender.check(largeValid), contender.check(largeInvalid)];

	if (verdicts.join(",") !== "true,true,false") {
		throw new Error(`${name} gave verdicts ${verdicts.join(",")}, expected true,true,false.`);
	}
}

function runGroup(title: string, task: (contender: Contender) => unknown): void {
	summary(() => {
		barplot(() => {
			for (const [name, contender] of Object.entries(contenders)) {
				bench(`${title} · ${name}`, () => {
					do_not_optimize(task(contender));
				});
			}
		});
	});
}

runGroup("1 clip, valid", (contender) => contender.check(smallValid));

runGroup("200 clips, valid", (contender) => contender.check(largeValid));

// Each library at its defaults. cfworker stops at the first problem and the rest
// report both, a difference of one error at the very end of the walk.
runGroup("200 clips, last invalid, report", (contender) => contender.report(largeInvalid));

runGroup("compile schema", (contender) => contender.build());

await run({});
