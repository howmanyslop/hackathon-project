# web

TanStack Start on Cloudflare Workers. See the root `AGENTS.md` for commands and architecture.

## First Run

The app needs Postgres. The quickest way is a local container:

```sh
docker run -d --name web-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=web -p 5432:5432 postgres:18-alpine
cp .env.example .env          # from the repository root; sets DATABASE_URL
nr --filter '@web-template/web' db:migrate
node --run dev
```

## Database

`src/db/schema.ts` is the Drizzle schema, and `src/db/index.ts` connects with `DATABASE_URL`. After changing the schema, `nr db:generate -- --name <what-changed>` writes a migration to `drizzle/`, and `nr db:migrate` applies it. `nr db:studio` opens a browser view of the data.
