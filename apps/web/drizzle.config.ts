import { env } from "node:process";
import { defineConfig } from "drizzle-kit";

// mise loads the root `.env`, which sets `DATABASE_URL`. `db:generate` only
// needs the schema; `db:migrate` and `db:studio` connect to the database.
const configuration = defineConfig({
	dbCredentials: {
		url: env.DATABASE_URL ?? "",
	},
	dialect: "postgresql",
	out: "./drizzle",
	schema: "./src/db/schema.ts",
});

export default configuration;
