# web

TanStack Start on Cloudflare Workers. See the root `AGENTS.md` for commands and architecture.

## First Run

Run `node --run dev` from the repository root.

## Database

`src/db/schema.ts` is the Drizzle schema. `nr db:generate` writes a migration to `drizzle/`. The first `cf deploy` creates the D1 database; put its id in `CLOUDFLARE_DATABASE_ID` (and in `cloudflare.config.ts`), then `nr db:migrate` applies migrations locally and `nr db:migrate:remote` applies them in production.
