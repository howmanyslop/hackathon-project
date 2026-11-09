// oxlint-disable small-rules/no-unknown-parameters -- plop passes untyped answers.
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import nodePath from "node:path";
import { existsAsync } from "@web-template/fs-utilities";
import { Predicate } from "effect";
import { exec } from "tinyexec";

import {
	adaptTanStackAppAsync,
	addMissingShadcnComponentsAsync,
	createTanStackAppAsync,
	detectFeaturesAsync,
} from "./tanstack-app.ts";

import type { PlopTypes } from "@turbo/gen";

import type { TanStackAppOptions } from "./tanstack-app.ts";

// Run with `turbo gen <generator>`, or `turbo gen` to pick one. Generators run
// from the repository root, so every path here is relative to it.

const KEBAB_CASE = /^[a-z][\da-z]*(?:-[\da-z]+)*$/u;
const ENTRY_PATH = /^[a-z][\da-z]*(?:-[\da-z]+)*(?:\/[a-z][\da-z]*(?:-[\da-z]+)*)*$/u;
const REFERENCE_PATH = /"path": "(?<path>[^"]+)"/u;
const TEMPLATE_EXTENSION = /\.hbs$/u;

type Validator = (input: string) => Promise<string | true>;

function createNameValidator(getDirectory: (name: string) => string): Validator {
	return async function validateNameAsync(input) {
		if (!KEBAB_CASE.test(input)) return "Use kebab-case, like `color-utilities`.";

		const directory = getDirectory(input);
		return (await existsAsync(directory)) ? `${directory} already exists.` : true;
	};
}

function validateEntries(input: string): string | true {
	const entries = getEntries(input);
	if (entries.length === 0) return "List at least one entry.";

	const invalid = entries.find((entry) => !ENTRY_PATH.test(entry));
	return invalid === undefined ? true : `\`${invalid}\` is not a kebab-case path, like \`file-types/jsonc\`.`;
}

function getEntries(input: unknown): ReadonlyArray<string> {
	if (!Predicate.isString(input)) {
		return [];
	}

	return [...new Set(input.split(",").map((entry) => entry.trim()))].filter((entry) => entry.length > 0);
}

/**
 * Adds the new workspace to the root `tsconfig.json` references, kept in
 * order among the others from the same folder.
 *
 * @param folder - The folder the workspace lives in.
 * @returns The action.
 */
function addTsconfigReference(folder: "apps" | "packages"): PlopTypes.CustomActionFunction {
	return async function addReferenceAsync(answers) {
		const path = "tsconfig.json";
		const contents = await readFile(path, "utf8");
		const lines = contents.split("\n");
		const reference = `./${folder}/${String(answers.name)}`;
		const group = `"path": "./${folder}/`;

		const references = lines.flatMap((line, index) => (REFERENCE_PATH.test(line) ? [index] : []));
		const siblings = references.filter((index) => lines[index]?.includes(group) === true);

		function isAfter(index: number): boolean {
			return (REFERENCE_PATH.exec(lines[index] ?? "")?.groups?.path ?? "") > reference;
		}

		const closing = lines.findIndex((line) => line.trim() === "],");
		// Among its own folder when it has siblings; otherwise before the first
		// reference that sorts after it, or last.
		const insertAt =
			siblings.find(isAfter) ??
			(siblings.length > 0 ? (siblings.at(-1) ?? closing) + 1 : (references.find(isAfter) ?? closing));

		// The last reference has no trailing comma in strict JSON readers.
		const previous = lines[insertAt - 1] ?? "";
		if (insertAt === closing && REFERENCE_PATH.test(previous) && !previous.trimEnd().endsWith(",")) {
			lines[insertAt - 1] = `${previous.trimEnd()},`;
		}

		lines.splice(insertAt, 0, `\t\t{ "path": "${reference}" }${insertAt === closing ? "" : ","}`);
		await writeFile(path, lines.join("\n"));
		return `Added ${reference} to tsconfig.json references`;
	};
}

function runCommand(file: string, commandArguments: ReadonlyArray<string>): PlopTypes.CustomActionFunction {
	return async function runAsync() {
		await exec(file, commandArguments, { nodeOptions: { stdio: "inherit" }, throwOnError: true });
		return `Ran ${[file, ...commandArguments].join(" ")}`;
	};
}

const installDependencies = runCommand("ni", []);

/** TanStack Intent writes its skill guidance into the root `AGENTS.md`. */
const TANSTACK_INTENT = "@tanstack/intent@0.5.6";

