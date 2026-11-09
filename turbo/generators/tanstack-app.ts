import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import nodePath from "node:path";
import { env } from "node:process";
import {
	isMaybeReadonlyArrayOfStrings,
	isMaybeReadonlyDictionaryOfStrings,
	isMaybeString,
} from "@web-template/arktype-utilities";
import { existsAsync } from "@web-template/fs-utilities";
import { type } from "arktype";
import { parseJSONC } from "confbox";
import { exec } from "tinyexec";

import type { Type } from "arktype";

// TanStack Start apps come from TanStack's own CLI, so every add-on it
// offers is available. The CLI asks its own questions; this module fixes the
// choices the monorepo needs, then adapts what the CLI writes: catalogs
// instead of version ranges, `cf` instead of Wrangler, no per-app workspace
// files, and the swaps that make its add-ons run on Workers (D1 instead of
// better-sqlite3, Base UI instead of Radix).

const TANSTACK_CLI = "@tanstack/cli@0.72.16";

/**
 * `cf` reads `cloudflare.config.ts` only through the Vite plugin's 2.0 beta.
 */
const CLOUDFLARE_VITE_PLUGIN_BETA = "2.0.0-beta.v.4";

/** Used when the CLI's `wrangler.jsonc` has no compatibility date. */
const FALLBACK_COMPATIBILITY_DATE = "2025-09-02";

/** Used when the root catalogs no longer list Base UI. */
const BASE_UI_VERSION = "1.9.0";

/** Packages that only exist for the CLI's Node-side SQLite setup. */
const SQLITE_ONLY = new Set(["@types/better-sqlite3", "better-sqlite3", "dotenv"]);

/**
 * Radix, and the class helpers that shadcn's Base UI styles replace with `cn`.
 */
const RADIX_ONLY = new Set(["clsx", "radix-ui", "tailwind-merge"]);

/** Only the CLI's open OpenAPI route (`routes/api.$.ts`) uses these. */
const OPENAPI_ONLY = new Set(["@orpc/json-schema", "@orpc/openapi", "@orpc/zod"]);

/** Used when the root catalogs no longer list `cn`. */
const CN_VERSION = "0.5.2";

