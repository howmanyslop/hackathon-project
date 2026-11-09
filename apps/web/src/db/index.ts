import { env } from "node:process";
import { type } from "arktype";
import { drizzle } from "drizzle-orm/node-postgres";

// oxlint-disable-next-line import/no-namespace -- drizzle wants the whole schema module.
import * as schema from "./schema.ts";

const parseDatabaseEnvironment = type({ DATABASE_URL: "string.url" });

function createDatabase(): ReturnType<typeof drizzle<typeof schema>> {
	const { DATABASE_URL } = parseDatabaseEnvironment.assert(env);
	return drizzle(DATABASE_URL, { schema });
}

let database: ReturnType<typeof createDatabase> | undefined;

/**
 * The app's Postgres database, connected through `DATABASE_URL`. Created on
 * first use, so importing this module never needs a database.
 *
 * @returns The Drizzle client, shared by every request.
 */
export function getDatabase(): ReturnType<typeof createDatabase> {
	database ??= createDatabase();
	return database;
}
