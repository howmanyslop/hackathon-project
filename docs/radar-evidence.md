# Radar evidence log

A running record of how we used Radar (UI and MCP) to ship and operate the app, kept for the Radar track. Add entries as they happen, with the date and time. Keep out anything sensitive: node addresses, hostnames, tokens, and emails.

The cluster itself was prepared before the event. See `INFRASTRUCTURE_HANDOFF.md` for what existed at the start. Everything below happened on November 9, 2026 or later.

## Checks: before

Taken at about 12:40 local time, after the first deploy and the high-availability rollout, before any hardening.

Summary: 0 critical, 1 high, 10 medium, 0 low (Security 7, Efficiency 2, Reliability 2).

| Resource | Check | Severity |
| --- | --- | --- |
| StatefulSet `postgres` | privilegeEscalation | high |
| Deployment `web` | automountServiceAccountToken | medium |
| Deployment `web` | readOnlyRootFs | medium |
| Deployment `web` | cpuLimitMissing | medium |
| StatefulSet `postgres` | automountServiceAccountToken | medium |
| StatefulSet `postgres` | runAsRoot | medium |
| StatefulSet `postgres` | readOnlyRootFs | medium |
| StatefulSet `postgres` | livenessProbeMissing | medium |
| StatefulSet `postgres` | cpuLimitMissing | medium |
| Deployment `radar` | automountServiceAccountToken | medium |
| Deployment `radar` | singleReplica | medium |

The two `radar` findings belong to Radar's own installation, which we do not change.

## Timeline

- **Rollout for node-failure tolerance.** The `web` Deployment went from 2 to 3 replicas with a hard per-node spread, a PodDisruptionBudget (`minAvailable: 2`), 15-second eviction tolerations, and `IfNotPresent` pulls. Postgres was pinned to the `control` node, because its volume lives there. Applied through Radar's `apply_resource`.
- **What `get_changes` showed.** The rollout appeared as `replicas: 2→3`, changed tolerations, and a second topology spread constraint. The old soft constraint stayed next to the new hard one, because server-side apply merges that list. The extra constraint is harmless and shows manifest drift.
- **A decision from a code review.** Gitar flagged that a dead node would still count in the spread, so the replacement pod would stay Pending. We added `nodeTaintsPolicy: Honor` before merging.

## Investigations

Add each one here: what we asked, what Radar found, and what we decided.

| Time | Target | Result | Decision |
| --- | --- | --- | --- |
| 2026-11-09, ~13:18 | Pod `local-path-provisioner` in `kube-system` | Started in Radar Hub; the conclusion was not read. | None |
| 2026-11-09, ~13:24 | Deployment `web` in `web` | All-clear, certainty "established", confidence 0.9. Rollout complete, 3 of 3 pods ready. The only warning was three readiness-probe failures at 19:37:22Z (connection refused), which matched the app starting to listen in the same second during the rolling update. No warnings since. | The probe warning needs no change. Its mention of the `automountServiceAccountToken` audit finding led us to harden the pods from Checks (below). |

## Hardening from Checks

Branch `chore/radar-checks-hardening`:

- `web`: no CPU limit becomes 1 CPU; read-only root filesystem with a writable `/tmp`; service account token no longer mounted.
- `postgres`: privilege escalation off; liveness probe; CPU limit; service account token no longer mounted.
- Accepted: `postgres` still runs as root and has a writable root filesystem. The official image starts as root and then drops to the postgres user, and changing that risks the existing volume.

## Checks: after

Taken after the hardening was applied through Radar (pull request 5), about 13:40 local time.

Summary: 0 critical, 0 high, 4 medium, 0 low (was 0 critical, 1 high, 10 medium).

| Resource | Check | Severity | Status |
| --- | --- | --- | --- |
| StatefulSet `postgres` | runAsRoot | medium | Accepted: the official image starts as root and drops privileges itself |
| StatefulSet `postgres` | readOnlyRootFs | medium | Accepted: Postgres needs writable directories |
| Deployment `radar` | automountServiceAccountToken | medium | Radar's own install, not ours |
| Deployment `radar` | singleReplica | medium | Radar's own install, not ours |

All findings on the `web` Deployment are fixed, and so is the high-severity Postgres finding. The `web` rollout with a read-only root filesystem finished with 3 of 3 pods ready.
