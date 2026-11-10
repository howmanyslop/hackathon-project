# web

The Asked & Answered app: TanStack Start on Node, built with Nitro. See the root `AGENTS.md` for commands and architecture, and the root `README.md` for the product, the settings, and deploying to the cluster.

## First Run

Development uses the cluster's Postgres. There is no local database container.

```sh
mise run k8s:db               # from the repository root; forwards Postgres and prints the DATABASE_URL to export
cp .env.example .env          # from the repository root; set DATABASE_URL and PRESENTER_CODE
node --run dev
```

Migrations run when the app starts. Open `/record` to record a session, or run `mise run seed -- http://localhost:3000` to load the sample talks in `seed/`.

`/record` needs the microphone, and phones only allow it over HTTPS. To try it on a phone, use the public address that the cluster's tunnel serves.

## Database

`src/db/schema.ts` is the Drizzle schema (`sessions`, `segments`, `pairs`, and `ask_log`, which caps the Ask box's spending), and `src/db/index.ts` connects with `DATABASE_URL`. After changing the schema, `nr db:generate -- --name <what-changed>` writes a migration to `drizzle/`, and `nr db:migrate` applies it. `nr db:studio` opens a browser view of the data.

## Sample Data

`seed/*.json` holds four invented talks, one per file. Each has a title ending in "(sample)", a speaker, an optional `recordingUrl` and `qaStartMs`, and its `segments` (`startMs`, `endMs`, `text`). One talk has no `qaStartMs`, so the seed also exercises the LLM finding the Q&A start.
