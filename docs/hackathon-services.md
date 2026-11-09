# How the Hackathon Services Fit In

A plain-language explanation, for presenting the project. The README has the setup steps.

## The Short Version

- **Radar** lets people and AI agents see what's running in our Kubernetes cluster.
- **Elastic** lets you search todos by meaning, not just by matching words.
- **Dash0** shows what the app is doing: every request, every log line, and how much memory and CPU it uses.
- **Gitar** reviews every pull request.

## Radar

Our app runs on a Kubernetes cluster: four machines that run copies of the app and its database. Radar has a small agent inside the cluster (the `radar` namespace) that reports what's running to <https://app.radarhq.io>.

We also connected Radar to our coding agents over MCP, a standard way to give an AI agent tools. An agent can ask Radar "why is this pod crashing?" instead of us copying `kubectl` output into a chat.

## Elastic: Search by Meaning

Normal search matches words: "milk" only finds todos that contain "milk". Semantic search matches meaning, so "milk" also finds "pick up groceries".

How it works:

1. **Embeddings.** A Jina model (`jina-embeddings-v3`) turns text into a list of numbers that describes what the text means. Texts with similar meanings get similar numbers.
2. **Adding a todo.** The app saves the todo in Postgres, then sends a copy to Elasticsearch. Elasticsearch asks Jina for the todo's numbers and stores them next to the text.
3. **Searching.** Jina turns the search text into numbers too, and Elasticsearch returns the todos whose numbers are closest.

Jina runs on Elastic's own servers (the Elastic Inference Service), so we don't host any AI model ourselves.

Design choices to mention:

- **Postgres is the source of truth.** Elasticsearch only holds a copy for searching. If Elastic is down, adding todos still works; only search fails.
- **Search is optional.** Without Elastic keys, the app runs normally and search says it isn't set up.
- **Setup is automatic.** When the app starts, it creates the Jina endpoint and the search index if they're missing, and copies existing todos into a new index.
- **Keys stay secret.** The keys live in `.env` on laptops and in a Kubernetes Secret in the cluster, never in the code or the public container image.

Code: `apps/web/src/search/` and the `searchTodos` procedure in `apps/web/src/orpc/router/todos.ts`.

## Dash0: Seeing What the App Does

Dash0 collects three kinds of data, all in the OpenTelemetry format:

- **Traces**: one record per request, with how long each step took.
- **Logs**: everything the app prints.
- **Metrics**: CPU, memory, restarts, and similar numbers for each pod.

We didn't add any tracing code to the app. The Dash0 operator, a program running in the cluster, adds OpenTelemetry to the app's containers as they start. `k8s/dash0/monitoring.yaml` tells it to watch only our `web` namespace, so it leaves other teams' work alone.

## Gitar

Gitar reviews every pull request on GitHub. `.gitar/review/project.md` tells it what this project cares about that linters can't check, like "never put secrets in the code" and "Postgres stays the source of truth".

## Likely Questions

- **Why keep Postgres if we have Elasticsearch?** Postgres guarantees our data is saved correctly. Elasticsearch is built for search, not for being the only copy.
- **What if Elastic and Postgres disagree?** Postgres wins. The search index can be deleted and rebuilt from Postgres: the app copies everything into a new index when it starts.
- **Why an operator instead of tracing code?** The operator gives us traces, logs, and cluster metrics without changing the app, and installing or removing it is one command.
