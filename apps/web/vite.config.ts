import nodePath from "node:path";
import { cloudflare } from "@cloudflare/vite-plugin";
import babel from "@rolldown/plugin-babel";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";
import { playwright } from "vite-plus/test/browser-playwright";

const config = defineConfig({
	plugins: [
		devtools(),
		cloudflare({
			viteEnvironment: {
				name: "ssr",
			},
		}),
		tailwindcss(),
		tanstackStart(),
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
