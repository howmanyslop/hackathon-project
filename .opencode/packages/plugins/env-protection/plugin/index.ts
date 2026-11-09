import { Plugin } from "@opencode/plugin/effect";
import { Tool } from "@opencode/schema/tool";
import { Effect } from "effect";

import { isFilePathInput } from "./opencode-types";

import type { Scope } from "effect";

const environmentProtection = Plugin.define({
	id: "env-protection",
	effect(context): Effect.Effect<void, never, Scope.Scope> {
		return Effect.gen(function* runEnvironmentProtection() {
			yield* context.tool.hook("execute.before", (event) => {
				if (event.tool !== "read") return Effect.void;

				const { input } = event;
				if (isFilePathInput.allows(input) && input.filePath.includes(".env")) {
					return Effect.fail(Tool.Error.make({ message: "Do not read .env files" }));
				}

				return Effect.void;
			});
		});
	},
});

export default environmentProtection;
