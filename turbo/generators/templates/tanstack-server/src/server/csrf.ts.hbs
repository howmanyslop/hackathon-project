/** Methods that cannot change state, so they need no same-origin check. */
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * The request's own origin, taken from its URL rather than from the `Origin`
 * header, which a non-browser client can set to anything.
 *
 * @param request - The incoming request.
 * @returns The scheme, host and port of the URL the request arrived on.
 */
function getRequestOrigin(request: Request): string {
	const url = new URL(request.url);
	return `${url.protocol}//${url.host}`;
}

/**
 * Whether a request may change state. Browsers mark their requests, and this
 * compares the marks against the origin the request actually arrived on, so a
 * page on another site cannot post here with a borrowed cookie.
 *
 * A request is allowed when:
 * - it is a safe method, or
 * - the browser sent `Sec-Fetch-Site: cross-site` (refused outright), or
 * - `Origin` names this same origin, or
 * - `Origin` is absent and `Sec-Fetch-Site` is `same-origin` or `none`, or
 * - both headers are absent, as with a non-browser client.
 *
 * @param request - The incoming request.
 * @returns `true` when the request is safe to handle.
 */
export function isCsrfSafeRequest(request: Request): boolean {
	if (SAFE_METHODS.has(request.method.toUpperCase())) return true;

	const site = request.headers.get("sec-fetch-site")?.trim().toLowerCase();
	if (site === "cross-site") return false;

	const origin = request.headers.get("origin");
	if (origin !== null) {
		const claimed = origin.endsWith("/") ? origin.slice(0, -1) : origin;
		return claimed === getRequestOrigin(request);
	}

	// A browser that sends no Origin still says where it came from. Only
	// same-origin and direct navigations may change state; `same-site` covers
	// sibling subdomains, which are not this origin.
	if (site !== undefined && site.length > 0) return site === "same-origin" || site === "none";

	// No browser marks at all: a script or other non-browser client. Session
	// cookies still apply, and browsers do not send them cross-site.
	return true;
}
