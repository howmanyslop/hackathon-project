import { fileURLToPath } from "node:url";
import { getOxlintAsync } from "@web-template/lint-configurations/get-oxlint-async";

const tsconfigPath = fileURLToPath(new URL("tsconfig.json", import.meta.url));
const configuration = await getOxlintAsync({
	banUseEffect: false,
	rootDirectory: import.meta.dirname,
	tsconfigPath,
});

export default configuration;
