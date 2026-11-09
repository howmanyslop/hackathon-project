import { bindings, defineConfig } from "cf/config";

export default defineConfig({
	worker: {
		name: "web",
		compatibilityDate: "2025-09-02",
		compatibilityFlags: ["nodejs_compat"],
		// TanStack Start's handler plus security headers (src/server.ts).
		entrypoint: "./src/server.ts",
		env: {
			DB: bindings.d1({
				name: "web",
			}),
		},
		observability: {
			enabled: true,
			redactQueryString: true,
		},
	},
});
