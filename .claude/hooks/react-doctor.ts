import { env, file, spawnSync, stdin, stdout, which, write } from "bun";

const SPAWN_MAX_BUFFER_BYTES = 16 * 1024 * 1024;
const EDIT_TOOL_NAMES = new Set(["ApplyPatch", "Edit", "MultiEdit", "NotebookEdit", "Write"]);
const REACT_DOCTOR_ARGUMENTS = ["--verbose", "--scope", "changed", "--blocking", "warning", "--no-score"];

type HookInput = Record<string, unknown>;
type ScanResult = Readonly<{ output: string; status: number }>;

function isRecord(value: unknown): value is HookInput {
	return typeof value === "object" && value !== null;
}

async function readInputAsync(): Promise<HookInput> {
	try {
		const parsed = JSON.parse(await stdin.text());
		return isRecord(parsed) ? parsed : {};
	} catch {
		return {};
	}
}

function firstString(input: HookInput, keys: ReadonlyArray<string>): string | undefined {
	for (const key of keys) {
		const value = input[key];
		if (typeof value === "string") return value;
	}
	return undefined;
}

function eventName(input: HookInput): string | undefined {
	return firstString(input, ["hook_event_name", "eventName", "event_name"]);
}

function isEditCall(value: unknown): boolean {
	return isRecord(value) && typeof value.tool_name === "string" && EDIT_TOOL_NAMES.has(value.tool_name);
}

function shouldScan(input: HookInput): boolean {
	if (eventName(input) === "PostToolBatch") {
		return Array.isArray(input.tool_calls) && input.tool_calls.some(isEditCall);
	}
	const toolName = firstString(input, ["tool_name", "toolName", "tool"]);
	return toolName === undefined || EDIT_TOOL_NAMES.has(toolName);
}

async function resolveReactDoctorAsync(projectRoot: string): Promise<string | undefined> {
	const localBinary = `${projectRoot}/node_modules/.bin/react-doctor`;
	if (await file(localBinary).exists()) return localBinary;
	return which("react-doctor") ?? undefined;
}

async function runReactDoctorAsync(projectRoot: string): Promise<ScanResult> {
	const executable = await resolveReactDoctorAsync(projectRoot);
	if (executable === undefined) return { output: "", status: 0 };

	const result = spawnSync({
		cmd: [executable, ...REACT_DOCTOR_ARGUMENTS],
		cwd: projectRoot,
		maxBuffer: SPAWN_MAX_BUFFER_BYTES,
		stderr: "pipe",
		stdout: "pipe",
	});
	const decoder = new TextDecoder();
	return {
		output: `${decoder.decode(result.stdout)}${decoder.decode(result.stderr)}`.trim(),
		status: result.exitCode,
	};
}

function formatOutput(input: HookInput, message: string): string {
	if (eventName(input) !== "PostToolBatch") return JSON.stringify({ additional_context: message });
	return JSON.stringify({
		hookSpecificOutput: {
			additionalContext: message,
			hookEventName: "PostToolBatch",
		},
	});
}

async function mainAsync(): Promise<void> {
	const input = await readInputAsync();
	if (!shouldScan(input)) return;

	const projectRoot = env.CLAUDE_PROJECT_DIR ?? `${import.meta.dirname}/../..`;
	const scan = await runReactDoctorAsync(projectRoot);
	if (scan.status === 0 || scan.output.length === 0) return;

	const guidance =
		"React Doctor found issues in the changed files. Review this output and fix the regressions before finishing. For confirmed issues that cannot be fixed now, create GitHub issues with the rule, file/line, confidence, impact, and proposed fix.";
	const message = `${guidance}\n\n${scan.output}`;
	await write(stdout, `${formatOutput(input, message)}\n`);
}

await mainAsync();
