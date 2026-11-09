import { useQuery } from "@tanstack/react-query";

import { orpc } from "$orpc/client";

import type { ReactNode } from "react";

/**
 * The oRPC example end to end: a TanStack Query hook over `listTodos`.
 *
 * @returns The todos as a list.
 */
export function TodoList(): ReactNode {
	const { data: todos = [] } = useQuery(orpc.listTodos.queryOptions({ input: {} }));

	return (
		<ul className="mt-6 list-inside list-disc">
			{todos.map((todo) => (
				<li key={todo.id}>{todo.name}</li>
			))}
		</ul>
	);
}
