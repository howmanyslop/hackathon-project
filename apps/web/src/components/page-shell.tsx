import { Link, Outlet } from "@tanstack/react-router";

import type { ReactNode } from "react";

const ACTIVE_LINK = { className: "nav-link is-active" } as const;

/**
 * The bands every page shares: the header with the wordmark and nav, the
 * current page, and the footnote band.
 *
 * @returns The shell with the current page inside.
 */
export function PageShell(): ReactNode {
	return (
		<>
			<header className="site-header">
				<Link className="wordmark" to="/">
					{"Asked & Answered"}
				</Link>
				<nav aria-label="Main" className="site-nav">
					<Link activeOptions={{ exact: true }} activeProps={ACTIVE_LINK} className="nav-link" to="/">
						{"Archive"}
					</Link>
					<Link activeProps={ACTIVE_LINK} className="nav-link" to="/sessions">
						{"Sessions"}
					</Link>
					<Link activeProps={ACTIVE_LINK} className="nav-link" to="/questions">
						{"Questions"}
					</Link>
					<Link activeProps={ACTIVE_LINK} className="nav-link" to="/record">
						{"Record"}
					</Link>
				</nav>
			</header>
			<Outlet />
			<footer className="footnote-band">
				<span className="footnote-label">{"How this works"}</span>
				<span>
					{
						"The presenter's phone browser turns the talk into text as they speak. Only the text reaches this site, and no audio or video is stored."
					}
				</span>
			</footer>
		</>
	);
}
