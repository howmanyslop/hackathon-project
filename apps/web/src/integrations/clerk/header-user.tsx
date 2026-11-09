import { Show, SignInButton, UserButton } from "@clerk/tanstack-react-start";

import type { ReactNode } from "react";

export function HeaderUser(): ReactNode {
	return (
		<>
			<Show when="signed-in">
				<UserButton />
			</Show>
			<Show when="signed-out">
				<SignInButton />
			</Show>
		</>
	);
}
