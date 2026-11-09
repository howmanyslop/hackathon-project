# Review Focus

Gitar already reads `AGENTS.md`. These are the checks that lint and type-check
cannot catch, so flag them in review.

## Server Boundary

- Server calls go through the oRPC router in `apps/web/src/orpc/router/`. Flag
  new `createServerFn` calls, new API routes, or fetch handlers that bypass it.
- `apps/web/src/routes/api.rpc.$.ts` answers POST only and checks CSRF before
  oRPC runs. Flag any change that adds GET, or that skips or weakens
  `isCsrfSafeRequest`.
- `apps/web/src/server.ts` sets the security headers and Content Security
  Policy. Flag CSP loosening (`unsafe-inline`, `unsafe-eval`, wildcard sources)
  that has no stated reason.

## Data

- A change to `apps/web/src/db/schema.ts` needs a matching migration in
  `apps/web/drizzle/`. Flag hand-edited migrations that drizzle-kit already
  generated.
- Queries go through Drizzle. Flag raw SQL built by string concatenation.
- Postgres is the source of truth; Elasticsearch (`apps/web/src/search/`) is a
  copy for search. Flag writes that fail the request when only indexing
  failed, and code that reads data back from Elasticsearch instead of
  Postgres for anything other than search.
- Elasticsearch work that needs search to be on goes through
  `getSearchClient()` and handles `undefined`, since search is optional.

## Secrets and Telemetry

- The repository and its container images are public. Production secrets
  live only in Kubernetes Secrets, never in source, `k8s/`, or `VITE_*`
  variables. Flag Tailscale hostnames or `100.64.0.0/10` addresses.
- Elastic and Dash0 keys come from `.env` locally and reach the cluster
  through `k8s:deploy` and `dash0:install` as Secrets. Flag them anywhere else.
- The Dash0 operator adds OpenTelemetry to the app. Flag an OpenTelemetry SDK
  added to `apps/web`, which would trace every request twice.
- App logs go to stdout in the cluster, and Dash0 collects them. Flag `console.*` calls that log tokens, session
  data, request bodies, or personal data.

## Generated Code

- Flag hand edits to `*.gen.ts` or
  `apps/web/src/components/ui/`.
