import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus/test/config";

export const testConfiguration = defineConfig({
	resolve: { tsconfigPaths: true },
	test: {
		environment: "node",
		fileParallelism: true,
		globals: false,
		isolate: false,
		passWithNoTests: true,
		pool: "forks",
		setupFiles: [fileURLToPath(new URL("setup.ts", import.meta.url))],
		testTimeout: 30_000,
	},
});
