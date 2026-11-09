/**
 * The on-device speech worker. It owns onnxruntime-web and Moonshine Tiny,
 * both loaded from this app's own origin, and replies with text. Audio never
 * leaves this worker.
 */
import ortWasmUrl from "onnxruntime-web/ort-wasm-simd-threaded.wasm?url";
import { env, InferenceSession, Tensor } from "onnxruntime-web/wasm";

import { fetchModelFilesAsync } from "./fetch-model-files";
import { isMoonshineVocabulary } from "./moonshine-vocabulary";
import { createMoonshineModel } from "./run-moonshine";

import type { MoonshineModel } from "./run-moonshine";
import type { ModelReply, ModelRequest } from "./transcribe-protocol";

let loaded: Promise<MoonshineModel> | undefined;

/** Requests waiting their turn; one runs at a time. */
let queue = Promise.resolve();

function sendReply(reply: ModelReply): void {
	postMessage(reply);
}

async function loadModelAsync(onProgress: (fraction: number) => void): Promise<MoonshineModel> {
	// Single-threaded: the app is not cross-origin isolated.
	env.wasm.numThreads = 1;
	env.wasm.wasmPaths = { wasm: ortWasmUrl };
	const files = await fetchModelFilesAsync(onProgress);
	const options = { executionProviders: ["wasm"] };
	const [encoder, decoder] = await Promise.all([
		InferenceSession.create(files.encoder, options),
		InferenceSession.create(files.decoder, options),
	]);
	const vocabulary = isMoonshineVocabulary.assert(JSON.parse(new TextDecoder().decode(files.vocabulary)));
	return createMoonshineModel({ Tensor }, { decoder, encoder }, vocabulary);
}

async function getModelAsync(id: number): Promise<MoonshineModel> {
	loaded ??= loadModelAsync(function reportProgress(fraction) {
		sendReply({ id, fraction, kind: "progress" });
	});
	return loaded;
}

async function answerAsync(request: ModelRequest): Promise<ModelReply> {
	const { id } = request;
	try {
		if (request.kind === "load") {
			await getModelAsync(id);
			return { id, kind: "ready" };
		}

		const model = await getModelAsync(id);
		const text = await model.transcribeAsync(request.samples);
		return { id, kind: "text", text };
	} catch (error) {
		// Let the next request try loading again.
		loaded = undefined;
		const message = error instanceof Error ? error.message : String(error);
		return { id, kind: "failed", message };
	}
}

addEventListener("message", (event: MessageEvent<ModelRequest>) => {
	queue = queue.then(async () => {
		sendReply(await answerAsync(event.data));
		return undefined;
	});
});
