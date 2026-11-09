import { os } from "@orpc/server";
import { type } from "arktype";

interface Todo {
	readonly id: number;
	readonly name: string;
}

// Kept in memory, so it resets whenever the server restarts. Swap it for a
// database table (src/db/schema.ts) once the data matters.
const todos: Array<Todo> = [
	{ id: 1, name: "Get groceries" },
	{ id: 2, name: "Buy a new phone" },
	{ id: 3, name: "Finish the project" },
];

export const listTodos = os.input(type({})).handler(function listTodosHandler(): ReadonlyArray<Todo> {
	return todos;
});

export const addTodo = os.input(type({ name: "string > 0" })).handler(function addTodoHandler({ input }): Todo {
	const todo = { id: todos.length + 1, name: input.name };
	todos.push(todo);
	return todo;
});
