# web-template

A starting point for web projects: TanStack Start on Cloudflare Workers in a pnpm and Turborepo monorepo, with strict linting, git hooks, and agent setup.

## Start a Project

```sh
cp -R ~/GitHub/web-template ~/GitHub/my-project
cd ~/GitHub/my-project
mise trust && mise install
mise run init my-project      # rename, fresh git history, install, hooks
cp apps/web/.env.example apps/web/.env   # then fill in the Clerk keys
node --run dev
```

`apps/web` is a working app (Clerk, D1 through Drizzle, oRPC, TanStack Query, shadcn on Base UI, Storybook). Rename or delete it, or add another with `turbo gen website`, which asks TanStack's own add-on questions.

`AGENTS.md` describes the commands, the generators, and the conventions.

## Keep the Template Current

`mise run sync` takes the tooling changes from `~/GitHub/voice` since the last sync, shows the diff, and applies it once you confirm. Hunks that no longer fit are left as `.rej` files to merge by hand.
