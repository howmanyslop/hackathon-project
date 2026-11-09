// biome-ignore-all lint/style/noHeadElement: TanStack Start renders the whole document here.

import { TanStackDevtools } from "@tanstack/react-devtools";
import { createRootRouteWithContext, HeadContent, Scripts } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";

import { AppClerkProvider } from "../integrations/clerk/provider";
import queryDevtools from "../integrations/tanstack-query/devtools";

import appCss from "../styles.css?url";

import type { PropsWithChildren, ReactNode } from "react";

import type { RouterContext } from "../integrations/tanstack-query/root-provider";

function RootDocument({ children }: Readonly<PropsWithChildren>): ReactNode {
	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body>
				<AppClerkProvider>
					{children}
					<TanStackDevtools
						config={{ position: "bottom-right" }}
						plugins={[
							{
								name: "TanStack Router",
								render: <TanStackRouterDevtoolsPanel />,
							},
							queryDevtools,
						]}
					/>
				</AppClerkProvider>
				<Scripts />
			</body>
		</html>
	);
}

export const Route = createRootRouteWithContext<RouterContext>()({
	head: () => ({
		links: [
			{
				href: appCss,
				rel: "stylesheet",
			},
		],
		meta: [
			{
				// oxlint-disable-next-line small-rules/prevent-abbreviations -- React's attribute name.
				charSet: "utf8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "web",
			},
		],
	}),
	shellComponent: RootDocument,
});
