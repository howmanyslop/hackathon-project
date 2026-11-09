import { createFileRoute } from "@tanstack/react-router";

function handleHealthCheck(): Response {
	return new Response("ok", {
		headers: { "Cache-Control": "no-store", "Content-Type": "text/plain" },
	});
}

// Kubernetes calls this to decide whether a pod is alive and ready for
// traffic. It stays cheap on purpose: no database, no rendering.
export const Route = createFileRoute("/healthz")({
	server: {
		handlers: {
			GET: handleHealthCheck,
		},
	},
});
