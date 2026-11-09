import { Logger } from "tslog";

import { LOG_LEVEL_ORDER, MASKED_KEYS, PRETTY_LOG_STYLES, PRETTY_LOG_TEMPLATE } from "./defaults";

import type { ILogObj } from "tslog";

const rootLogger = new Logger<ILogObj>({
	mask: {
		caseInsensitive: true,
		keys: [...MASKED_KEYS],
	},
	minLevel: LOG_LEVEL_ORDER.INFO,
	pretty: {
		levelMethod: {
			"*": console.log,
			ERROR: console.error,
			FATAL: console.error,
			INFO: console.info,
			WARN: console.warn,
		},
		style: true,
		styles: PRETTY_LOG_STYLES,
		template: PRETTY_LOG_TEMPLATE,
		timeZone: "local",
	},
	type: "pretty",
});

export function createLogger(name: string): Logger<ILogObj> {
	return rootLogger.getSubLogger({ name });
}