/** Writes `routeTree.gen.ts` without a full build. */
const TANSTACK_ROUTER_CLI = "@tanstack/router-cli@1.167.46";

function addTemplates(destination: string, template: string): PlopTypes.AddManyActionConfig {
	return {
		base: `templates/${template}`,
		destination,
		globOptions: { dot: true },
		// The @turbo/gen types require `path`, but `addMany` only reads
		// `destination`.
		path: destination,
		stripExtensions: ["hbs"],
		templateFiles: `templates/${template}/**/*`,
		type: "addMany",
	};
}

/**
 * Renders every file in a template folder into `destination`, replacing what
 * is there. Plop's `addMany` cannot overwrite conditionally at run time.
 *
 * @param plopApi - Plop, for its Handlebars helpers.
 * @param template - The folder under `turbo/generators/templates/`; generators run from the repository root.
 * @param destination - Where the files go.
 * @param data - The template data.
 * @returns The files written, relative to `destination`.
 */
async function renderTemplatesAsync(
	plopApi: PlopTypes.NodePlopAPI,
	template: string,
	destination: string,
	data: PlopTypes.Answers,
): Promise<ReadonlyArray<string>> {
	const base = nodePath.join("turbo/generators/templates", template);
	const entries = await readdir(base, { recursive: true, withFileTypes: true });
	const files = entries.filter((entry) => entry.isFile());

	return Promise.all(
		files.map(async (entry) => {
			const source = nodePath.join(entry.parentPath, entry.name);
			const relative = nodePath.relative(base, source).replace(TEMPLATE_EXTENSION, "");
			const target = nodePath.join(destination, relative);
			const contents = plopApi.renderString(await readFile(source, "utf8"), data);

			await mkdir(nodePath.dirname(target), { recursive: true });
			await writeFile(target, contents);
			return relative;
		}),
	);
}

function setPackageGenerators(plop: PlopTypes.NodePlopAPI): void {
	const descriptionPrompt: PlopTypes.PromptQuestion = {
		name: "description",
		message: "One-line description:",
		type: "input",
	};

	plop.setGenerator("package", {
		actions: [addTemplates("packages/{{name}}", "package"), addTsconfigReference("packages"), installDependencies],
		description: "A library under packages/ with one entry point, like arktype-utilities.",
		prompts: [
			{
				name: "name",
				message: "Package name (without @web-template/):",
				type: "input",
				validate: createNameValidator((name) => `packages/${name}`),
			},
			descriptionPrompt,
		],
	});

	plop.setGenerator("multi-entry-package", {
		actions(data) {
			const name = String(data?.name);
			const entries = getEntries(data?.entries);
			if (data !== undefined) {
				data.entryList = entries;
			}

			return [
				addTemplates("packages/{{name}}", "multi-entry-package"),
				...entries.map((entry): PlopTypes.AddActionConfig => ({
					data: { entry },
					path: `packages/${name}/src/${entry}.ts`,
					templateFile: "templates/multi-entry-package-entry/entry.ts.hbs",
					type: "add",
				})),
				addTsconfigReference("packages"),
				installDependencies,
			];
		},
		description: "A library under packages/ with several subpath exports, like file-utilities.",
		prompts: [
			{
				name: "name",
				message: "Package name (without @web-template/):",
				type: "input",
				validate: createNameValidator((name) => `packages/${name}`),
			},
			descriptionPrompt,
			{
				name: "entries",
				message: "Subpath exports, comma-separated (like `file-content, file-types/jsonc`):",
				type: "input",
				validate: validateEntries,
			},
		],
	});
}

