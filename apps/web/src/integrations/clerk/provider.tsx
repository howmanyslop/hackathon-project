import { ClerkProvider } from "@clerk/tanstack-react-start";

import type { PropsWithChildren, ReactNode } from "react";

export function AppClerkProvider({ children }: Readonly<PropsWithChildren>): ReactNode {
	return <ClerkProvider>{children}</ClerkProvider>;
}
