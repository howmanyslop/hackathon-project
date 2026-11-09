import { bindings, defineConfig } from "cf/config";

export default defineConfig({
	worker: {
		name: "web",
		compatibilityDate: "2025-09-02",
		compatibilityFlags: ["nodejs_compat"],
		domains: ["hackathon.howmanysmall.com"],
		// TanStack Start's handler plus security headers (src/server.ts).
		entrypoint: "./src/server.ts",
		env: {
			DB: bindings.d1({
				name: "web",
			}),
		},
		// Logs and traces also export to Dash0 over OTLP. Each destination name
		// must match an account-level destination in the Cloudflare dashboard
		// (Observability > Destinations).
		observability: {
			enabled: true,
			logs: {
				destinations: ["dash0-logs"],
				enabled: true,
			},
			redactQueryString: true,
			traces: {
				destinations: ["dash0-traces"],
				enabled: true,
			},
		},
		workersDev: false,
	},
});
