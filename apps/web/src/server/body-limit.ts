/**
 * The largest real call, a batch of 100 segments, is a few hundred KB.
 */
const MAX_BODY_BYTES = 1_000_000;

/**
 * Decides whether a request's body must be refused before it is read. Only
 * POST carries a body here. A POST has to say how long its body is: a
 * chunked body has no length to check, so it is refused too.
 *
 * @param request - The incoming request.
 * @returns True when the body is over 1 MB, or its length is not stated.
 */
export function isBodyTooLarge(request: Request): boolean {
	if (request.method !== "POST") return false;

	const announced = request.headers.get("content-length");
	if (announced === null) return true;

	const length = Number(announced);
	return !Number.isFinite(length) || length > MAX_BODY_BYTES;
}
