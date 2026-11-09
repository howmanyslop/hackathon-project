import nodePath from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

import { getDatabase } from "./index.ts";

// Any fixed number works; every copy of the app has to use the same one.
const MIGRATION_LOCK_KEY = 7_316_001;

/**
 * Applies the SQL migrations in `drizzle/` (relative to the working
 * directory: `apps/web` in development, `/app` in the container).
 *
 * Every copy of the app runs this at startup. A Postgres advisory lock lets
 * one copy migrate while the others wait, then find nothing left to do.
 *
 * @returns Resolves once the database schema is up to date.
 */
export async function migrateDatabaseAsync(): Promise<void> {
	const connection = await getDatabase().$client.connect();
	try {
		await connection.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_KEY]);
		await migrate(drizzle(connection), { migrationsFolder: nodePath.resolve("drizzle") });
	} finally {
		await connection.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_KEY]);
		connection.release();
	}
}
