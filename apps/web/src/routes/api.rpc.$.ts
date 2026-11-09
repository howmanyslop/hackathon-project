import { RPCHandler } from "@orpc/server/fetch";
import { SimpleCsrfProtectionHandlerPlugin } from "@orpc/server/plugins";
import { createFileRoute } from "@tanstack/react-router";

import router from "$orpc/router";
import { isCsrfSafeRequest } from "$server/csrf";

const rpcHandler = new RPCHandler(router, {
	plugins: [new SimpleCsrfProtectionHandlerPlugin()],
});

interface HandleAsyncOptions {
	readonly request: Request;
}

async function handleAsync({ request }: HandleAsyncOptions): Promise<Response> {
	// The oRPC plugin's static header only proves a script read the token; this
	// proves the request came from this origin.
	if (!isCsrfSafeRequest(request)) return new Response("Forbidden", { status: 403 });

	const { response } = await rpcHandler.handle(request, {
		context: {},
		prefix: "/api/rpc",
	});

	return response ?? new Response("Not Found", { status: 404 });
}

// POST only: the client link sends every call as POST, and nothing that
// changes state should answer a GET.
export const Route = createFileRoute("/api/rpc/$")({
	server: {
		handlers: {
			POST: handleAsync,
		},
	},
});
