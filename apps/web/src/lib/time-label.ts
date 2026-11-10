const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;

function padTwo(value: number): string {
	return String(value).padStart(2, "0");
}

/**
 * Writes a time into a talk the way people read it: "41:12", or "1:02:05"
 * past the first hour. Fractions of a second are dropped, and negative or
 * missing times read as "0:00".
 *
 * @param milliseconds - Time since the talk started.
 * @returns The label, m:ss or h:mm:ss.
 */
export function formatTimeLabel(milliseconds: number): string {
	const totalSeconds = Number.isFinite(milliseconds)
		? Math.max(0, Math.floor(milliseconds / MILLISECONDS_PER_SECOND))
		: 0;
	const hours = Math.floor(totalSeconds / SECONDS_PER_HOUR);
	const minutes = Math.floor((totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
	const seconds = totalSeconds % SECONDS_PER_MINUTE;

	if (hours > 0) return `${hours}:${padTwo(minutes)}:${padTwo(seconds)}`;
	return `${minutes}:${padTwo(seconds)}`;
}

/**
 * Whole seconds into the talk, for `?t=` links.
 *
 * @param milliseconds - Time since the talk started.
 * @returns Whole seconds, never negative.
 */
export function toWholeSeconds(milliseconds: number): number {
	return Math.max(0, Math.floor(milliseconds / MILLISECONDS_PER_SECOND));
}
