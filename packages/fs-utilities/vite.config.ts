import { packConfiguration } from "@web-template/vite-plus-configuration/tsdown";
import { testConfiguration } from "@web-template/vite-plus-configuration/vitest";
import { defineConfig } from "vite-plus";
import { mergeConfig } from "vite-plus/pack";
import { mergeConfig as mergeTestConfig } from "vite-plus/test/config";

const configuration = defineConfig({
	...mergeTestConfig(testConfiguration, {
		test: {
			name: "fs-utilities",
			include: ["src/**/*.test.ts"],
			testTimeout: 5_000,
		},
	}),
	pack: mergeConfig(packConfiguration, { entry: "./src/index.ts" }),
});

export default configuration;
