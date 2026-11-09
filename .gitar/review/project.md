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

## Secrets and Telemetry

- The repository and its container images are public. Production secrets
  live only in Kubernetes Secrets, never in source, `k8s/`, or `VITE_*`
  variables. Flag Tailscale hostnames or `100.64.0.0/10` addresses.
- App logs go to stdout in the cluster. Flag `console.*` calls that log tokens, session
  data, request bodies, or personal data.

## Generated Code

- Flag hand edits to `*.gen.ts` or
  `apps/web/src/components/ui/`.
