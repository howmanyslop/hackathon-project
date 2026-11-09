import nodePath from "node:path";
import babel from "@rolldown/plugin-babel";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite-plus";
import { playwright } from "vite-plus/test/browser-playwright";

const config = defineConfig({
	plugins: [
		devtools(),
		tailwindcss(),
		tanstackStart(),
		// Builds a plain Node server to `.output/server/index.mjs` for the
		// container image.
		nitro({ preset: "node-server" }),
		viteReact(),
		babel({
			presets: [reactCompilerPreset()],
		}),
	],
	resolve: {
		tsconfigPaths: true,
	},
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
});

export default config;
