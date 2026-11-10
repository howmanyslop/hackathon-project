// oxlint-disable-next-line import/default -- Vite gives "?worker&url" imports a default export: the built URL.
import captureWorkletUrl from "./capture.worklet.ts?worker&url";
import { MicrophoneError, openMicrophoneAsync } from "./microphone";
import { createResampler } from "./resampler";

import type { CapturedSamples } from "./capture.worklet";

/** The rate the speech model listens at. */
const MODEL_SAMPLE_RATE = 16_000;

/** Receives the next 16 kHz mono samples, in order. */
export type SamplesListener = (samples: Float32Array) => void;

/** A running microphone capture. */
export interface AudioCapture {
	/** Turns the microphone off. Safe to call more than once. */
	readonly stop: () => void;
}

const AUDIO_FAILED = "The phone's audio could not start. Reload the page, then start again.";

function ignoreCloseFailure(): void {
	// Closing an already-closed context is harmless.
}

/**
 * Opens the microphone and hands over its sound as 16 kHz mono samples until
 * stopped. An AudioWorklet collects the samples at the device's rate; this
 * thread resamples them. Nothing is saved or sent anywhere.
 *
 * @param onSamples - Receives the samples as they arrive.
 * @returns A handle whose `stop` turns the microphone off. It also stops
 *   when the page goes away.
 * @rejects {MicrophoneError} When the microphone or the audio cannot start.
 */
export async function startCaptureAsync(onSamples: SamplesListener): Promise<AudioCapture> {
	const stream = await openMicrophoneAsync();
	const context = new AudioContext();
	let isStopped = false;

	function stop(): void {
		if (isStopped) return;
		isStopped = true;
		window.removeEventListener("pagehide", stop);

		for (const track of stream.getTracks()) {
			track.stop();
		}

		context.close().catch(ignoreCloseFailure);
	}

	// Release the microphone when the page goes away, including into bfcache.
	window.addEventListener("pagehide", stop);

	try {
		// iOS Safari starts contexts suspended even inside a tap.
		await context.resume();
		await context.audioWorklet.addModule(captureWorkletUrl);
	} catch (error) {
		stop();
		throw new MicrophoneError(AUDIO_FAILED, { cause: error });
	}

	const resampler = createResampler(context.sampleRate, MODEL_SAMPLE_RATE);
	const capture = new AudioWorkletNode(context, "recorder-capture", { numberOfInputs: 1, numberOfOutputs: 0 });
	capture.port.addEventListener("message", function takeSamples(event: MessageEvent<CapturedSamples>) {
		if (isStopped) return;
		onSamples(resampler.process(event.data));
	});
	capture.port.start();
	context.createMediaStreamSource(stream).connect(capture);

	return { stop };
}
