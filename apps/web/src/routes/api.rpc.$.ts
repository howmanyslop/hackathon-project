import { RPCHandler } from "@orpc/server/fetch";
import { SimpleCsrfProtectionHandlerPlugin } from "@orpc/server/plugins";
import { createFileRoute } from "@tanstack/react-router";

import router from "$orpc/router";
import { isBodyTooLarge } from "$server/body-limit";
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

	// oRPC's own body-limit plugin isn't used: it rebuilds the request, which
	// the production server's request object doesn't survive.
	if (isBodyTooLarge(request)) return new Response("Payload too large", { status: 413 });

	const { response } = await rpcHandler.handle(request, {
		// Cloudflare's tunnel sets this to the visitor's address.
		context: { clientAddress: request.headers.get("cf-connecting-ip") ?? undefined },
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