const WORKSPACE = "pnpm-workspace.yaml";
const COMPONENTS_JSON = "components.json";
const SHADCN_UI = "src/components/ui";
const JSON_INDENT = "\t";
const CATALOG_NAME = /^ {2}(?<name>\S+):$/u;
const CATALOG_ENTRY = /^ {4}"?(?<name>[^":]+)"?: /u;
const SHADCN_IMPORT = /["'](?:#|@)\/components\/ui\/(?<component>[\w-]+)["']/gu;
const TYPESCRIPT_FILE = /\.tsx?$/u;
const VITE_COMMAND = /^vite /u;
const D1_MIGRATIONS = 'cf d1 migrations apply "$CLOUDFLARE_DATABASE_ID" --dir drizzle';
const RPC_LINK = /new RPCLink\(\{/u;
const RPC_LINK_IMPORT = /^import \{ RPCLink \} from ["']@orpc\/client\/fetch["'];?$/mu;

const TURBO_JSON = `${JSON.stringify(
	{
		$schema: "https://turborepo.dev/schema.json",
		extends: ["//"],
		tasks: { build: { env: ["VITE_*"], outputs: ["dist/**", ".cloudflare/output/**"] } },
	},
	undefined,
	"\t",
)}\n`;

/**
 * Files the CLI writes that the monorepo handles once, at the root. Storybook's
 * setup installs packages into the app on its own, so its `node_modules` goes
 * too; the root install replaces it.
 */
const DISCARDED = [
	".cursorrules",
	".npmrc",
	// Storybook's sample stories, which do not type-check here.
	"src/stories",
	// TanStack's generic README; the root AGENTS.md covers the commands.
	"README.md",
	".vscode",
	"debug-storybook.log",
	"node_modules",
	"pnpm-lock.yaml",
	WORKSPACE,
	"wrangler.jsonc",
];

/**
 * The `wrangler.jsonc` the CLI writes, all of which goes into
 * `cloudflare.config.ts`. Any other field means the CLI changed and the file
 * needs `cf migrate` instead.
 */
const isWranglerConfiguration = type({
	"$schema?": isMaybeString,
	"+": "reject",
	"compatibility_date?": isMaybeString,
	"compatibility_flags?": isMaybeReadonlyArrayOfStrings,
	"main?": isMaybeString,
	"name?": isMaybeString,
});

/** The fields this module changes. The CLI's other fields pass through. */
const isPackageJson = type({
	"dependencies?": isMaybeReadonlyDictionaryOfStrings,
	"devDependencies?": isMaybeReadonlyDictionaryOfStrings,
	"pnpm?": "object | undefined",
	"scripts?": isMaybeReadonlyDictionaryOfStrings,
});

/** The fields this module changes. The rest passes through. */
const isShadcnConfiguration = type({
	"+": "ignore",
	"aliases?": isMaybeReadonlyDictionaryOfStrings,
	"style?": isMaybeString,
});

const isTsConfig = type({
	"compilerOptions?": "object | undefined",
	"include?": isMaybeReadonlyArrayOfStrings,
});

export interface TanStackAppOptions {
	readonly name: string;
	readonly description: string;
	readonly hostname: string;
	readonly workerName: string;
}

/** The CLI add-ons this module adapts, detected from the files they write. */
export interface TanStackFeatures {
	readonly clerk: boolean;
	readonly drizzle: boolean;
	readonly orpc: boolean;
	readonly shadcn: boolean;
}

/**
 * Detects which adapted add-ons the CLI wrote into the app.
 *
 * @param name - The app name.
 * @returns The add-ons present.
 */
export async function detectFeaturesAsync(name: string): Promise<TanStackFeatures> {
	const directory = getDirectory(name);
	const [clerk, drizzle, orpc, shadcn] = await Promise.all([
		existsAsync(nodePath.join(directory, "src/integrations/clerk")),
		existsAsync(nodePath.join(directory, "drizzle.config.ts")),
		existsAsync(nodePath.join(directory, "src/routes/api.rpc.$.ts")),
		existsAsync(nodePath.join(directory, COMPONENTS_JSON)),
	]);

	return { clerk, drizzle, orpc, shadcn };
}

function getDirectory(name: string): string {
	return `apps/${name}`;
}

async function readLinesAsync(path: string): Promise<Array<string>> {
	const contents = await readFile(path, "utf8");
	return contents.split("\n");
}

/**
 * Runs a command with its output in the terminal, so the CLI's prompts reach
 * the person running the generator.
 *
 * @param command - The program.
 * @param commandArguments - Its arguments.
 * @param cwd - Where to run it; the repository root by default.
 * @rejects When the command exits with a non-zero code.
 */
async function runAsync(command: string, commandArguments: ReadonlyArray<string>, cwd?: string): Promise<void> {
	await exec(command, commandArguments, { nodeOptions: { cwd, stdio: "inherit" }, throwOnError: true });
}

/**
 * Reads and validates a JSONC file the CLI wrote. The parser tags its result
 * with a symbol that records the formatting; cloning drops it, so strict
 * schemas see only the real fields.
 *
 * @template Contents - The validated shape.
 * @param path - The file to read.
 * @param schema - What the file must contain.
 * @param hint - Added to the error when the file does not match.
 * @returns The validated contents.
 * @rejects When the file is missing, or does not match `schema`.
 */
async function readJsoncAsync<Contents>(
	path: string,
	schema: Type<Contents>,
	hint = "",
): Promise<Type<Contents>["infer"]> {
	const text = await readFile(path, "utf8");
	const parsed = parseJSONC(text);
	const contents = schema(structuredClone(parsed));
	if (contents instanceof type.errors) {
		throw new TypeError(`${path} is not what this generator expects (${contents.summary}).${hint}`);
	}

	return contents;
}

/**
 * Runs TanStack's CLI with the choices this repository fixes. Set
 * `TANSTACK_ADD_ONS` (comma-separated, may be empty) to skip its prompts, as
 * scripts and tests do; `TANSTACK_EXAMPLES=true` adds its demo pages.
 *
 * @param name - The folder under `apps/`, and the package name after `@web-template/`.
 * @returns The CLI's output summary for plop.
 */
export async function createTanStackAppAsync(name: string): Promise<string> {
	const scripted = env.TANSTACK_ADD_ONS;

	await runAsync("nlx", [
		TANSTACK_CLI,
		"create",
		name,
		"--target-dir",
		getDirectory(name),
		"--framework",
		"React",
		"--build-tool",
		"vite",
		"--deployment",
		"cloudflare",
		"--package-manager",
		"pnpm",
		"--no-install",
		"--no-git",
		"--no-toolchain",
		// Intent needs installed packages; the generator runs it after the
		// root install instead.
		"--no-intent",
		// D1 is SQLite, so Drizzle never asks for another database.
		"--add-on-config",
		JSON.stringify({ drizzle: { database: "sqlite" } }),
		...(scripted === undefined
			? []
			: [
					"--non-interactive",
					env.TANSTACK_EXAMPLES === "true" ? "--examples" : "--no-examples",
					...(scripted.length > 0 ? ["--add-ons", scripted] : []),
				]),
	]);
	return `Created apps/${name} with ${TANSTACK_CLI}`;
}

/**
 * Where each package already has a version in the root catalogs. The first
 * catalog listing a package wins.
 *
 * @param lines - The root `pnpm-workspace.yaml`.
 * @returns Package name to catalog name.
 */
function getCatalogs(lines: ReadonlyArray<string>): Map<string, string> {
	const catalogs = new Map<string, string>();
	const start = lines.indexOf("catalogs:");
	let current: string | undefined;

	const section = lines.slice(start + 1);
	for (const line of section) {
		if (line.length > 0 && !line.startsWith(" ")) break;

		const catalogName = CATALOG_NAME.exec(line)?.groups?.name;
		if (catalogName !== undefined) {
			current = catalogName;
		}

		const packageName = CATALOG_ENTRY.exec(line)?.groups?.name;
		if (packageName !== undefined && current !== undefined && !catalogs.has(packageName)) {
			catalogs.set(packageName, current);
		}
	}

	return catalogs;
}

/**
 * Adds a catalog under `catalogs:`, in name order. Does nothing when the
 * catalog already exists.
 *
 * @param lines - The root `pnpm-workspace.yaml`, edited in place.
 * @param name - The catalog key, like `cf`.
 * @param entries - Package name and version pairs.
 */
function addCatalog(lines: Array<string>, name: string, entries: ReadonlyArray<readonly [string, string]>): void {
	if (entries.length === 0 || lines.includes(`  ${name}:`)) return;

	const start = lines.indexOf("catalogs:");
	if (start === -1) {
		throw new Error(`${WORKSPACE} has no \`catalogs:\` section.`);
	}

	let insertAt = start + 1;
	for (let index = start + 1; index < lines.length; index += 1) {
		const line = lines[index] ?? "";
		if (line.length > 0 && !line.startsWith(" ")) break;

		const catalogName = CATALOG_NAME.exec(line)?.groups?.name;
		if (catalogName !== undefined && catalogName > name) break;

		if (line.trim().length > 0) {
			insertAt = index + 1;
		}
	}

	const sorted = [...entries].toSorted(([left], [right]) => left.localeCompare(right));
	lines.splice(insertAt, 0, `  ${name}:`, ...sorted.map(([key, version]) => `    "${key}": ${version}`));
}

/**
 * The entries of a top-level YAML block, like `allowBuilds:` or
 * `minimumReleaseAgeExclude:`.
 *
 * @param lines - The YAML file's lines.
 * @param key - The top-level key.
 * @returns The block's indented lines, trimmed.
 */
function getBlock(lines: ReadonlyArray<string>, key: string): ReadonlyArray<string> {
	const start = lines.indexOf(`${key}:`);
	if (start === -1) {
		return [];
	}

	const end = lines.findIndex((line, index) => index > start && line.length > 0 && !line.startsWith(" "));
	return lines
		.slice(start + 1, end === -1 ? undefined : end)
		.map((line) => line.trim())
		.filter(Boolean);
}

/**
 * Adds the entries a root block lacks, at the end of that block.
 *
 * @param lines - The root `pnpm-workspace.yaml`, edited in place.
 * @param key - The top-level key.
 * @param entries - Trimmed entries, like `sharp: true` or `- "x@1.0.0"`.
 */
function addToBlock(lines: Array<string>, key: string, entries: ReadonlyArray<string>): void {
	const start = lines.indexOf(`${key}:`);
	if (start === -1) {
		throw new Error(`${WORKSPACE} has no \`${key}:\` section.`);
	}

	const existing = new Set(getBlock(lines, key).map((entry) => entry.replaceAll(/["']/gu, "")));
	const missing = entries.filter((entry) => !existing.has(entry.replaceAll(/["']/gu, "")));

	let insertAt = start + 1;
	while ((lines[insertAt] ?? "").startsWith(" ")) {
		insertAt += 1;
	}

	lines.splice(insertAt, 0, ...missing.map((entry) => `  ${entry.replaceAll("'", '"')}`));
}

function mapToCatalogs(
	dependencies: Record<string, string> | undefined,
	catalogs: ReadonlyMap<string, string>,
	appCatalog: string,
	uncatalogued: Array<readonly [string, string]>,
): Record<string, string> | undefined {
	if (dependencies === undefined) return undefined;

	const mapped = Object.entries(dependencies).map(([packageName, version]): [string, string] => {
		const catalog = catalogs.get(packageName);
		if (catalog !== undefined) {
			return [packageName, `catalog:${catalog}`];
		}

		if (version.startsWith("workspace:")) {
			return [packageName, version];
		}

		uncatalogued.push([packageName, version]);
		return [packageName, `catalog:${appCatalog}`];
	});

	return Object.fromEntries(mapped.toSorted(([left], [right]) => left.localeCompare(right)));
}

async function writeCloudflareConfigAsync(
	directory: string,
	workerName: string,
	features: TanStackFeatures,
): Promise<void> {
	const path = nodePath.join(directory, "wrangler.jsonc");
	const wrangler = await readJsoncAsync(path, isWranglerConfiguration, " Run `cf migrate` instead.");

	const flags = (wrangler.compatibility_flags ?? []).map((flag) => JSON.stringify(flag)).join(", ");
	// The CLI's date matches the Workers runtime it installs; today's date can
	// be newer than the local runtime supports, and then dev refuses to start.
	const compatibilityDate = wrangler.compatibility_date ?? FALLBACK_COMPATIBILITY_DATE;
	const imports = features.drizzle ? "bindings, defineConfig" : "defineConfig";

	// `cf deploy` creates the database on the first deploy; put its id here
	// (and in CLOUDFLARE_DATABASE_ID) afterwards so migrations can find it.
	const environment = features.drizzle
		? `\t\tenv: {\n\t\t\tDB: bindings.d1({\n\t\t\t\tname: ${JSON.stringify(workerName)},\n\t\t\t}),\n\t\t},\n`
		: "";

	await writeFile(
		nodePath.join(directory, "cloudflare.config.ts"),
		`import { ${imports} } from "cf/config";\n\nexport default defineConfig({\n\tworker: {\n\t\tname: ${JSON.stringify(workerName)},\n\t\tcompatibilityDate: "${compatibilityDate}",\n\t\tcompatibilityFlags: [${flags}],\n\t\t// TanStack Start's handler plus security headers (src/server.ts).\n\t\tentrypoint: "./src/server.ts",\n${environment}\t\tobservability: {\n\t\t\tenabled: true,\n\t\t\tredactQueryString: true,\n\t\t},\n\t},\n});\n`,
	);
}

async function updatePackageJsonAsync(
	directory: string,
	options: TanStackAppOptions,
	features: TanStackFeatures,
	workspace: Array<string>,
): Promise<void> {
	const path = nodePath.join(directory, "package.json");
	const packageJson = await readJsoncAsync(path, isPackageJson);
	const catalogs = getCatalogs(workspace);
	const uncatalogued = new Array<readonly [string, string]>();

	const { wrangler: _wrangler, ...cliDevelopmentDependencies } = packageJson.devDependencies ?? {};
	const devDependencies = withoutSwapped(
		{
			...cliDevelopmentDependencies,
			"@cloudflare/vite-plugin": "",
			cf: "",
			"vite-plus": "",
		},
		features,
	);
	const cliDependencies = withoutSwapped(packageJson.dependencies ?? {}, features);
	const dependencies = features.shadcn
		? { "@base-ui/react": BASE_UI_VERSION, cn: CN_VERSION, ...cliDependencies }
		: cliDependencies;
	const catalogsWithCloudflare = new Map([...catalogs, ["@cloudflare/vite-plugin", "cf"]]);

	// Here `vite` is Vite+'s core without a binary; `vp` is the command.
	const cliScripts = Object.entries(packageJson.scripts ?? {}).map(([key, script]): [string, string] => [
		key,
		script.replace(VITE_COMMAND, "vp "),
	]);
	const scriptEntries: Array<readonly [string, string]> = [
		...cliScripts,
		["cf-typegen", "cf workers types"],
		["deploy", "turbo run build type-check && cf deploy --prebuilt --mode production"],
		["test", "vp test run --config vitest.unit.config.ts"],
		// A fresh clone has no .cloudflare/types until `cf workers types` runs.
		["postinstall", "node --run cf-typegen > /dev/null"],
		["type-check", "node --run cf-typegen > /dev/null && tsrs --noEmit"],
		["type-check:agent", "node --run cf-typegen > /dev/null && tsrs --noEmit --pretty false"],
	];

	if (features.drizzle) {
		// `cf d1 migrations apply` takes the database id, not the binding name.
		scriptEntries.push(
			["db:migrate", `${D1_MIGRATIONS} --local --persist-to .cloudflare/state`],
			["db:migrate:remote", D1_MIGRATIONS],
		);
	}

	if (cliScripts.some(([key]) => key === "storybook")) {
		scriptEntries.push(["test:browser", "vp test run --project storybook"]);
	}

	const scripts = Object.fromEntries(scriptEntries);

	// pnpm settings move to the root workspace; the rest keeps the CLI's order.
	const { dependencies: _dependencies, pnpm: _pnpm, ...rest } = packageJson;
	const homepage = options.hostname.length > 0 ? `https://${options.hostname}` : undefined;
	const updated = {
		...rest,
		name: `@web-template/${options.name}`,
		dependencies: mapToCatalogs(dependencies, catalogsWithCloudflare, options.name, uncatalogued),
		description: options.description,
		devDependencies: mapToCatalogs(devDependencies, catalogsWithCloudflare, options.name, uncatalogued),
		homepage,
		private: true,
		scripts: Object.fromEntries(Object.entries(scripts).toSorted(([left], [right]) => left.localeCompare(right))),
		type: "module",
		version: "0.0.0",
	};

	addCatalog(workspace, "cf", [["@cloudflare/vite-plugin", CLOUDFLARE_VITE_PLUGIN_BETA]]);
	addCatalog(workspace, options.name, uncatalogued);
	await writeFile(path, `${JSON.stringify(updated, undefined, JSON_INDENT)}\n`);
}

/**
 * Moves the CLI's pnpm settings, like packages allowed to run build scripts,
 * into the root workspace.
 *
 * @param directory - The app's directory.
 * @param workspace - The root `pnpm-workspace.yaml`, edited in place.
 */
async function mergeWorkspaceSettingsAsync(directory: string, workspace: Array<string>): Promise<void> {
	const path = nodePath.join(directory, WORKSPACE);
	if (!(await existsAsync(path))) return;

	const appWorkspace = await readLinesAsync(path);
	const builds = getBlock(appWorkspace, "allowBuilds").filter((entry) => !entry.includes("better-sqlite3"));
	addToBlock(workspace, "allowBuilds", builds);
	addToBlock(workspace, "minimumReleaseAgeExclude", getBlock(appWorkspace, "minimumReleaseAgeExclude"));
}

async function updateTsconfigAsync(directory: string, name: string): Promise<void> {
	const path = nodePath.join(directory, "tsconfig.json");
	const tsconfig = await readJsoncAsync(path, isTsConfig);
	const updated = {
		...tsconfig,
		compilerOptions: {
			tsBuildInfoFile: `./node_modules/.tmp/${name}.tsbuildinfo`,
			...tsconfig.compilerOptions,
		},
		// Include globs skip dot-folders: `cf workers types` writes the Worker's
		// `Env` under .cloudflare, and Storybook keeps its config in .storybook.
		include: [
			...(tsconfig.include ?? ["**/*.ts", "**/*.tsx"]),
			".cloudflare/types/index.d.ts",
			".storybook/**/*.ts",
			".storybook/**/*.tsx",
		],
	};

	await writeFile(path, `${JSON.stringify(updated, undefined, JSON_INDENT)}\n`);
}

function withoutSwapped(dependencies: Record<string, string>, features: TanStackFeatures): Record<string, string> {
	return Object.fromEntries(
		Object.entries(dependencies).filter(
			([packageName]) =>
				(!features.drizzle || !SQLITE_ONLY.has(packageName)) &&
				(!features.shadcn || !RADIX_ONLY.has(packageName)) &&
				(!features.orpc || !OPENAPI_ONLY.has(packageName)),
		),
	);
}

/**
 * Points shadcn at Base UI and the `cn` package, and removes the CLI's Radix
 * components and class helper; `addMissingShadcnComponentsAsync` adds the
 * Base UI ones after installing.
 *
 * @param directory - The app's directory.
 */
async function switchToBaseUiAsync(directory: string): Promise<void> {
	const path = nodePath.join(directory, COMPONENTS_JSON);
	const components = await readJsoncAsync(path, isShadcnConfiguration);
	const updated = { ...components, aliases: { ...components.aliases, utils: "cn" }, style: "base-luma" };
	await writeFile(path, `${JSON.stringify(updated, undefined, JSON_INDENT)}\n`);
	await Promise.all([
		rm(nodePath.join(directory, SHADCN_UI), { force: true, recursive: true }),
		rm(nodePath.join(directory, "src/lib/utils.ts"), { force: true }),
	]);
}

/**
 * Makes the browser's oRPC link send the CSRF header that the POST-only
 * handler in `routes/api.rpc.$.ts` checks for.
 *
 * @param directory - The app's directory.
 * @rejects When the CLI's client no longer has the shape this expects.
 */
async function addCsrfLinkPluginAsync(directory: string): Promise<void> {
	const path = nodePath.join(directory, "src/orpc/client.ts");
	const source = await readFile(path, "utf8");
	if (source.includes("SimpleCsrfProtectionLinkPlugin")) return;

	if (!RPC_LINK.test(source) || !RPC_LINK_IMPORT.test(source)) {
		throw new Error(`${path} changed shape; add SimpleCsrfProtectionLinkPlugin to its RPCLink by hand.`);
	}

	const updated = source
		.replace(
			RPC_LINK_IMPORT,
			(line) => `${line}\nimport { SimpleCsrfProtectionLinkPlugin } from "@orpc/client/plugins";`,
		)
		.replace(RPC_LINK, (call) => `${call}\n\t\t\tplugins: [new SimpleCsrfProtectionLinkPlugin()],`);

	await writeFile(path, updated);
}

/**
 * Leaves oRPC with only the POST-only, CSRF-checked `/api/rpc` route: the
 * CLI's OpenAPI catch-all answers every method unchecked, and its polyfill
 * only covers Node 18 on StackBlitz.
 *
 * @param directory - The app's directory.
 */
async function secureOrpcAsync(directory: string): Promise<void> {
	await Promise.all([
		addCsrfLinkPluginAsync(directory),
		rm(nodePath.join(directory, "src/routes/api.$.ts"), { force: true }),
		rm(nodePath.join(directory, "src/polyfill.ts"), { force: true }),
	]);
}

/**
 * Adapts the CLI's app to the monorepo. Runs before installing.
 *
 * @param tanStackAppOptions - The generator's answers.
 * @returns A summary for plop.
 */
export async function adaptTanStackAppAsync(tanStackAppOptions: TanStackAppOptions): Promise<string> {
	const directory = getDirectory(tanStackAppOptions.name);
	const workspace = await readLinesAsync(WORKSPACE);
	const features = await detectFeaturesAsync(tanStackAppOptions.name);

	// Both edit `workspace` in place, so they run in order.
	await mergeWorkspaceSettingsAsync(directory, workspace);
	await updatePackageJsonAsync(directory, tanStackAppOptions, features, workspace);
	await Promise.all([
		writeCloudflareConfigAsync(directory, tanStackAppOptions.workerName, features),
		features.shadcn ? switchToBaseUiAsync(directory) : Promise.resolve(),
		features.orpc ? secureOrpcAsync(directory) : Promise.resolve(),
		updateTsconfigAsync(directory, tanStackAppOptions.name),
		writeFile(nodePath.join(directory, "turbo.json"), TURBO_JSON),
	]);

	await Promise.all(
		DISCARDED.map(async (file) => rm(nodePath.join(directory, file), { force: true, recursive: true })),
	);
	await writeFile(WORKSPACE, workspace.join("\n"));
	return `Adapted ${directory} to the monorepo`;
}

async function listSourceFilesAsync(directory: string): Promise<ReadonlyArray<string>> {
	const entries = await readdir(directory, { recursive: true, withFileTypes: true });
	return entries.flatMap((entry) =>
		entry.isFile() && TYPESCRIPT_FILE.test(entry.name) ? [nodePath.join(entry.parentPath, entry.name)] : [],
	);
}

async function getImportedComponentsAsync(file: string): Promise<ReadonlyArray<string>> {
	const source = await readFile(file, "utf8");
	const imports = source.matchAll(SHADCN_IMPORT);
	return [...imports].flatMap((match) => (match.groups?.component === undefined ? [] : [match.groups.component]));
}

async function hasComponentAsync(directory: string, component: string): Promise<boolean> {
	const [tsx, ts] = await Promise.all([
		existsAsync(nodePath.join(directory, SHADCN_UI, `${component}.tsx`)),
		existsAsync(nodePath.join(directory, SHADCN_UI, `${component}.ts`)),
	]);

	return tsx || ts;
}

/**
 * The CLI installs shadcn components with `shadcn add`, which needs
 * installed packages, so it fails under `--no-install`. Adds every component
 * the app imports but does not have yet.
 *
 * @param name - The app name.
 * @returns A summary for plop.
 */
export async function addMissingShadcnComponentsAsync(name: string): Promise<string> {
	const directory = getDirectory(name);
	if (!(await existsAsync(nodePath.join(directory, COMPONENTS_JSON)))) return "No shadcn in this app";

	const files = await listSourceFilesAsync(nodePath.join(directory, "src"));
	const imported = await Promise.all(files.map(getImportedComponentsAsync));
	const components = [...new Set(imported.flat())];
	const present = await Promise.all(components.map(async (component) => hasComponentAsync(directory, component)));
	const missing = components.filter((_, index) => present[index] !== true);
	if (missing.length === 0) return "No shadcn components missing";

	await runAsync("nlx", ["--local", "shadcn", "add", "--yes", "--silent", ...missing], directory);
	return `Added shadcn components: ${missing.join(", ")}`;
}
