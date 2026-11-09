import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const todos = pgTable("todos", {
	id: integer().primaryKey().generatedAlwaysAsIdentity(),
	name: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
