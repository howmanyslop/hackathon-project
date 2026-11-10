# How the Hackathon Services Fit In

A plain-language explanation, for presenting the project. The README has the setup steps, and `docs/demo-script.md` has the spoken demo.

## The Short Version

- **Radar** is the cluster we run on, and it lets people and AI agents see what's running in it.
- **Elastic** searches the archive by meaning, answers questions through an agent, and writes the hourly "what people are asking" note.
- **Dash0** shows what the app is doing: every request, every log line, and how much memory and CPU it uses.
- **Gitar** reviews every pull request.

## Radar

Our app runs on a Kubernetes cluster: four machines that run copies of the app, its database, and the tunnel that gives it a public HTTPS address. Radar has a small agent inside the cluster (the `radar` namespace) that reports what's running to <https://app.radarhq.io>.

We also connected Radar to our coding agents over MCP, a standard way to give an AI agent tools. An agent can ask Radar "why is this pod crashing?" instead of us copying `kubectl` output into a chat.

## Elastic

Elastic does three jobs for us.

### Search by Meaning

Normal search matches words. Semantic search matches meaning, so "what happens when a server dies" also finds "what happens to the traces if the node running the collector dies".

1. **Embeddings.** A Jina model (`.jina-embeddings-v5-text-small`, preconfigured in our Elastic project) turns text into a list of numbers that describes what it means. Texts with similar meanings get similar numbers.
2. **Indexing.** The app saves each segment and pair in Postgres, then sends a copy to one Elastic index (`asked-archive`). Its `content` field is a `semantic_text` field, so Elastic calls Jina and stores the numbers itself.
3. **Searching.** Elastic embeds the search text the same way and returns the closest pairs and passages, up to six of each. A pair needs a score of 0.63 and a passage 0.66, so an unrelated question like "where can I park" finds nothing while a reworded real question still finds its answer.

Jina runs on Elastic's own servers, so we don't host any model ourselves.

### The Ask Box: Agent Builder

The Ask box on the home page sends the question to an Agent Builder agent (`asked-and-answered`). The agent has three tools of our own, defined in `elastic/tools/`: one finds answered questions, one finds talk passages, and one counts questions per session. It answers in a few sentences and the app links the sessions it used. `mise run elastic:setup` creates the agent and its tools from the JSON files in `elastic/`.

Each question costs money, so the app keeps a log of them in Postgres. It allows 10 questions a minute across all three copies of the app, and stops at a $15 budget (`ASK_BUDGET_USD`). With the digest's cap below (at most 50 paid runs, about $5), Elastic's agent costs at most $20 in all. The cost of each question comes from the token usage the agent reports, priced high on purpose. Search keeps working when the Ask box stops.

### The Digest: Workflows

An Elastic Workflow runs every hour. It reads the newest pairs, asks our agent for the common themes, and writes a short note into a small index (`asked-digest`). The home page shows that note. To cap spending, a run skips the agent when no pair is newer than the note, and the workflow stops calling the agent for good after 50 paid runs (the `paidRuns` counter on the note; at most $5). This is the one place the app reads something from Elastic that isn't in Postgres.

### Design Choices to Mention

- **Postgres is the source of truth.** Elastic holds a copy for searching. If Elastic is down, recording still works; only search, Ask, and the digest stop.
- **The split uses an LLM.** The app asks Elastic's managed LLM first and OpenRouter (`anthropic/claude-haiku-5.5`) if that fails. Elastic's LLM answers 403 for our project today, so OpenRouter does the split.
- **Keys stay secret.** They live in `.env` on laptops and in Kubernetes Secrets in the cluster, never in the code or the public container image.

Code: `apps/web/src/search/`, `apps/web/src/agent/`, `apps/web/src/llm/`, and `elastic/`.

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
- **What if Elastic and Postgres disagree?** Postgres wins. The archive index can be deleted and rebuilt from Postgres.
- **Why an operator instead of tracing code?** The operator gives us traces, logs, and cluster metrics without changing the app, and installing or removing it is one command.
- **Why no audio?** The presenter's phone browser does the speech-to-text. Our server only receives text. See `docs/adr/0001-server-receives-text-only.md`.
