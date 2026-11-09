#!/usr/bin/env bash
# Runs the given command unless HACKATHON is set to a non-empty value other
# than 0. hk wraps the slow pre-push steps with it; secret scanning never is.
set -euo pipefail

if [[ -n "${HACKATHON:-}" && "${HACKATHON}" != "0" ]]; then
	printf 'HACKATHON=%s: skipping %s\n' "${HACKATHON}" "$*" >&2
	exit 0
fi

exec "$@"
