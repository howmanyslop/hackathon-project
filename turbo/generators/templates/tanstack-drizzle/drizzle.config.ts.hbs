import { env as environment } from "node:process";
import { defineConfig } from "drizzle-kit";

// mise loads the root `.env`. `db:generate` only needs the schema; the
// credentials are for `db:studio` and `db:pull` against the remote D1
// database. Migrations are applied with `cf d1 migrations apply`.
const configuration = defineConfig({
	dbCredentials: {
		accountId: environment.CLOUDFLARE_ACCOUNT_ID ?? "",
		databaseId: environment.CLOUDFLARE_DATABASE_ID ?? "",
		token: environment.CLOUDFLARE_D1_TOKEN ?? "",
	},
	dialect: "sqlite",
	driver: "d1-http",
	out: "./drizzle",
	schema: "./src/db/schema.ts",
});

export default configuration;
