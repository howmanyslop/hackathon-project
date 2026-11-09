/**
 * Keeps the phone's screen on while a talk is recorded, where the browser
 * allows it. Safari grants the first request only inside a tap, so `acquire`
 * must run synchronously in the Start handler. The browser drops the lock when
 * the page is hidden, so it is asked for again when the page comes back. A
 * refused lock means only that the screen may sleep.
 */
export interface ScreenWakeLock {
	/** Requests the lock. Call it synchronously inside the Start handler. */
	readonly acquire: () => void;
	/** Releases the lock and stops asking again. Safe to call at any time. */
	readonly release: () => void;
}

function isSupported(): boolean {
	return typeof navigator !== "undefined" && "wakeLock" in navigator;
}

function ignore(): void {
	// A refused or failed lock is the same as no lock.
}

/**
 * Creates a wake lock for one recording. It touches no browser API until
 * `acquire`, so it is safe to create during server rendering.
 *
 * @returns The lock's controls.
 */
export function createScreenWakeLock(): ScreenWakeLock {
	let isWanted = false;
	let isRequesting = false;
	let sentinel: undefined | WakeLockSentinel;

	async function requestLockAsync(): Promise<void> {
		isRequesting = true;
		try {
			const granted = await navigator.wakeLock.request("screen");
			// Stopped before the browser answered: give it straight back.
			if (isWanted) {
				sentinel = granted;
			} else {
				await granted.release();
			}
		} finally {
			isRequesting = false;
		}
	}

	function isHeld(): boolean {
		return sentinel !== undefined && !sentinel.released;
	}

	function requestLock(): void {
		if (isWanted && !isRequesting && document.visibilityState === "visible" && !isHeld()) {
			requestLockAsync().catch(ignore);
		}
	}

	function release(): void {
		if (!isWanted) return;
		isWanted = false;
		document.removeEventListener("visibilitychange", requestLock);
		const held = sentinel;
		sentinel = undefined;

		if (held !== undefined && !held.released) {
			held.release().catch(ignore);
		}
	}

	function acquire(): void {
		if (isWanted || !isSupported()) return;
		isWanted = true;
		document.addEventListener("visibilitychange", requestLock);
		requestLock();
	}

	return { acquire, release };
}
