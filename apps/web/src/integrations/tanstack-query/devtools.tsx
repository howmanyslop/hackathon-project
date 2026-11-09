import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";

import type { TanStackDevtoolsReactPlugin } from "@tanstack/react-devtools";

const devtools: TanStackDevtoolsReactPlugin = {
	name: "TanStack Query",
	render: <ReactQueryDevtoolsPanel />,
};

export default devtools;
