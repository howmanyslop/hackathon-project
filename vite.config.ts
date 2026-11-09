import { fileURLToPath } from "node:url";
import { getOxlintAsync } from "@web-template/lint-configurations/get-oxlint-async";
import { getOxfmtConfigurationAsync } from "@web-template/linter-utilities/configuration";
import { defineConfig } from "vite-plus";

const tsconfigPath = fileURLToPath(new URL("tsconfig.json", import.meta.url));
const [lint, fmt] = await Promise.all([
	getOxlintAsync({ rootDirectory: import.meta.dirname, tsconfigPath }),
	getOxfmtConfigurationAsync(),
]);

const configuration = defineConfig({
	fmt,
	lint,
	run: {
		cache: true,
	},
});

export default configuration;
