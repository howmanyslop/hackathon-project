#!/usr/bin/env bash
# Pulls tooling changes from the personal-site repository into this template.
#
# Takes personal's diff since the commit recorded in .sync/personal-commit, limited
# to the tooling paths below, renames its package scope, shows it, and applies
# it after you confirm. Hunks that no longer fit (files this template changed
# on purpose, like ones naming personal's apps) are left as .rej files to merge by
# hand; nothing is overwritten blindly.
#
# Usage: sync-from-personal.sh [personal-directory]   (default: ~/GitHub/voice)
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
personal="${1:-${PERSONAL_DIR:-${HOME}/GitHub/voice}}"
marker="${root}/.sync/personal-commit"

if [[ ! -d "${personal}/.git" ]]; then
	printf 'No git repository at %s. Pass the personal directory as the first argument.\n' "${personal}" >&2
	exit 1
fi

since="$(< "${marker}")"
head="$(git -C "${personal}" rev-parse HEAD)"
if [[ "${since}" == "${head}" ]]; then
	printf 'Already synced to %s.\n' "${head}"
	exit 0
fi

paths=(
	.agents/skills .claude .config .editorconfig .github .gitignore .harper-dictionary.txt .mcp.json
	.opencode .oxfmtrc.json .pi .rumdl.toml .schemas .sql-formatter.json .sqlfluff .vale .vale.ini
	.vscode .zed benchmarks biome.jsonc codebook.toml commitlint.config.ts doctor.config.ts
	eslint.config.ts fallow.toml hk.pkl mise.toml opencode.jsonc oxlint.config.ts package.json patches
	pnpm-workspace.yaml scripts skills-lock.json tombi.toml tools tsconfig.base.json tsconfig.json
	tsconfig.node.json tsconfig.web.json turbo turbo.json vite.config.ts
	packages/arktype-utilities packages/codex-utilities packages/english-utilities
	packages/file-utilities packages/fs-utilities
	':!scripts/start-paper-mcp.sh'
)

patch="$(mktemp)"
trap 'rm -f "${patch}"' EXIT

git -C "${personal}" diff --binary "${since}" "${head}" -- "${paths[@]}" \
	| sed -e 's|@howmanysmall/personal-site|web-template|g' -e 's|@howmanysmall/|@web-template/|g' > "${patch}"

if [[ ! -s "${patch}" ]]; then
	printf 'No tooling changes in personal since %s.\n' "${since}"
	printf '%s\n' "${head}" > "${marker}"
	exit 0
fi

git -C "${personal}" diff --stat "${since}" "${head}" -- "${paths[@]}"
printf '\nFull diff: %s\n' "${patch}"
${PAGER:-less} "${patch}" || true

read -r -p "Apply these changes? [y/N] " answer
if [[ "${answer}" != [yY]* ]]; then
	printf 'Nothing applied.\n'
	exit 0
fi

if git -C "${root}" apply --reject --whitespace=nowarn "${patch}"; then
	printf 'Applied cleanly.\n'
else
	printf '\nSome hunks did not fit. Merge these by hand, then delete them:\n'
	fd --hidden --no-ignore --extension rej . "${root}" || true
fi

printf '%s\n' "${head}" > "${marker}"
printf 'Recorded personal %s in .sync/personal-commit. Review with git diff, then run the checks.\n' "${head}"
