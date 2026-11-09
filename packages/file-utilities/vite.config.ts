import { packConfiguration } from "@web-template/vite-plus-configuration/tsdown";
import { testConfiguration } from "@web-template/vite-plus-configuration/vitest";
import { defineConfig } from "vite-plus";
import { mergeConfig as mergePackConfig } from "vite-plus/pack";
import { mergeConfig as mergeTestConfig } from "vite-plus/test/config";

const configuration = defineConfig({
	...mergeTestConfig(testConfiguration, {
		test: {
			name: "file-utilities",
			include: ["src/**/*.test.ts"],
			testTimeout: 5_000,
		},
	}),
	pack: mergePackConfig(packConfiguration, {
		entry: {
			"file-content": "./src/file-content-utilities.ts",
			"file-types/jsonc": "./src/file-types/jsonc-utilities.ts",
		},
	}),
});

export default configuration;
