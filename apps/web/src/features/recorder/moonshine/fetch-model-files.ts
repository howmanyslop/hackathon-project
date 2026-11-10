/** Where the app serves Moonshine Tiny, from `public/models/moonshine-tiny`. */
const MODEL_FOLDER = "/models/moonshine-tiny/";

/** Each file's name and size, so progress needs no `Content-Length`. */
const MODEL_FILES = {
	decoder: { name: "moonshine-decoder.onnx", bytes: 20_243_286 },
	encoder: { name: "moonshine-encoder.onnx", bytes: 7_937_661 },
	vocabulary: { name: "moonshine-vocab.json", bytes: 307_249 },
} as const;

const TOTAL_BYTES = Object.values(MODEL_FILES).reduce((sum, file) => sum + file.bytes, 0);

/** Moonshine Tiny's three files, downloaded. */
export interface ModelFiles {
	readonly decoder: Uint8Array<ArrayBuffer>;
	readonly encoder: Uint8Array<ArrayBuffer>;
	readonly vocabulary: Uint8Array<ArrayBuffer>;
}

/**
 * Reads a response's body, reporting each chunk's size as it arrives.
 *
 * @param response - A successful response.
 * @param onBytes - Called with the size of each chunk.
 * @returns The body's bytes.
 */
async function readWithProgressAsync(
	response: Response,
	onBytes: (count: number) => void,
): Promise<Uint8Array<ArrayBuffer>> {
	const counter = new TransformStream<Uint8Array, Uint8Array>({
		transform(chunk, controller) {
			onBytes(chunk.byteLength);
			controller.enqueue(chunk);
		},
	});
	const buffer = await new Response(response.body?.pipeThrough(counter)).arrayBuffer();
	return new Uint8Array(buffer);
}

/**
 * Downloads one model file from this app's own origin.
 *
 * @param name - The file's name in the model folder.
 * @param onBytes - Called with the size of each chunk.
 * @returns The file's bytes.
 * @rejects {Error} When the server does not have the file.
 */
async function fetchModelFileAsync(name: string, onBytes: (count: number) => void): Promise<Uint8Array<ArrayBuffer>> {
	const response = await fetch(MODEL_FOLDER + name);
	const contentType = response.headers.get("content-type") ?? "";
	// A missing static file falls through to the app's HTML 404 page.
	if (response.status === 404 || contentType.startsWith("text/html")) {
		throw new Error("The speech model is not installed on this server.");
	}

	if (!response.ok) {
		throw new Error(`The speech model did not download (${response.status}).`);
	}

	return readWithProgressAsync(response, onBytes);
}

/**
 * Downloads Moonshine Tiny's encoder, decoder, and vocabulary at once.
 *
 * @param onProgress - Called with 0 to 1 as the bytes arrive.
 * @returns The three files.
 */
export async function fetchModelFilesAsync(onProgress: (fraction: number) => void): Promise<ModelFiles> {
	let received = 0;

	function countBytes(count: number): void {
		received += count;
		onProgress(Math.min(1, received / TOTAL_BYTES));
	}

	onProgress(0);

	const [decoder, encoder, vocabulary] = await Promise.all([
		fetchModelFileAsync(MODEL_FILES.decoder.name, countBytes),
		fetchModelFileAsync(MODEL_FILES.encoder.name, countBytes),
		fetchModelFileAsync(MODEL_FILES.vocabulary.name, countBytes),
	]);

	return { decoder, encoder, vocabulary };
}
