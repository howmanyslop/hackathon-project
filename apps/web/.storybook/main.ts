import nodePath from "node:path";
import { fileURLToPath } from "node:url";

import type { StorybookConfig } from "@storybook/tanstack-react";

/**
 * Resolves a package's folder; Storybook needs absolute paths inside a
 * monorepo.
 *
 * @param value - The package name.
 * @returns The package's directory.
 */
function getAbsolutePath(value: string): string {
	return nodePath.dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)));
}

const configuration: StorybookConfig = {
	addons: [
		getAbsolutePath("@chromatic-com/storybook"),
		getAbsolutePath("@storybook/addon-vitest"),
		getAbsolutePath("@storybook/addon-a11y"),
		getAbsolutePath("@storybook/addon-docs"),
		getAbsolutePath("@storybook/addon-mcp"),
	],
	framework: getAbsolutePath("@storybook/tanstack-react"),
	stories: ["../src/**/*.mdx", "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
};

export default configuration;
