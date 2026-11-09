export const baseIgnores = [
	"!**/.opencode",
	"!**/.opencode/**",
	"**/.opencode/goals",
	".{mise,playwright-mcp}/**",
	"**/*.js",
	"**/routeTree.gen.ts",
	"**/worker-configuration.d.ts",
	"apps/*/.astro/**",
	"apps/*/src/components/ui/**/*.tsx",
	"**/.cloudflare",
	"**/.wrangler",
	"apps/*/vendor",
	"apps/*/drizzle/meta/**/*.json",
	"apps/*/migrations/meta/**/*.json",
	"lighthouse-reports/*.json",
] satisfies ReadonlyArray<string>;

export const projectType: "app" | "game" | "package" = "package";
