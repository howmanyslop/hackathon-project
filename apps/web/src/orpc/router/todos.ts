import { os } from "@orpc/server";
import { z } from "zod";

interface Todo {
	readonly id: number;
	readonly name: string;
}

// Kept in memory, so it resets whenever the Worker restarts. Swap it for a
// D1 table (src/db/schema.ts) once the data matters.
const todos: Array<Todo> = [
	{ id: 1, name: "Get groceries" },
	{ id: 2, name: "Buy a new phone" },
	{ id: 3, name: "Finish the project" },
];

export const listTodos = os.input(z.object({})).handler(function listTodosHandler(): ReadonlyArray<Todo> {
	return todos;
});

export const addTodo = os.input(z.object({ name: z.string().min(1) })).handler(function addTodoHandler({
	input,
}): Todo {
	const todo = { id: todos.length + 1, name: input.name };
	todos.push(todo);
	return todo;
});
