import nodePath from "node:path";
import process from "node:process";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { redact } from "@tanstack/redact/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite-plus";
import { playwright } from "vite-plus/test/browser-playwright";

/**
 * Whether Vite is serving or building the app itself, as opposed to rendering
 * components for Storybook or Vitest.
 *
 * @param command - `serve` or `build`.
 * @returns True for `dev` and `build`.
 */
function rendersApp(command: string): boolean {
	const isComponentTooling = process.env.VITEST !== undefined || process.env.STORYBOOK !== undefined;
	return command === "build" || !isComponentTooling;
}

function getDevExternals(command: string): Array<string> | undefined {
	return command === "serve" ? ["@elastic/elasticsearch", "@openrouter/sdk", "json-rpc-2.0", "pg"] : undefined;
}

const config = defineConfig(({ command }) => ({
	plugins: [
		devtools(),
		tailwindcss(),
		tanstackStart(),
		// Builds a plain Node server to `.output/server/index.mjs` for the
		// container image.
		nitro({ preset: "node-server" }),
		viteReact({ compiler: true }),
		// Swaps React for TanStack Redact in the browser and SSR bundles. The
		// app keeps importing `react` and `react-dom`.
		rendersApp(command) ? redact() : undefined,
	],
	resolve: {
		tsconfigPaths: true,
	},
	// Redact can only redirect React imports inside server dependencies that
	// Vite bundles. Storybook and Vitest keep them external.
	ssr: rendersApp(command) ? { external: getDevExternals(command), noExternal: true } : undefined,
	test: {
		projects: [
			{
				extends: true,
				plugins: [
					// Runs every story as a browser test.
					storybookTest({
						configDir: nodePath.join(import.meta.dirname, ".storybook"),
					}),
				],
				test: {
					name: "storybook",
					browser: {
						enabled: true,
						headless: true,
						instances: [
							{
								browser: "chromium",
							},
						],
						provider: playwright({}),
					},
				},
			},
		],
	},
}));

export default config;
