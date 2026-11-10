import { decodeTokens } from "./decode-tokens";

import type { InferenceSession, Tensor } from "onnxruntime-web";

/** The part of onnxruntime-web's exports this needs. */
export interface TensorConstructor {
	readonly Tensor: typeof Tensor;
}

/** Moonshine, loaded and ready. */
export interface MoonshineModel {
	/** Turns 16 kHz mono audio into the words in it. */
	readonly transcribeAsync: (samples: Float32Array<ArrayBuffer>) => Promise<string>;
}

/** The two loaded halves of Moonshine Tiny. */
export interface MoonshineSessions {
	/** `decoder_model_merged`: one token per step, with a key-value cache. */
	readonly decoder: Pick<InferenceSession, "run">;
	/** `encoder_model`: raw 16 kHz audio in, hidden states out. */
	readonly encoder: Pick<InferenceSession, "run">;
}

/** Moonshine Tiny's shape, from its `config.json`. */
const DECODER_LAYERS = 6;
const ATTENTION_HEADS = 8;
const HEAD_SIZE = 36;

/** `decoder_start_token_id` and `eos_token_id`. */
const START_TOKEN = 1;
const END_TOKEN = 2;

/**
 * A ceiling on tokens per second of audio, well above English speech, so a
 * model stuck repeating itself still stops.
 */
const MAX_TOKENS_PER_SECOND = 6.5;
const MIN_TOKENS = 8;
const SAMPLE_RATE = 16_000;

function getPastNames(): Array<string> {
	const names = new Array<string>();
	for (let layer = 0; layer < DECODER_LAYERS; layer += 1) {
		for (const part of ["decoder", "encoder"]) {
			for (const kind of ["key", "value"]) {
				names.push(`past_key_values.${layer}.${part}.${kind}`);
			}
		}
	}

	return names;
}

const PAST_NAMES = getPastNames();

/**
 * Picks the most likely next token.
 *
 * @param logits - The decoder's scores over the vocabulary.
 * @returns The token id with the highest score.
 */
function pickToken(logits: Tensor): number {
	const scores = logits.data;
	// `instanceof` fails across realms (workers, tests), so check the shape.
	if (!ArrayBuffer.isView(scores)) {
		throw new TypeError("Moonshine returned unexpected logits");
	}

	let best = 0;
	let bestScore = Number.NEGATIVE_INFINITY;
	for (const [index, score] of scores.entries()) {
		const value = Number(score);
		if (value <= bestScore) continue;
		best = index;
		bestScore = value;
	}

	return best;
}

/**
 * Wraps loaded Moonshine sessions as a transcriber: encode the audio once,
 * then decode greedily, one token at a time, reusing the key-value cache.
 *
 * @param ort - The `Tensor` class from onnxruntime-web.
 * @param sessions - The loaded encoder and decoder.
 * @param vocabulary - Each id's piece, `""` for special tokens.
 * @returns The model, as a transcriber.
 */
export function createMoonshineModel(
	ort: TensorConstructor,
	sessions: MoonshineSessions,
	vocabulary: ReadonlyArray<string>,
): MoonshineModel {
	async function transcribeAsync(samples: Float32Array<ArrayBuffer>): Promise<string> {
		if (samples.length === 0) return "";

		const encoded = await sessions.encoder.run({
			input_values: new ort.Tensor("float32", samples, [1, samples.length]),
		});
		const hidden = encoded.last_hidden_state;

		const empty = new ort.Tensor("float32", new Float32Array(0), [1, ATTENTION_HEADS, 0, HEAD_SIZE]);
		// The decoder's key-value cache, by input name.
		let past = new Map<string, Tensor>(PAST_NAMES.map((name) => [name, empty]));
		const maxTokens = Math.max(MIN_TOKENS, Math.ceil((samples.length / SAMPLE_RATE) * MAX_TOKENS_PER_SECOND));
		const tokens = new Array<number>();
		let last = START_TOKEN;

		for (let step = 0; step < maxTokens; step += 1) {
			const inputIds = BigInt64Array.of(BigInt(last));
			// oxlint-disable-next-line eslint/no-await-in-loop -- Each token depends on the one before it.
			const outputs = await sessions.decoder.run({
				...Object.fromEntries(past),
				encoder_hidden_states: hidden,
				input_ids: new ort.Tensor("int64", inputIds, [1, 1]),
				use_cache_branch: new ort.Tensor("bool", [step > 0], [1]),
			});

			last = pickToken(outputs.logits);
			if (last === END_TOKEN) break;
			tokens.push(last);

			// The encoder's keys and values come out of the first step only;
			// later steps add to the decoder's.
			const previous = past;
			past = new Map(
				PAST_NAMES.map(function nextValue(name) {
					const isFixed = step > 0 && name.includes(".encoder.");
					const value = isFixed ? previous.get(name) : outputs[name.replace("past_key_values", "present")];
					if (value === undefined) {
						throw new TypeError(`Moonshine returned no ${name}`);
					}

					return [name, value] as const;
				}),
			);
		}

		return decodeTokens(vocabulary, tokens);
	}

	return { transcribeAsync };
}
