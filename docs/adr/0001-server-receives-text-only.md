---
status: accepted
---

# 0001. The server only receives text

## Context

Talks are recorded on the presenter's phone. Sending audio to our server would mean storing recordings of people, paying for speech-to-text, and asking attendees to trust us with their voices. Phone browsers already ship a speech recognizer (the Web Speech API).

## Decision

Speech-to-text runs in the phone's browser, through its built-in recognizer. That recognizer may send the audio to the browser maker's speech service (Chrome uses Google's servers, and Safari may use Apple's), but our server never sees it. The recorder sends finished sentences as segments, in small batches every few seconds. The server never receives or stores audio or video. Browsers without a recognizer download a small model (Moonshine Tiny, 27 MB) from our server and run it on the phone, so with that fallback the audio never leaves the device at all.

## Consequences

- There is no audio playback in the app. A search result jumps to the transcript passage (`/sessions/12?t=2472`).
- A session may carry an optional recording URL, for a video hosted elsewhere, which opens at the same second.
- Transcript quality depends on the phone's recognizer. We can't re-run recognition later.
- Privacy is easier to explain: only text is stored, and the recorder says the talk is being transcribed.
