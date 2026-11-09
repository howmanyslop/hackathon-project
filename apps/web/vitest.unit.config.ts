import { defineConfig } from "vite-plus";

// Unit tests run in Node, apart from the browser projects in vite.config.ts.
const configuration = defineConfig({
	resolve: {
		tsconfigPaths: true,
	},
	test: {
		name: "unit",
		environment: "node",
		include: ["src/**/*.test.{ts,tsx}"],
	},
});

export default configuration;
