/** A microphone that would not open, with a sentence for the presenter. */
export class MicrophoneError extends Error {
	public override readonly name = "MicrophoneError";
}

const REFUSED = "This browser was not allowed to use the microphone. Allow it in the site settings, then start again.";
const MISSING = "This phone has no microphone the browser can use.";
const UNKNOWN = "The microphone could not be opened. Close other apps that use it, then start again.";
const UNSUPPORTED = "This page needs a secure connection (https) to use the microphone.";

/** How each `getUserMedia` failure reads to the presenter. */
const MESSAGES: ReadonlyMap<string, string> = new Map([
	["NotAllowedError", REFUSED],
	["NotFoundError", MISSING],
	["OverconstrainedError", MISSING],
	["SecurityError", REFUSED],
]);

/**
 * A talk is given in a room, not a studio, so the browser's echo and noise
 * processing stay on.
 */
const ROOM_VOICE: MediaTrackConstraints = {
	autoGainControl: true,
	channelCount: 1,
	echoCancellation: true,
	noiseSuppression: true,
};

/**
 * Opens the default microphone for a talk.
 *
 * @returns The live stream. The caller must stop its tracks.
 * @rejects {MicrophoneError} When the microphone is missing or refused.
 */
export async function openMicrophoneAsync(): Promise<MediaStream> {
	// Absent on insecure origins, whatever the DOM types claim.
	if (!("mediaDevices" in navigator)) {
		throw new MicrophoneError(UNSUPPORTED);
	}

	try {
		return await navigator.mediaDevices.getUserMedia({ audio: ROOM_VOICE });
	} catch (error) {
		const message = error instanceof DOMException ? MESSAGES.get(error.name) : undefined;
		throw new MicrophoneError(message ?? UNKNOWN, { cause: error });
	}
}
