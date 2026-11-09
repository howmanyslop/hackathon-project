export function isBodyTooLarge(request: Request): boolean {
	if (request.body === null) return false;

	const announced = request.headers.get("content-length");
	// A chunked body has no length to check, so it is refused.
	if (announced === null) return true;

	const length = Number(announced);
	return !Number.isFinite(length) || length > 1_000_000;
}
