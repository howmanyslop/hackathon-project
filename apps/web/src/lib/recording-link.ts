const YOUTUBE_HOSTS = new Set(["m.youtube.com", "www.youtube.com", "youtu.be", "youtube.com"]);

/**
 * Points a recording link at a moment in the video. YouTube reads a `t`
 * search parameter ("41m12s" or "2472s"); other players read a media
 * fragment (`#t=2472`).
 *
 * @param recordingUrl - The session's recording link.
 * @param seconds - Whole seconds into the talk.
 * @returns The link that opens the recording at that second, or the link
 *   unchanged when it cannot be read as a URL.
 */
export function createRecordingLink(recordingUrl: string, seconds: number): string {
	let url: URL;
	try {
		url = new URL(recordingUrl);
	} catch {
		return recordingUrl;
	}

	const wholeSeconds = Math.max(0, Math.floor(seconds));
	if (YOUTUBE_HOSTS.has(url.hostname)) {
		url.searchParams.set("t", `${wholeSeconds}s`);
		return url.toString();
	}

	url.hash = `t=${wholeSeconds}`;
	return url.toString();
}
