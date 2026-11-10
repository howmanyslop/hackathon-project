# Context

The project's domain language. Add a term when the code and conversations start using it, and keep the definitions short.

## Terms

<!-- **Term**: what it means here, and what it does not mean. -->

**Session**: one talk. It is `live` while the presenter records and `ended` after they stop. It is not a login session.

**Segment**: one finished sentence of transcript, with its start and end time in milliseconds from the start of the session. It is text only, never audio.

**Q&A mark**: the moment the presenter tapped "Start Q&A". When a session has no mark, the LLM finds where the Q&A starts.

**Pair**: one audience question and the presenter's answer, lightly tidied by the LLM and anchored to a time in the session. Pairs are derived from segments and get rewritten as a set.

**Archive**: every session, segment, and pair, searchable by meaning. Postgres holds it; Elastic holds a copy for search.
