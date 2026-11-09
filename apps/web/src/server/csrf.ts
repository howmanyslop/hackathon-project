/** Methods that cannot change state, so they need no same-origin check. */
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * The host the request was sent to: the `Host` header, or the URL's host when
 * there is none. The `Origin` header is never used for this, because a
 * non-browser client can set it to anything.
 *
 * @param request - The incoming request.
 * @returns The host name and port, lowercased.
 */
function getRequestHost(request: Request): string {
	const host = request.headers.get("host")?.trim();
	return (host === undefined || host.length === 0 ? new URL(request.url).host : host).toLowerCase();
}

/**
 * The host an `Origin` header names, or `undefined` when it is not a web
 * origin at all, such as the opaque `null` origin.
 *
 * @param origin - The `Origin` header's value.
 * @returns The host name and port, lowercased by the URL parser.
 */
function getOriginHost(origin: string): string | undefined {
	try {
		const url = new URL(origin);
		return url.protocol === "https:" || url.protocol === "http:" ? url.host : undefined;
	} catch {
		return undefined;
	}
}

/**
 * Whether a request may change state. Browsers mark their requests, and this
 * compares the marks against the host the request was sent to, so a page on
 * another site cannot post here with a borrowed cookie.
 *
 * The scheme is not compared. The app sits behind a Cloudflare Tunnel that
 * ends HTTPS, so the browser sends `Origin: https://host` while the app sees
 * the request arrive over `http://`. The host and port still have to match,
 * and a page on another host cannot choose which host its request goes to.
 *
 * A request is allowed when:
 * - it is a safe method, or
 * - the browser sent `Sec-Fetch-Site: cross-site` (refused outright), or
 * - `Origin` names this same host and port, or
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
	if (origin !== null) return getOriginHost(origin) === getRequestHost(request);

	// A browser that sends no Origin still says where it came from. Only
	// same-origin and direct navigations may change state; `same-site` covers
	// sibling subdomains, which are not this origin.
	if (site !== undefined && site.length > 0) return site === "same-origin" || site === "none";

	// No browser marks at all: a script or other non-browser client. Session
	// cookies still apply, and browsers do not send them cross-site.
	return true;
}
