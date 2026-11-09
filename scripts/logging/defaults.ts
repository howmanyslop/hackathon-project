import type { IPrettyLogStyles } from "tslog";

import type { LogLevel } from "./types";

export const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
	DEBUG: 2,
	ERROR: 5,
	FATAL: 6,
	INFO: 3,
	SILLY: 0,
	TRACE: 1,
	WARN: 4,
} as const satisfies Record<string, number>;

// Each log level gets a visually distinct badge.
// High-urgency levels (ERROR, FATAL, WARN) use background fills so they pop
// in terminal output. INFO and below use foreground-only treatments.
export const PRETTY_LOG_TEMPLATE =
	"{{yyyy}}-{{MM}}-{{dd}} {{hh}}:{{mm}}:{{ss}}  {{logLevelName}}  {{filePathWithLine}}  ";

export const PRETTY_LOG_STYLES: IPrettyLogStyles = {
	name: ["white", "bold"],
	filePathWithLine: ["dim", "cyan"],
	logLevelName: {
		"*": ["bold", "black", "bgWhiteBright", "dim"],
		DEBUG: ["bold", "green"],
		ERROR: ["bold", "bgRed"],
		FATAL: ["bold", "bgRedBright"],
		INFO: ["bold", "blue"],
		SILLY: ["bold", "white"],
		TRACE: ["bold", "whiteBright"],
		WARN: ["bold", "bgYellow"],
	},
};

/** Keys whose values will be masked in log output. */
export const MASKED_KEYS = [
	"password",
	"passwd",
	"secret",
	"token",
	"apiKey",
	"authorization",
	"email",
	"phone",
] as const satisfies ReadonlyArray<string>;
