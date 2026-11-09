import nodePath from "node:path";
import { defineConfig } from "vite-plus/pack";

export const packConfiguration = defineConfig({
	attw: {
		enabled: true,
		level: "error",
		profile: "esm-only",
	},
	deps: { resolveDepSubpath: true },
	dts: {
		generator: "tsgo",
		incremental: true,
		tsgo: {
			path: nodePath.join(import.meta.dirname, "..", "node_modules", ".bin", "tsrs"),
		},
	},
	exports: false,
	fixedExtension: false,
	format: ["esm"],
	outDir: "dist",
	publint: {
		enabled: true,
		level: "error",
	},
	treeshake: {
		moduleSideEffects: false,
		propertyReadSideEffects: false,
		unknownGlobalSideEffects: false,
	},
});
