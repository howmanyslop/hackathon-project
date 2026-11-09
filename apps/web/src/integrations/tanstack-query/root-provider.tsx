import { QueryClient } from "@tanstack/react-query";

export interface RouterContext {
	readonly queryClient: QueryClient;
}

export function getContext(): RouterContext {
	return { queryClient: new QueryClient() };
}
