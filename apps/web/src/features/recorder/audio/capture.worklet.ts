/**
 * Runs on the audio thread. Collects the microphone's mono samples into
 * chunks and posts each one to the main thread by transferring its buffer.
 * Nothing is kept here once a chunk is sent.
 */

/** About 43 ms at 48 kHz: few enough messages, little added delay. */
const CHUNK_SAMPLES = 2048;

/** A disconnected input has no channels, so every level may be missing. */
type ProcessorInputs = ReadonlyArray<ReadonlyArray<Float32Array | undefined> | undefined>;

/** What each message to the main thread holds: mono samples, device rate. */
export type CapturedSamples = Float32Array;

/** What every processor has; the DOM typings do not describe the thread. */
interface ProcessorBase {
	readonly port: MessagePort;
}

// The audio thread's globals.
declare const AudioWorkletProcessor: abstract new () => ProcessorBase;

declare function registerProcessor(name: string, processor: new () => ProcessorBase): void;

class CaptureProcessor extends AudioWorkletProcessor {
	private chunk = new Float32Array(CHUNK_SAMPLES);
	private filled = 0;

	public process(inputs: ProcessorInputs): boolean {
		const channel = inputs[0]?.[0];
		if (channel !== undefined) {
			this.collect(channel);
		}

		return true;
	}

	private collect(channel: Float32Array): void {
		let read = 0;
		while (read < channel.length) {
			const take = Math.min(channel.length - read, CHUNK_SAMPLES - this.filled);
			this.chunk.set(channel.subarray(read, read + take), this.filled);
			this.filled += take;
			read += take;

			if (this.filled === CHUNK_SAMPLES) {
				this.send();
			}
		}
	}

	private send(): void {
		const message: CapturedSamples = this.chunk;
		this.port.postMessage(message, [message.buffer]);
		this.chunk = new Float32Array(CHUNK_SAMPLES);
		this.filled = 0;
	}
}

registerProcessor("recorder-capture", CaptureProcessor);
