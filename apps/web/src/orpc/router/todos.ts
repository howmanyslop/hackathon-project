import { ORPCError, os } from "@orpc/server";
import { isNonEmptyString, isUndefined } from "@web-template/arktype-utilities";
import { type } from "arktype";
import { asc } from "drizzle-orm";

import { getDatabase } from "$db/index";
import { todos } from "$db/schema";
import { indexTodoAsync, searchTodosAsync } from "$search/todos";

import type { TodoSearchResult } from "$search/todos";

interface Todo {
	readonly id: number;
	readonly name: string;
}

const TODO_COLUMNS = { id: todos.id, name: todos.name };

export const listTodos = os.input(type({}).readonly()).handler(async function listTodosHandler(): Promise<
	ReadonlyArray<Todo>
> {
	return getDatabase().select(TODO_COLUMNS).from(todos).orderBy(asc(todos.id));
});

// An insert with `returning` always yields the inserted row.
export const addTodo = os
	.input(
		type({
			name: isNonEmptyString,
		}).readonly(),
	)
	.handler(async function addTodoHandler({ input }): Promise<Todo> {
		const [todo] = await getDatabase()
			.insert(todos)
			.values({ name: input.name })
			.returning({ ...TODO_COLUMNS, createdAt: todos.createdAt });

		// Postgres has the todo, so a search outage shouldn't fail the request.
		try {
			await indexTodoAsync(todo);
		} catch (error) {
			console.error(`Couldn't add todo ${todo.id} to the search index:`, error);
		}

		return { id: todo.id, name: todo.name };
	});

export const searchTodos = os
	.input(
		type({
			"limit?": isUndefined.or("1 <= number.integer <= 50"),
			query: isNonEmptyString,
		}).readonly(),
	)
	.handler(async function searchTodosHandler({ input }): Promise<ReadonlyArray<TodoSearchResult>> {
		const results = await searchTodosAsync(input.query, input.limit ?? 10);
		if (results === undefined) {
			throw new ORPCError("SERVICE_UNAVAILABLE", { message: "Search isn't set up on this server." });
		}

		return results;
	});
