// The recorder keeps the code under the same key, so a presenter types it
// once per tab.
const PRESENTER_CODE_KEY = "asked-presenter-code";

/**
 * Reads the presenter code this tab remembers.
 *
 * @returns The code, or "" when there is none or storage is blocked.
 */
export function readStoredPresenterCode(): string {
	try {
		return sessionStorage.getItem(PRESENTER_CODE_KEY) ?? "";
	} catch {
		return "";
	}
}

/**
 * Remembers the presenter code until the tab closes.
 *
 * @param code - The code the presenter typed.
 */
export function storePresenterCode(code: string): void {
	try {
		sessionStorage.setItem(PRESENTER_CODE_KEY, code);
	} catch {
		// Private mode: the code is simply typed again next time.
	}
}
