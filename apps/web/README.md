# web

TanStack Start on Cloudflare Workers. See the root `AGENTS.md` for commands and architecture.

## First Run

1. Copy `.env.example` to `.env` here and fill in the Clerk keys. Without them every request fails with "Missing secretKey".
2. `node --run dev` from the repository root.

## Database

`src/db/schema.ts` is the Drizzle schema. `nr db:generate` writes a migration to `drizzle/`. The first `cf deploy` creates the D1 database; put its id in `CLOUDFLARE_DATABASE_ID` (and in `cloudflare.config.ts`), then `nr db:migrate` applies migrations locally and `nr db:migrate:remote` applies them in production.