function setWebsiteGenerator(plop: PlopTypes.NodePlopAPI): void {
	plop.setGenerator("website", {
		actions(data) {
			const name = String(data?.name);
			const directory = `apps/${name}`;
			if (data?.stack !== "tanstack") {
				return [
					addTemplates(directory, "website-shared"),
					addTemplates(directory, "website-astro"),
					addTsconfigReference("apps"),
					installDependencies,
				];
			}

			const options: TanStackAppOptions = {
				name,
				description: String(data.description ?? ""),
				hostname: String(data.hostname),
				workerName: String(data.workerName),
			};

			function runInApp(...commandArguments: ReadonlyArray<string>): PlopTypes.CustomActionFunction {
				return runCommand("pnpm", ["--dir", directory, ...commandArguments]);
			}

			/**
			 * Replaces CLI files with ones that suit Workers. Each runs only when
			 * the CLI wrote the add-on it replaces.
			 *
			 * @param template - The folder under `turbo/generators/templates/`.
			 * @param feature - The add-on it needs, or `always`.
			 * @returns The plop action.
			 */
			function override(
				template: string,
				feature: "always" | "drizzle" | "orpc",
			): PlopTypes.CustomActionFunction {
				return async function overrideAsync(answers, _configuration, plopApi) {
					const features = await detectFeaturesAsync(name);
					if (feature !== "always" && !features[feature]) return `No ${feature} in this app`;

					const written = await renderTemplatesAsync(plopApi, template, directory, {
						...answers,
						...features,
					});

					return `Wrote ${written.join(", ")}`;
				};
			}

			return [
				async () => createTanStackAppAsync(name),
				async () => adaptTanStackAppAsync(options),
				override("tanstack-server", "always"),
				override("tanstack-orpc", "orpc"),
				override("tanstack-drizzle", "drizzle"),
				addTsconfigReference("apps"),
				installDependencies,
				async () => addMissingShadcnComponentsAsync(name),
				runCommand("node", ["--run", "oxfmt", "--", directory]),
				// Fixes what the linter can; the rest is reported for a person to
				// finish, without failing the generator.
				runCommand("bash", [
					"-c",
					'node --run isentinel-lint -- --fix "$0"; node --run biome -- check --write --formatter-enabled=false "$0"; true',
					directory,
				]),
				runInApp("dlx", TANSTACK_ROUTER_CLI, "generate"),
				runInApp("exec", "cf", "workers", "types"),
				...(data.intent === true ? [runCommand("nlx", [TANSTACK_INTENT, "install"])] : []),
			];
		},
		description: "A site under apps/ on Cloudflare Workers, with Astro or TanStack Start.",
		prompts: [
			{
				name: "name",
				message: "App name (the folder under apps/ and @web-template/<name>):",
				type: "input",
				validate: createNameValidator((name) => `apps/${name}`),
			},
			{
				name: "description",
				message: "One-line description:",
				type: "input",
			},
			{
				name: "stack",
				choices: [
					{ name: "TanStack Start + React (TanStack's add-on questions come next)", value: "tanstack" },
					{ name: "Astro + React islands (fast, mostly static)", value: "astro" },
				],
				message: "Stack:",
				type: "list",
			},
			{
				name: "workerName",
				default: (answers: PlopTypes.Answers) => String(answers.name),
				message: "Worker name:",
				type: "input",
				validate: (input: string) => KEBAB_CASE.test(input) || "Use kebab-case.",
			},
			{
				name: "hostname",
				message: "Production hostname, like app.example.com (Astro needs it for `site`; TanStack may skip it):",
				type: "input",
				validate: (input: string, answers?: PlopTypes.Answers) =>
					input.length > 0 || answers?.stack === "tanstack" || "Astro needs a hostname.",
			},
			{
				name: "intent",
				default: true,
				message: "TanStack only: set up TanStack Intent (agent skills from installed packages, in AGENTS.md)?",
				type: "confirm",
			},
		],
	});
}

function setOpenCodePluginGenerator(plop: PlopTypes.NodePlopAPI): void {
	plop.setGenerator("opencode-plugin", {
		actions: [
			addTemplates(".opencode/packages/plugins/{{name}}", "opencode-plugin"),
			{
				path: ".opencode/plugins/{{name}}.ts",
				template: 'export { default } from "$plugins/{{name}}/plugin";\n',
				type: "add",
			},
			installDependencies,
		],
		description:
			"An OpenCode plugin: its package in .opencode/packages/plugins and its loader in .opencode/plugins.",
		prompts: [
			{
				name: "name",
				message: "Plugin id (kebab-case):",
				type: "input",
				validate: createNameValidator((name) => `.opencode/packages/plugins/${name}`),
			},
		],
	});
}

// oxlint-disable-next-line small-rules/starts-with-verb -- plop requires a default export named for its role.
export default function generator(plop: PlopTypes.NodePlopAPI): void {
	// `{{{json description}}}` writes a JSON string, quotes and all.
	plop.setHelper("json", (value: unknown) => JSON.stringify(value ?? ""));
	plop.setHelper("today", () => new Date().toISOString().slice(0, 10));

	setPackageGenerators(plop);
	setWebsiteGenerator(plop);
	setOpenCodePluginGenerator(plop);
}
