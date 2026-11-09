import { os } from "@orpc/server";
import { type } from "arktype";
import { asc } from "drizzle-orm";

import { getDatabase } from "$db/index";
import { todos } from "$db/schema";

interface Todo {
	readonly id: number;
	readonly name: string;
}

const TODO_COLUMNS = { id: todos.id, name: todos.name };

export const listTodos = os.input(type({})).handler(async function listTodosHandler(): Promise<ReadonlyArray<Todo>> {
	return getDatabase().select(TODO_COLUMNS).from(todos).orderBy(asc(todos.id));
});

// An insert with `returning` always yields the inserted row.
export const addTodo = os.input(type({ name: "string > 0" })).handler(async function addTodoHandler({
	input,
}): Promise<Todo> {
	const [todo] = await getDatabase().insert(todos).values({ name: input.name }).returning(TODO_COLUMNS);
	return todo;
});
