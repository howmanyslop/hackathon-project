---
status: accepted
---

# 0002. One route outside oRPC for MCP

## Context

Every server call goes through the one oRPC router, which accepts POST only and checks CSRF. We also want AI agents to search the archive over MCP. MCP clients speak JSON-RPC over Streamable HTTP, which the oRPC router doesn't understand.

The app runs as three replicas behind a load balancer with no sticky sessions, so two requests from one client can land on different replicas.

## Decision

`routes/mcp.ts` is the only route outside oRPC. It serves an MCP server built with `tmcp` and its ArkType adapter (`@tmcp/adapter-arktype`), so tool inputs are ArkType types like everywhere else and there is no zod. `@tmcp/transport-http` answers the requests. It has three tools: `search_archive`, `list_sessions`, and `get_session`.

The tools call the same functions as the public oRPC procedures `searchArchive`, `listSessions`, and `getSession`, so both paths return the same data. The endpoint is read-only: nothing that needs the presenter code is exposed.

Any replica can answer any request:

- Clients on the sessionless protocol (MCP 2026-07-28) never get a session.
- Older clients start with `initialize` and send back the session id it returned. A replica that never saw that id still answers, because the tools use nothing from `initialize`.
- The long-lived GET event stream is off and answers 405, which the protocol allows. There are no notifications to send, and a stream would tie a client to one replica.

## Consequences

- An agent connects with `claude mcp add -t http asked <url>/mcp`.
- Reviewers (and Gitar) will see a route outside oRPC. This ADR is the reason.
- POST still goes through the same CSRF check as oRPC (`server/csrf.ts`). MCP clients send no browser headers, so they pass; a page on another site does not.
- No shared session store is needed. If a tool ever needs per-client state, such as notifications or subscriptions, the sessions would have to move to a store all replicas share, like Postgres or Redis.
