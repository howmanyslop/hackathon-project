import process from "node:process";

export async function readStdinAsync(): Promise<string> {
	process.stdin.setEncoding("utf8");
	let input = "";
	for await (const chunk of process.stdin) {
		input += chunk;
	}

	return input;
}
