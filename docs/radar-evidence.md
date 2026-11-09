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
| 2026-11-09, ~13:18 | Pod `local-path-provisioner` in `kube-system` | Pending. Started in Radar Hub. | Pending |

## Hardening from Checks

Branch `chore/radar-checks-hardening`:

- `web`: no CPU limit becomes 1 CPU; read-only root filesystem with a writable `/tmp`; service account token no longer mounted.
- `postgres`: privilege escalation off; liveness probe; CPU limit; service account token no longer mounted.
- Accepted: `postgres` still runs as root and has a writable root filesystem. The official image starts as root and then drops to the postgres user, and changing that risks the existing volume.

## Checks: after

Run Checks again after the hardening is deployed and paste the new summary here.
