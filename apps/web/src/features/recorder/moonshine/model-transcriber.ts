import type { ModelReply, ModelRequest } from "./transcribe-protocol";

/** Moonshine Tiny, running in a worker on this device. */
export interface ModelTranscriber {
	readonly dispose: () => void;
	/** Downloads and prepares the model; reports 0..1 while it loads. */
	readonly loadAsync: (onProgress: (fraction: number) => void) => Promise<void>;
	/** Turns 16 kHz mono samples into text; "" when nothing was said. */
	readonly transcribeAsync: (samples: Float32Array) => Promise<string>;
}

interface Pending {
	readonly onProgress?: (fraction: number) => void;
	readonly reject: (error: Error) => void;
	readonly resolve: (text: string) => void;
}

/**
 * The model engine's transcriber: Moonshine Tiny in a worker. The worker
 * starts on the first call and answers requests in order. If it crashes,
 * waiting requests reject and the next call starts a fresh worker.
 *
 * @returns A transcriber backed by that worker.
 */
export function createModelTranscriber(): ModelTranscriber {
	let worker: undefined | Worker;
	let nextId = 0;
	const pending = new Map<number, Pending>();

	function failAll(error: Error): void {
		for (const waiting of pending.values()) {
			waiting.reject(error);
		}

		pending.clear();
	}

	function handleReply(reply: ModelReply): void {
		const waiting = pending.get(reply.id);
		if (reply.kind === "progress") {
			waiting?.onProgress?.(reply.fraction);
			return;
		}

		pending.delete(reply.id);

		if (reply.kind === "failed") {
			waiting?.reject(new Error(reply.message));
		} else {
			waiting?.resolve(reply.kind === "text" ? reply.text : "");
		}
	}

	function getWorker(): Worker {
		if (worker !== undefined) return worker;
		// oxlint-disable-next-line unicorn/relative-url-style -- Vite only bundles workers from "./" paths.
		const started = new Worker(new URL("./transcribe.worker.ts", import.meta.url), { type: "module" });
		started.addEventListener("message", (event: MessageEvent<ModelReply>) => {
			handleReply(event.data);
		});
		started.addEventListener("error", (event) => {
			failAll(new Error(event.message, { cause: event.error }));
			started.terminate();
			worker = undefined;
		});
		worker = started;
		return started;
	}

	async function sendAsync(
		request: ModelRequest,
		transfer: Array<Transferable>,
		onProgress?: (fraction: number) => void,
	): Promise<string> {
		return new Promise<string>((resolve, reject) => {
			pending.set(request.id, { onProgress, reject, resolve });
			getWorker().postMessage(request, transfer);
		});
	}

	function takeId(): number {
		const id = nextId;
		nextId += 1;
		return id;
	}

	async function loadAsync(onProgress: (fraction: number) => void): Promise<void> {
		await sendAsync({ id: takeId(), kind: "load" }, [], onProgress);
	}

	async function transcribeAsync(samples: Float32Array): Promise<string> {
		// A copy, so the caller's buffer is not detached by the transfer.
		const copy = new Float32Array(samples);
		return sendAsync({ id: takeId(), kind: "transcribe", samples: copy }, [copy.buffer]);
	}

	function dispose(): void {
		worker?.terminate();
		worker = undefined;
		failAll(new Error("The speech model was closed."));
	}

	return { dispose, loadAsync, transcribeAsync };
}
