# Agents Guide

This file gives agents guidance for working with code in this repository.

## What This Is

A web project monorepo. The app lives in `apps/web`: TanStack Start and React 19 on Cloudflare Workers, with D1 (SQLite) through Drizzle, Clerk auth, oRPC, and TanStack Query. Everything else (`packages/*`, `tools/*`, `.opencode`, `scripts`, `turbo/generators`) is shared utilities and developer tooling.

## Workspaces

- `apps/web`: the app (`@web-template/web`). `turbo gen website` adds more apps (see Generators).
- `packages/arktype-utilities`, `english-utilities`, `file-utilities`, `fs-utilities`, `codex-utilities`: shared libraries.
- `tools/lint-configurations`, `linter-utilities`, `vite-plus-configuration`: shared lint, formatter, and test configuration. Path-scoped lint overrides live in `tools/lint-configurations/src/get-oxlint-async.ts` and use `apps/*` globs.
- `scripts`, `.claude`, `.opencode`: repository tooling and agent hooks. `.claude/hooks/react-doctor.ts` runs react-doctor after Claude edits files.

CI (`.github/workflows/ci.yaml`) runs lint, type-check, file checks, dead code, unit tests, and builds. Browser tests run on pushes and on pull requests labeled `full-ci`. The deploy job stays off until the repository variable `DEPLOY_ENABLED` is `true`.

## Tooling

- Package manager is **pnpm** (pinned in `mise.toml`). Catalogs live in `pnpm-workspace.yaml`, and dependencies use `catalog:` specifiers. Node 26. Tools come from `mise`.
- The test and build runner is **Vite+** (`vp`, Vitest underneath).
- Type-checking uses `tsrs` (a native TypeScript 7 compiler), not the JavaScript `tsc` from TypeScript 6.
- The root `.env` loads through mise and holds the Cloudflare values for D1 (`.env.example`). Clerk's keys go in `apps/web/.env` (`apps/web/.env.example`), which Vite and the Workers dev runtime read. Production secrets belong in `apps/web/cloudflare.config.ts` as `bindings.secret()`.
- Cloudflare config is `cloudflare.config.ts`, driven by the `cf` CLI (`cf deploy`, `cf workers types`, `cf d1 migrations apply`). Astro apps use `wrangler.jsonc`, because `cf` cannot build Astro 6 and later yet.

## Commands

Run from the repository root unless noted. Package tasks run through Turborepo; add `--filter=<package>` to scope a `turbo run`.

```sh
node --run dev                 # turbo: every app's dev server
node --run type-check          # turbo: tsrs --noEmit in every workspace, plus the root config files
node --run test                # turbo: unit tests in every workspace
node --run test:browser        # turbo: Storybook tests (headless Chromium)
node --run build               # turbo: package and app builds
node --run lint -- <paths>     # ESLint and oxlint (isentinel-lint) then Biome; defaults to the whole repository
node --run lint:agent -- <paths>   # same, with terse output for agents
node --run fallow:dead-code    # unused exports, files, and dependencies
```

App scripts:

```sh
nr --filter '@web-template/web' dev                # vp dev (Workers runtime and local D1)
nr --filter '@web-template/web' deploy             # turbo build and type-check, then cf deploy --prebuilt
nr --filter '@web-template/web' db:generate        # drizzle-kit: new migration from src/db/schema.ts
nr --filter '@web-template/web' db:migrate         # apply migrations to local D1 (db:migrate:remote for production)
nr --filter '@web-template/web' cf-typegen         # regenerate .cloudflare/types after editing cloudflare.config.ts
nr --filter '@web-template/web' shadcn add <name>  # add a Base UI component under src/components/ui
```

Unit tests (`src/**/*.test.ts`) run in Node through `apps/web/vitest.unit.config.ts`. Stories (`*.stories.tsx`) double as browser tests through the `storybook` project in `apps/web/vite.config.ts`.

## Generators

`turbo gen` lists them. `turbo gen website` asks for a name and a stack.

- **TanStack Start** runs TanStack's own CLI (`tanstack create`) with pnpm, Vite, no toolchain, and the Cloudflare target fixed, then asks its add-on questions. Afterwards it adapts the output: catalogs instead of version ranges, `cloudflare.config.ts` instead of Wrangler, `src/server.ts` with security headers, Drizzle on D1, oRPC limited to POST with CSRF checks, and shadcn on Base UI.
- **Astro** writes a small Astro site with React islands and `wrangler.jsonc`.
- `package`, `multi-entry-package`, and `opencode-plugin` add workspace packages.

## Git Hooks and Commits

`hk.pkl` runs the checks: type-check, ESLint, Biome, `sherif`, `rumdl`, secret scanning, and more. Pre-push also runs fallow, unit tests, and package builds. `HACKATHON=1 git push` skips those three slow steps; secret scanning always runs.

Commit messages follow Conventional Commits, enforced by `commitlint`: a header of at most 72 characters, a lower-case scope, and types limited to feat/fix/refactor/docs/style/test/chore/perf/ci/build. `mise run commit "<message>"` commits with sign-off.

`.claude/settings.json` adds a `PreToolUse` gate that runs `fallow audit` before Claude commits or pushes, and a `Stop` hook that runs `hk run check --safe`.

Do not hand-edit generated code (`*.gen.ts`, `.cloudflare/`, `src/components/ui/`). Linting skips it.

## Architecture (`apps/web/src`)

Imports use the `#/*` subpath alias for `src/*`.

- `routes/` is TanStack Router file-based routing. `routeTree.gen.ts` is generated.
- `server.ts` is the Worker entry: TanStack Start's handler plus security headers and a Content Security Policy. Add a `scheduled` handler here for cron triggers.
- All server calls go through one oRPC router (`orpc/router/index.ts`), mounted at `routes/api.rpc.$.ts`. It accepts POST only and checks CSRF (`server/csrf.ts`). `orpc/client.ts` calls the router in-process during SSR and over `/api/rpc` in the browser.
- `db/` holds the Drizzle schema and the D1 client (`env.DB`). Migrations go in `drizzle/`.
- `integrations/` wires Clerk and TanStack Query into the router.
- UI uses Tailwind 4 and shadcn on Base UI. React Compiler handles memoization, so `useMemo`, `useCallback`, and `memo` are banned, and so is `useEffect` by default.

## Writing Conventions

USE AMERICAN ENGLISH ALWAYS!!

## `hk`

- Ask the `hk` MCP server to inspect the project and plan checks before execution.
- Scope work to changed files (`--files0-from` accepts exact NUL-delimited paths) and use `--cd` for another project root.
- Prefer safe checks and safe fixes. Inspect command effects and ask before any unknown or destructive command.
- Read normalized diagnostics from structured results, then inspect the patch before reporting or committing a fix.
- If MCP is unavailable, run `hk run check --format jsonl --safe`; the final event is the authoritative summary.

## Agent Skills

### Issue Tracker

Issues and specs are GitHub issues on this repository's remote, driven with the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage Labels

The five canonical triage roles map one-to-one to same-named labels. See `docs/agents/triage-labels.md`.

### Domain Docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repository root. See `docs/agents/domain.md`.
