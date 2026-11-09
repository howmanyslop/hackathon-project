import handler from "@tanstack/react-start/server-entry";

import { migrateDatabaseAsync } from "$db/migrate";
import { setUpArchiveSearchAsync } from "$search/archive";

const SECURITY_HEADERS = {
	"Referrer-Policy": "strict-origin-when-cross-origin",
	// Plain-http answers ignore this, so it is safe to set everywhere.
	"Strict-Transport-Security": "max-age=31536000; includeSubDomains",
	"X-Content-Type-Options": "nosniff",
	"X-Frame-Options": "DENY",
};

/**
 * The policy every response carries. TanStack Start writes the router's
 * hydration state as inline scripts on each page and has no per-request
 * nonce, so inline script stays allowed; everything else may only come from
 * this origin.
 *
 * @returns The `Content-Security-Policy` header value.
 */
function getContentSecurityPolicy(): string {
	const connect = ["'self'"];
	// Vite's hot reload talks over a WebSocket on the dev server's origin.
	if (import.meta.env.DEV) {
		connect.push("ws:", "wss:");
	}

	return [
		"default-src 'self'",
		"script-src 'self' 'unsafe-inline'",
		"style-src 'self' 'unsafe-inline'",
		"img-src 'self' data: blob:",
		"font-src 'self' data:",
		"worker-src 'self' blob:",
		"media-src 'self' blob:",
		`connect-src ${connect.join(" ")}`,
		"frame-src 'self'",
		"frame-ancestors 'none'",
		"base-uri 'self'",
		"form-action 'self'",
		"object-src 'none'",
	].join("; ");
}

function addSecurityHeaders(response: Response): Response {
	for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
		response.headers.set(name, value);
	}

	response.headers.set("Content-Security-Policy", getContentSecurityPolicy());
	return response;
}

// Starts once, when the server boots. Every request waits for it, `/healthz`
// included, so Kubernetes sends no traffic to a copy whose schema is behind.
// If it fails, Node exits on the unhandled rejection (or requests fail until
// the liveness check gives up), and Kubernetes restarts the pod to retry.
const migration = migrateDatabaseAsync();

/**
 * Search setup runs once the database is migrated, but requests don't wait
 * for it: the app works without Elasticsearch, and a failure here only turns
 * search off until the next restart. Only search errors are caught, so a
 * failed migration still ends the process as described above.
 */
async function setUpSearchAfterMigrationAsync(): Promise<void> {
	await migration;

	try {
		console.info(await setUpArchiveSearchAsync());
	} catch (error) {
		console.error("Search setup failed; searches will fail until the app restarts:", error);
	}
}

// Top-level await would hold up server startup on Elasticsearch.
// oxlint-disable-next-line no-void, unicorn/prefer-top-level-await -- void is fine.
void setUpSearchAfterMigrationAsync();

/**
 * The server's entry: TanStack Start answers every request, and each response
 * leaves with the security headers above. Nitro wraps this in a Node server.
 *
 * @param request - The incoming request.
 * @returns TanStack Start's response, with the headers added.
 */
async function handleFetchAsync(request: Request): Promise<Response> {
	await migration;
	const response = await handler.fetch(request);
	return addSecurityHeaders(response);
}

const server = { fetch: handleFetchAsync };

export default server;
