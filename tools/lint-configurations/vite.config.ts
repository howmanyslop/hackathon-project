import { testConfiguration } from "@web-template/vite-plus-configuration/vitest";
import { defineConfig } from "vite-plus";
import { defineConfig as defineTestConfig, mergeConfig as mergeTestConfig } from "vite-plus/test/config";

export default defineConfig({
	...mergeTestConfig(
		testConfiguration,
		defineTestConfig({
			test: {
				name: "lint-configurations",
				include: ["src/**/*.test.ts"],
				// The sonar catalog tests start oxlint in a child process, which
				// takes several seconds when CI runs the builds alongside them.
				testTimeout: 30_000,
			},
		}),
	),
});
