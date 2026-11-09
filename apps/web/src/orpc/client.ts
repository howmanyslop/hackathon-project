import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { SimpleCsrfProtectionLinkPlugin } from "@orpc/client/plugins";
import { createRouterClient } from "@orpc/server";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";

import router from "#/orpc/router";

import type { RouterClient } from "@orpc/server";

const getORPCClient = createIsomorphicFn()
	.server(() =>
		createRouterClient(router, {
			context: () => ({
				headers: getRequestHeaders(),
			}),
		}),
	)
	.client((): RouterClient<typeof router> => {
		const link = new RPCLink({
			plugins: [new SimpleCsrfProtectionLinkPlugin()],
			url: `${window.location.origin}/api/rpc`,
		});

		return createORPCClient(link);
	});

const client: RouterClient<typeof router> = getORPCClient();

export const orpc = createTanstackQueryUtils(client);
