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

- **Dash0 operator install (about 14:30 local).** A teammate installed the Dash0 operator with Helm. The operator instrumented every workload in the `web` namespace, which deleted `postgres-0` and rolled all three `web` pods. Radar's Issues page showed five critical findings and one warning within minutes: the Postgres StatefulSet and Service with no ready pods, and the Dash0 collector pods unavailable. The new pods sat in `Init` for about 2.5 minutes while pulling `ghcr.io/dash0hq/instrumentation` over the slow venue uplink. The `web` pods kept serving throughout, because the PodDisruptionBudget and the rolling update kept at least two ready. Everything recovered without intervention; Postgres was back within about 5 minutes. The injected init container is compatible with the read-only root filesystem, because it brings its own writable volume.
- **What stayed.** One warning remained: the `dash0-operator-metrics` Service has no endpoints (see Investigations).
- **What we learned.** The operator restarts every workload in the namespace, including the database, which only the Node app needs instrumented. Scoping the monitoring resource to `web` workloads, or excluding Postgres, would avoid a database restart next time.

## Investigations

Add each one here: what we asked, what Radar found, and what we decided.

| Time | Target | Result | Decision |
| --- | --- | --- | --- |
| 2026-11-09, ~13:18 | Pod `local-path-provisioner` in `kube-system` | Started in Radar Hub; the conclusion was not read. | None |
| 2026-11-09, ~13:24 | Deployment `web` in `web` | All-clear, certainty "established", confidence 0.9. Rollout complete, 3 of 3 pods ready. The only warning was three readiness-probe failures at 19:37:22Z (connection refused), which matched the app starting to listen in the same second during the rolling update. No warnings since. | The probe warning needs no change. Its mention of the `automountServiceAccountToken` audit finding led us to harden the pods from Checks (below). |
| 2026-11-09, ~14:33 | Deployment `dash0-operator-cluster-metrics-collector-deployment`, DaemonSet `dash0-operator-opentelemetry-collector-agent-daemonset`, Service `dash0-operator-opentelemetry-collector-service` | Transient. A slow image pull delayed the rollout (Deployment, established); the DaemonSet's 4 pods were mid-startup and a follow-up wait confirmed all 4 ready (established); the Service had no ready backends only while those pods started (likely). | None needed; it cleared by itself. |
| 2026-11-09, ~14:33 and ~15:16 | Service `dash0-operator-metrics` in `dash0-system` | Likely defect in the Dash0 chart (0.159.0). The Service targets a port named `https` that no container exposes. The operator pod only exposes `webhook-server` on 9443, and its metrics listener is bound to loopback. Two separate runs reached the same conclusion. No consumer of the Service was found. | Accepted as harmless and left unchanged; see below. |


### Decision on the `dash0-operator-metrics` warning

We did not change it. Repointing the Service's `targetPort` would only hide the warning, because the metrics listener is loopback-only, so connections would be refused. The real fix is a Helm values change and an `helm upgrade`, which restarts the operator, and the last restart took the database down. The Service is owned by the Helm chart, so a hand edit would also be overwritten by the next upgrade. Radar's tools have no dismiss option, so dismissal happens in the Radar UI. The reason for dismissing it there:

> Known upstream issue in the Dash0 operator Helm chart (dash0-operator 0.159.0). The Service dash0-operator-metrics targets a named port "https" that no pod exposes. The operator's metrics listener is bound to loopback only, so the chart expects a proxy sidecar that isn't deployed. Nothing in the cluster scrapes or depends on this Service, and the operator itself is healthy and ready. Investigated with Radar (hosted AI investigation, certainty: likely). Accepted as harmless.

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
