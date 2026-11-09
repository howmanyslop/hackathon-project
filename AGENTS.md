# Agents Guide

This file gives agents guidance for working with code in this repository.

## What This Is

A web project monorepo. The app lives in `apps/web`: TanStack Start and React 19 on Node (Nitro), with Postgres through Drizzle, oRPC, and TanStack Query. It deploys to the team's k3s cluster (`k8s/`). Everything else (`packages/*`, `tools/*`, `.opencode`, `scripts`, `turbo/generators`) is shared utilities and developer tooling.

## Workspaces

- `apps/web`: the app (`@web-template/web`). `turbo gen website` adds more apps (see Generators).
- `packages/arktype-utilities`, `english-utilities`, `file-utilities`, `fs-utilities`, `codex-utilities`: shared libraries.
- `tools/lint-configurations`, `linter-utilities`, `vite-plus-configuration`: shared lint, formatter, and test configuration. Path-scoped lint overrides live in `tools/lint-configurations/src/get-oxlint-async.ts` and use `apps/*` globs.
- `scripts`, `.claude`, `.opencode`: repository tooling and agent hooks. `.claude/hooks/react-doctor.ts` runs react-doctor after Claude edits files.

CI (`.github/workflows/ci.yaml`) runs lint, type-check, file checks, dead code, unit tests, and builds. Browser tests run on pushes and on pull requests labeled `full-ci`. CI doesn't deploy; `mise run k8s:deploy` does, from a laptop.

## Tooling

- Package manager is **pnpm** (pinned in `mise.toml`). Catalogs live in `pnpm-workspace.yaml`, and dependencies use `catalog:` specifiers. Node 26. Tools come from `mise`.
- The test and build runner is **Vite+** (`vp`, Vitest underneath).
- Type-checking uses `tsrs` (a native TypeScript 7 compiler), not the JavaScript `tsc` from TypeScript 6.
- The root `.env` loads through mise and holds `DATABASE_URL` for local development (`.env.example`).
- The repository and the `ghcr.io/howmanyslop/web` images are public. Production secrets live only in Kubernetes Secrets in the `web` namespace, created by `k8s:deploy`. Never commit a secret, a kubeconfig, or the cluster's Tailscale names or addresses, and never put a secret in a `VITE_*` variable.
- `mise.toml` sets `KUBECONFIG` to `~/.kube/hackathon.yaml`, so `kubectl` in this repository only talks to the team cluster.

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
nr --filter '@web-template/web' dev                # vp dev against DATABASE_URL
nr --filter '@web-template/web' build              # Nitro build to .output/ (start: node .output/server/index.mjs)
nr --filter '@web-template/web' db:generate        # drizzle-kit: new migration from src/db/schema.ts
nr --filter '@web-template/web' db:migrate         # apply migrations to DATABASE_URL (the app also migrates at startup)
nr --filter '@web-template/web' shadcn add <name>  # add a Base UI component under src/components/ui
```

Cluster tasks (see `README.md` for setup):

```sh
mise run k8s:deploy    # build linux/amd64 image, scan it for secrets, push to ghcr.io, apply k8s/
mise run k8s:status    # pods, services, ingress, volumes in the web namespace
mise run k8s:logs      # follow the app's logs
mise run k8s:db        # port-forward the cluster's Postgres to localhost:5432
mise run k8s:down      # delete the web namespace, database included (asks first)
```

Unit tests (`src/**/*.test.ts`) run in Node through `apps/web/vitest.unit.config.ts`. Stories (`*.stories.tsx`) double as browser tests through the `storybook` project in `apps/web/vite.config.ts`.

## Generators

`turbo gen` lists them. `turbo gen website` asks for a name and a stack.

- **TanStack Start** runs TanStack's own CLI (`tanstack create`) with pnpm, Vite, no toolchain, and the Cloudflare target fixed, then asks its add-on questions. Afterwards it adapts the output: catalogs instead of version ranges, `cloudflare.config.ts` instead of Wrangler, `src/server.ts` with security headers, Drizzle on D1, oRPC limited to POST with CSRF checks, and shadcn on Base UI.
- **Astro** writes a small Astro site with React islands and `wrangler.jsonc`.
- The generators still target Cloudflare Workers, and the TanStack one fails at `cf workers types` because `cf` was removed. They need updating before use.
- `package`, `multi-entry-package`, and `opencode-plugin` add workspace packages.

## Git Hooks and Commits

`hk.pkl` runs the checks: type-check, ESLint, Biome, `sherif`, `rumdl`, secret scanning, and more. Pre-push also runs fallow, unit tests, and package builds. `HACKATHON=1 git push` skips those three slow steps; secret scanning always runs.

Commit messages follow Conventional Commits, enforced by `commitlint`: a header of at most 72 characters, a lower-case scope, and types limited to feat/fix/refactor/docs/style/test/chore/perf/ci/build. `mise run commit "<message>"` commits with sign-off.

`.claude/settings.json` adds a `PreToolUse` gate that runs `fallow audit` before Claude commits or pushes, and a `Stop` hook that runs `hk run check --safe`.

Do not hand-edit generated code (`*.gen.ts`, `src/components/ui/`, generated SQL in `drizzle/`). Linting skips it.

## Architecture (`apps/web/src`)

Imports across `src` folders use one `$` alias per top-level folder (`$components/*`, `$db/*`, `$orpc/*`, and so on), set in `apps/web/tsconfig.json`.

- `routes/` is TanStack Router file-based routing. `routeTree.gen.ts` is generated.
- `server.ts` is the server entry: TanStack Start's handler plus security headers and a Content Security Policy. Nitro wraps it in a Node server. It runs database migrations once at startup (`db/migrate.ts`), and every request, `/healthz` included, waits for them.
- `routes/healthz.ts` answers Kubernetes' readiness and liveness checks.
- All server calls go through one oRPC router (`orpc/router/index.ts`), mounted at `routes/api.rpc.$.ts`. It accepts POST only and checks CSRF (`server/csrf.ts`). `orpc/client.ts` calls the router in-process during SSR and over `/api/rpc` in the browser.
- `db/` holds the Drizzle schema and the Postgres client (`getDatabase()`, from `DATABASE_URL`). Migrations go in `drizzle/`.

## Deployment (`k8s/`, `apps/web/Dockerfile`)

- `k8s/` is plain manifests applied with Kustomize into the `web` namespace: Postgres (StatefulSet, `local-path` volume), the app (Deployment with three replicas spread across machines, a PodDisruptionBudget, Service, Traefik Ingress with no host rule).
- `apps/web/Dockerfile` builds on the host's CPU and ships a `linux/amd64` runtime with only `.output/` and `drizzle/`. Its `app-files` stage is what `k8s:deploy` scans for secrets.
- `integrations/` wires TanStack Query into the router.
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
