import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";

import { getContext } from "./integrations/tanstack-query/root-provider";
import { routeTree } from "./routeTree.gen";

// oxlint-disable-next-line typescript/explicit-function-return-type typescript/explicit-module-boundary-types -- the router's type is inferred from routeTree, and Register reads it back.
export function getRouter() {
	const context = getContext();

	const router = createTanStackRouter({
		context,
		defaultPreload: "intent",
		// A hover preloads the page; a click within 30 s reuses that load.
		defaultPreloadStaleTime: 30_000,
		routeTree,
		scrollRestoration: true,
	});

	setupRouterSsrQueryIntegration({ queryClient: context.queryClient, router });
	return router;
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
