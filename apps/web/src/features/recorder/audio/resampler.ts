/**
 * A streaming band-limited resampler: Kaiser-windowed sinc interpolation at
 * any ratio, so 44.1 kHz and 48 kHz microphones both reach the speech
 * model's 16 kHz without aliasing. Naive decimation would fold everything
 * above 8 kHz back into the band the model listens to.
 */
export interface Resampler {
	/**
	 * Output sample `k` describes the same moment as input time
	 * `k / outputRate`; it is only produced once enough input has arrived.
	 *
	 * @param input - The next samples at the input rate, in order.
	 * @returns Every output sample that can now be computed, in order.
	 */
	readonly process: (input: Float32Array) => Float32Array;
}

/** Zero crossings of the sinc on each side, at the lower of the two rates. */
const HALF_ZERO_CROSSINGS = 16;

/** Kaiser beta: about 80 dB of stopband attenuation. */
const KAISER_BETA = 8;

/**
 * Where the low-pass sits, as a share of the lower Nyquist frequency: the
 * pass band runs nearly to 8 kHz at 16 kHz output.
 */
const CUTOFF = 0.94;

/** How finely the fractional position between input samples is tabulated. */
const PHASES = 256;

/**
 * The zeroth-order modified Bessel function of the first kind, by its series.
 *
 * @param x - Where to evaluate it.
 * @returns I0(x).
 */
function getBesselI0(x: number): number {
	let sum = 1;
	let term = 1;
	for (let order = 1; order < 64; order += 1) {
		term *= (x / (2 * order)) ** 2;
		sum += term;
		if (term < sum * 1e-12) break;
	}

	return sum;
}

function getSinc(x: number): number {
	if (x === 0) return 1;
	const angle = Math.PI * x;
	return Math.sin(angle) / angle;
}

/**
 * Tabulates the filter. Row `p` holds the taps for an output that sits `p /
 * PHASES` of a sample past an input sample; there is one extra row so phase
 * interpolation never runs off the end.
 *
 * @param reach - Taps on each side.
 * @param cutoff - The low-pass corner, as a share of the input rate's Nyquist.
 * @returns `PHASES + 1` rows of `2 * reach` taps, flattened.
 */
function tabulate(reach: number, cutoff: number): Float64Array {
	const width = 2 * reach;
	const table = new Float64Array((PHASES + 1) * width);
	const normalizer = getBesselI0(KAISER_BETA);
	for (let phase = 0; phase <= PHASES; phase += 1) {
		const fraction = phase / PHASES;
		for (let tap = 0; tap < width; tap += 1) {
			// Tap `tap` reads input `floor(at) - reach + 1 + tap`.
			const offset = fraction + reach - 1 - tap;
			const ratio = offset / (reach + 1);
			const window =
				Math.abs(ratio) < 1 ? getBesselI0(KAISER_BETA * Math.sqrt(1 - ratio * ratio)) / normalizer : 0;

			table[phase * width + tap] = cutoff * getSinc(cutoff * offset) * window;
		}
	}

	return table;
}

/**
 * Creates a resampler from one rate to another.
 *
 * @param inputRate - Samples per second coming in.
 * @param outputRate - Samples per second going out.
 * @returns The resampler. Keep it for the whole stream; it holds history.
 */
export function createResampler(inputRate: number, outputRate: number): Resampler {
	const step = inputRate / outputRate;
	// When going down, the filter is narrowed to the output's Nyquist frequency.
	const scale = Math.min(1, outputRate / inputRate);
	const reach = Math.ceil(HALF_ZERO_CROSSINGS / scale);
	const width = 2 * reach;
	const table = tabulate(reach, CUTOFF * scale);

	let history = new Float32Array(0);
	/** Input index of `history[0]`. */
	let historyStart = 0;
	/** Next output position, in input samples. */
	let position = 0;

	function sampleAt(at: number): number {
		const base = Math.floor(at);
		const exactPhase = (at - base) * PHASES;
		const phase = Math.floor(exactPhase);
		const blend = exactPhase - phase;
		const first = base - reach + 1 - historyStart;
		let sum = 0;
		for (let tap = 0; tap < width; tap += 1) {
			const index = first + tap;
			const value = index < 0 ? 0 : history[index];
			const low = table[phase * width + tap];
			const high = table[(phase + 1) * width + tap];
			sum += value * (low + (high - low) * blend);
		}

		return sum;
	}

	function process(input: Float32Array): Float32Array {
		const joined = new Float32Array(history.length + input.length);
		joined.set(history);
		joined.set(input, history.length);
		history = joined;

		const available = historyStart + history.length;
		const output = new Array<number>();
		// Each output needs `reach` input samples after it.
		while (Math.floor(position) + reach < available) {
			output.push(sampleAt(position));
			position += step;
		}

		// Keep only what the next outputs can still reach back to.
		const keepFrom = Math.max(historyStart, Math.floor(position) - reach + 1);
		history = history.slice(keepFrom - historyStart);
		historyStart = keepFrom;
		return Float32Array.from(output);
	}

	return { process };
}
