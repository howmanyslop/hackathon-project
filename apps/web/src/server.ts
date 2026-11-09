import handler from "@tanstack/react-start/server-entry";

/**
 * Clerk's frontend API and script hosts. The development instance lives under
 * `clerk.accounts.dev`; add the production instance's own domain (like
 * `https://clerk.example.com`) before going live.
 */
const CLERK_ORIGINS = ["https://*.clerk.accounts.dev"] as const;

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
 * this origin or Clerk.
 *
 * @returns The `Content-Security-Policy` header value.
 */
function getContentSecurityPolicy(): string {
	const connect = ["'self'", ...CLERK_ORIGINS, "https://api.clerk.com"];
	// Vite's hot reload talks over a WebSocket on the dev server's origin.
	if (import.meta.env.DEV) {
		connect.push("ws:", "wss:");
	}

	return [
		"default-src 'self'",
		`script-src 'self' 'unsafe-inline' ${CLERK_ORIGINS.join(" ")} https://challenges.cloudflare.com`,
		"style-src 'self' 'unsafe-inline'",
		"img-src 'self' data: blob: https://img.clerk.com https://*.clerk.accounts.dev",
		"font-src 'self' data:",
		"worker-src 'self' blob:",
		"media-src 'self' blob:",
		`connect-src ${connect.join(" ")}`,
		`frame-src 'self' https://challenges.cloudflare.com ${CLERK_ORIGINS.join(" ")}`,
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

/**
 * The Worker's entry: TanStack Start answers every request, and each response
 * leaves with the security headers below. Add a `scheduled` handler here when
 * `cloudflare.config.ts` gets a cron trigger.
 *
 * @param request - The incoming request.
 * @returns TanStack Start's response, with the headers added.
 */
async function handleFetchAsync(request: Request): Promise<Response> {
	const response = await handler.fetch(request);
	return addSecurityHeaders(response);
}

const worker = { fetch: handleFetchAsync };

export default worker;
