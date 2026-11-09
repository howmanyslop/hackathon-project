import { defineConfig } from "react-doctor/api";

const configuration = defineConfig({
	categories: {},
	ignore: {
		files: ["**/.cloudflare/**"],
		overrides: [],
	},
	rules: {
		"deslop/unused-dependency": "off",
		"deslop/unused-dev-dependency": "off",
		"deslop/unused-export": "off",
		"deslop/unused-file": "off",
		"react-doctor/async-await-in-loop": "off",
		"react-doctor/exhaustive-deps": "off",
	},
});

export default configuration;
