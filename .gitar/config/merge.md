# Auto-Merge Criteria

Arm auto-merge only when every condition below holds. Otherwise leave the
approval in place and let a person merge.

- The change is low or medium risk.
- It doesn't touch the database: no files in `apps/web/drizzle/` and no change
  to `apps/web/src/db/schema.ts`.
- It doesn't touch the server's security boundary: `apps/web/src/server.ts`,
  `apps/web/src/server/`, or `apps/web/src/routes/api.rpc.$.ts`.
- It doesn't touch deployment: `k8s/` or `apps/web/Dockerfile`.
- It doesn't change what checks or automates the repository: `.github/`,
  `.gitar/`, `.claude/`, `.opencode/`, `hk.pkl`, or `mise.toml`.
