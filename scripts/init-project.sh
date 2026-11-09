#!/usr/bin/env bash
# Turns a copy of web-template into a new project: renames the `web-template`
# package scope, asks whether to keep the agent setup, starts a fresh git
# history, installs dependencies, and removes the template-only tooling
# (this script, the personal sync, and their mise tasks).
#
# Usage: init-project.sh <name> [--agents | --no-agents]
set -euo pipefail

name="${1:-}"
agents="${2:-}"
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${root}"

if [[ ! "${name}" =~ ^[a-z][a-z0-9]*(-[a-z0-9]+)*$ ]]; then
	printf 'Usage: mise run init <name>   (kebab-case, like hack-day)\n' >&2
	exit 1
fi

if [[ "${name}" == "web-template" ]]; then
	printf 'Pick a name other than web-template.\n' >&2
	exit 1
fi

if [[ -z "${agents}" ]]; then
	read -r -p "Keep the agent setup (AGENTS.md, .claude, .opencode, MCP config, skills)? [Y/n] " answer
	if [[ "${answer}" == [nN]* ]]; then agents="--no-agents"; else agents="--agents"; fi
fi

# 1. Rename the scope and the root package everywhere except generated files.
rg --hidden --files-with-matches --fixed-strings 'web-template' \
	--glob '!.git' --glob '!node_modules' --glob '!pnpm-lock.yaml' --glob '!.sync' \
	--glob '!scripts/init-project.sh' --glob '!scripts/sync-from-personal.sh' \
	| while IFS= read -r file; do
		perl -pi -e "s/web-template/${name}/g" "${file}"
	done

# 2. Drop the agent setup when asked.
if [[ "${agents}" == "--no-agents" ]]; then
	rm -rf AGENTS.md CLAUDE.md CONTEXT.md .agents .claude .opencode .pi .mcp.json opencode.jsonc \
		skills-lock.json docs/agents docs/adr
	perl -ni -e 'print unless m{^  - \.(claude|opencode)(/packages/plugins/\*)?$}' pnpm-workspace.yaml
	perl -ni -e 'print unless m{"path": "\./\.opencode"}' tsconfig.json
fi

# 3. Remove the template-only tooling.
rm -rf .sync scripts/sync-from-personal.sh scripts/init-project.sh
perl -0pi -e 's/\n\[tasks\.init\]\n.*?(?=\n\[tasks|\z)//s; s/\n\[tasks\.sync\]\n.*?(?=\n\[tasks|\z)//s' mise.toml

# 4. Fresh history, dependencies, hooks.
rm -rf .git node_modules
git init --quiet --initial-branch main
pnpm install
hk install --mise

printf '\nDone. Fill in .env from .env.example, then: node --run dev\n'
