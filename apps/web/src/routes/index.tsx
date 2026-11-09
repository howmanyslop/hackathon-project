import { createFileRoute } from "@tanstack/react-router";

import { TodoList } from "$components/todo-list";

import type { ReactNode } from "react";

function Home(): ReactNode {
	return (
		<main className="p-8">
			<h1 className="text-4xl font-bold">{"web"}</h1>
			<p className="mt-4 text-lg">
				{"Edit "}
				<code>{"src/routes/index.tsx"}</code>
				{" to get started."}
			</p>
			<TodoList />
		</main>
	);
}

export const Route = createFileRoute("/")({ component: Home });
