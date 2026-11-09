import { packConfiguration } from "@web-template/vite-plus-configuration/tsdown";
import { testConfiguration } from "@web-template/vite-plus-configuration/vitest";
import { defineConfig } from "vite-plus";
import { mergeConfig as mergePackConfig } from "vite-plus/pack";
import { mergeConfig as mergeTestConfig } from "vite-plus/test/config";

const configuration = defineConfig({
	...mergeTestConfig(testConfiguration, {
		test: {
			name: "english-utilities",
			include: ["src/**/*.test.ts"],
			testTimeout: 5_000,
		},
	}),
	pack: mergePackConfig(packConfiguration, {
		// Entries are raw src/*.ts with extensionless relative imports, which attw
		// cannot resolve under node16 ESM. This package is private and is only ever
		// resolved by bundlers, so that resolution mode does not apply to it.
		attw: { ignoreRules: ["internal-resolution-error"] },
		entry: {
			"format-array-as-english-list": "./src/format-array-as-english-list.ts",
			"get-indefinite-article": "./src/get-indefinite-article.ts",
			"to-plural": "./src/to-plural.ts",
		},
	}),
});

export default configuration;
