# Demo script

The video has to be three minutes or less. This script is about 385 spoken words, which is 2:45 at a normal pace, and its last beat ends at 2:50. Each beat lists what is on screen and what to say. Record the screen and the voice separately if that is easier; the cuts between beats hide typing and waiting.

Before recording: open the home page, `/record` on a phone, and a terminal with Claude Code connected to `/mcp`. Delete any rehearsal session that never got "Stop and save" (its page has a Delete control that takes the presenter code); otherwise it stays "Live now" forever.

## The problem (0:00 to 0:15)

On screen: the home page.

Every conference talk ends with questions. The answers are often the best part, and they are gone the moment the talk ends. Nobody writes them down, and at the next talk someone asks the same thing again. Asked & Answered keeps them.

## Recording on a phone (0:15 to 0:40)

On screen: the phone, on `/record`. Start, speak a sentence, tap "Start Q&A".

A presenter opens the record page on their phone, enters the presenter code and a title, and taps Start. Then they just talk. The phone's browser turns speech into text, and only text reaches our server. When the audience starts asking, they tap "Start Q&A". If they forget, the app finds where the questions begin on its own.

## Live in the archive (0:40 to 0:55)

On screen: the session page on the laptop, filling in. Then the pairs after Stop.

Here is the session page on a laptop. The talk is still running, and its sentences are already here, a few seconds behind. On Stop, an LLM splits the Q&A into questions and answers, each tied to its moment in the talk.

## Was this already asked? (0:55 to 1:25)

On screen: the home page. Search "what happens when a machine goes down", then click the first result.

Now an attendee wonders: was my question already asked? We search for "what happens when a machine goes down". The archive finds it in two different talks, asked in different words: one about traffic when a node dies, one about traces when the collector's node dies. One click jumps to that exact passage.

## Ask the archive (1:25 to 1:45)

On screen: the Ask box. Type "What did speakers say about cost?" and show the answer and its links.

Or just ask. We type "What did speakers say about cost?" An agent answers in a few sentences, naming each talk and the minute it was said, with links to check.

## An agent using the archive (1:45 to 2:00)

On screen: the terminal. Ask Claude Code which talks covered node failures.

AI agents can search too. Here Claude Code is connected to our MCP endpoint with one command. We ask which talks covered node failures, and it answers from the archive with sessions and timestamps.

## Questions for presenters (2:00 to 2:12)

On screen: the Questions page, after entering the presenter code.

And it loops back. Presenters open Questions and see what people typed, with no names attached, and which questions nobody has answered yet. Those are the ones to cover on stage.

## What each sponsor does for us (2:12 to 2:40)

On screen: Radar's view of the cluster, then the Elastic agent, then a Gitar review, then Dash0.

It all runs on our own four-machine Kubernetes cluster, and Radar shows us what is running in it. Elastic does the search by meaning with Jina embeddings, runs the Agent Builder agent and its tools behind the Ask box, and a Workflow writes the hourly note on what people are asking. Gitar reviews every pull request. Dash0 collects traces and logs through its operator, with no tracing code in the app.

## What stays private (2:40 to 2:50)

On screen: the home page, with the footnote band in view.

No audio or video ever reaches us; we store only text. That is Asked & Answered: every question kept, and one search away. Thank you.

## If something breaks

- The phone shows no microphone prompt: the page must be on HTTPS. Use the public address, not the cluster's plain HTTP one.
- Speech recognition stops: tap Stop, then start a new session. Segments already sent are kept.
- Search returns nothing: Elastic may be unreachable. Show a seeded session page instead; Postgres still has everything.
- The Ask box errors, or says it is busy or has used its budget: skip that beat and go straight to the MCP demo.
- No pairs after Stop: the split runs once, while Stop saves the session, and the saved screen shows how many pairs it found. If it found none, `mise run k8s:logs` says why; show a seeded session instead.

## Likely questions

- **Why no audio?** We don't want to store people's voices, and the phone already turns speech into text.
- **How does the split work?** An LLM reads the Q&A part of the transcript and returns questions and answers, each linked to the exact passage.
- **What if the presenter forgets the button?** The LLM finds where the Q&A starts from the transcript.
- **How do agents connect?** They add our MCP endpoint, for example `claude mcp add -t http asked <url>/mcp`, and get three read-only tools.
