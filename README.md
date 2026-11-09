# web-template

A starting point for web projects: TanStack Start on Node, deployed to a Kubernetes cluster, in a pnpm and Turborepo monorepo with strict linting, git hooks, and agent setup.

## Start a Project

```sh
cp -R ~/GitHub/web-template ~/GitHub/my-project
cd ~/GitHub/my-project
mise trust && mise install
mise run init my-project      # rename, fresh git history, install, hooks
node --run dev
```

`apps/web` is a working app (Postgres through Drizzle, oRPC, TanStack Query, shadcn on Base UI, Storybook). `apps/web/README.md` covers running it locally. `turbo gen website` adds another app, though its templates still target Cloudflare Workers.

`AGENTS.md` describes the commands, the generators, and the conventions.

## Deploy to the Cluster

The app runs on the team's Kubernetes cluster, reached over Tailscale. You don't need to know Kubernetes to ship it.

### Set Up Once

1. Join the tailnet.
2. Get the cluster login file (a "kubeconfig") from whoever runs the cluster. Save it as `~/.kube/hackathon.yaml`, then run `chmod 600 ~/.kube/hackathon.yaml`. It's an admin login, so never commit it or paste it anywhere public.
3. Install Docker:
   - macOS: [OrbStack](https://orbstack.dev).
   - Arch: `sudo pacman -S docker docker-buildx`, `sudo systemctl enable --now docker`, `sudo usermod -aG docker "$USER"`, then log out and back in.
4. Let Docker push images: `gh auth refresh -h github.com -s write:packages`, then `gh auth token | docker login ghcr.io -u <your-github-user> --password-stdin`.
5. Check it all works: `kubectl get nodes` lists the cluster's machines as `Ready`.

### Ship It

```sh
mise run k8s:deploy
```

This builds the app into a container image, scans it for secrets, pushes it to `ghcr.io`, and tells the cluster to run it. It takes about 20 seconds once the build is cached, and ends by printing the app's address. Database migrations run on their own when the app starts.

### Other Tasks

| Command                | What It Does                                                                  |
| ---------------------- | ----------------------------------------------------------------------------- |
| `mise run k8s:status`  | Shows what's running and on which machine.                                    |
| `mise run k8s:logs`    | Follows the app's logs. Ctrl+C stops following; the app keeps running.        |
| `mise run k8s:db`      | Connects `localhost:5432` to the cluster's database, for `db:studio`.         |
| `mise run k8s:down`    | Deletes the app and its database from the cluster, after asking.              |

### Words You'll See

- **Image**: the app packed with everything it needs to run. Built by `docker`, stored on `ghcr.io`.
- **Pod**: one running copy of the app. There are two, on different machines, so one can crash without taking the site down.
- **Namespace**: a folder in the cluster. Everything here lives in `web`, apart from other teams' work.
- **Secret**: where the database password lives. It's made inside the cluster on the first deploy and never written to this repository.

### Keep Secrets Out

The images on `ghcr.io` are public, and so is this repository. Never put a password or token in source code, and never in a `VITE_*` variable: Vite copies those into the browser code. `k8s:deploy` refuses to push an image that contains a known secret format or a Tailscale address, but it can't catch everything.

### When Something Breaks

- `kubectl` says "connection refused" or times out: Tailscale is off, or `~/.kube/hackathon.yaml` is missing.
- `k8s:deploy` says the cluster can't download the image: the `ghcr.io` package went private. Make it public again in its GitHub package settings.
- The site shows "no available server": the app pods aren't ready. `mise run k8s:status` and `mise run k8s:logs` show why.

## Keep the Template Current

`mise run sync` takes the tooling changes from `~/GitHub/voice` since the last sync, shows the diff, and applies it once you confirm. Hunks that no longer fit are left as `.rej` files to merge by hand.
