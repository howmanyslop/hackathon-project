---
status: accepted
---

# 0003. Pairs are rewritten, not appended

## Context

The LLM splits the Q&A part of a session into pairs. It runs when the session ends, and also while a live session's Q&A is under way (after the presenter taps "Start Q&A"), when new segments arrive and the last split is at least 30 seconds old. The app runs as three replicas. If each run appended new pairs, a repeated or overlapping run would create duplicates, and an answer that was still being spoken would stay cut off.

## Decision

Each run re-reads the whole Q&A part (from the Q&A mark, or from the boundary the LLM finds) and replaces that session's pairs in one transaction, then re-indexes them in Elastic.

- The transaction first locks the session's row (`SELECT … FOR UPDATE`), so two runs for one session write one after the other.
- A live re-split is claimed with one `UPDATE` that only matches when the last split is 30 seconds old. Of several replicas, only the one that gets the row back runs it.
- A live run that finishes after the session has ended is thrown away, so the final split owns the pairs.

The hourly "what people are asking" digest is written by an Elastic Workflow into its own index. `getDigest` reads it from there. This is the one place the app reads derived data from Elastic instead of Postgres.

## Consequences

- Splitting is safe to run again. A failed or partial run is fixed by the next one.
- Pair ids and ordinals can change between runs, so links point at a time in the session, not at a pair id.
- Each run pays for the whole Q&A again. Q&A parts are short, so the cost stays small.
- If Elastic is down there is no digest, and the home page leaves it out. Everything else still comes from Postgres.
