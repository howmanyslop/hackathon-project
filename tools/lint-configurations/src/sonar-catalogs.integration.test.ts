import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import nodePath from "node:path";
import { execPath } from "node:process";
import { describe, expect, it, onTestFinished } from "vite-plus/test";

import type { SpawnSyncReturns } from "node:child_process";

const require = createRequire(import.meta.url);
const oxlint = nodePath.join(nodePath.dirname(require.resolve("oxlint/package.json")), "bin/oxlint");
const sonarPlugin = require.resolve("eslint-plugin-sonarjs");

function lintSource(relativeDirectory: string, content: string): SpawnSyncReturns<string> {
	const directory = createWorkspace();
	const source = nodePath.join(directory, "apps/web/example.js");
	writeFileSync(source, content);
	return spawnSync(
		execPath,
		[oxlint, "--config", nodePath.join(directory, ".oxlintrc.json"), "--format", "agent", source],
		{ cwd: nodePath.join(directory, relativeDirectory), encoding: "utf8" },
	);
}

function createWorkspace(): string {
	const temporaryDirectory = mkdtempSync(nodePath.join(tmpdir(), "sonar-catalogs-"));
	const directory = realpathSync(temporaryDirectory);
	onTestFinished(() => {
		rmSync(directory, { force: true, recursive: true });
	});

	const workspace = nodePath.join(directory, "apps/web");
	mkdirSync(workspace, { recursive: true });
	writeFileSync(nodePath.join(directory, "package.json"), JSON.stringify({ private: true }));
	writeFileSync(
		nodePath.join(directory, "pnpm-workspace.yaml"),
		'packages:\n  - apps/*\ncatalogs:\n  testing:\n    chai: "5.0.0"\n',
	);
	writeFileSync(
		nodePath.join(workspace, "package.json"),
		JSON.stringify({ dependencies: { chai: "catalog:testing" }, type: "module" }),
	);
	writeFileSync(
		nodePath.join(directory, ".oxlintrc.json"),
		JSON.stringify({
			jsPlugins: [{ name: "sonar", specifier: sonarPlugin }],
			plugins: [],
			rules: { "sonar/no-floating-point-equality": "error" },
		}),
	);
	return directory;
}

const REGEXP = /sonar\(no-floating-point-equality\)/u;

describe.each([".", "apps/web"])("sonar catalog resolution from %s", (relativeDirectory) => {
	it("resolves workspace catalogs without printing errors for valid code", () => {
		expect.assertions(3);

		const result = lintSource(relativeDirectory, 'import { expect } from "chai";\nexpect(2 + 2).to.equal(4);\n');
		const output = result.stdout + result.stderr;

		expect(result.error).toBeUndefined();
		expect(result.status).toBe(0);
		expect(output).toBe("");
	});

	it("still reports unsafe floating-point equality", () => {
		expect.assertions(3);

		const result = lintSource(
			relativeDirectory,
			'import { expect } from "chai";\nexpect(0.1 + 0.2).to.equal(0.3);\n',
		);
		const output = result.stdout + result.stderr;

		expect(result.error).toBeUndefined();
		expect(result.status).toBe(1);
		expect(output).toMatch(REGEXP);
	});
});
