# Demo script

The video has to be three minutes or less. This script has 399 spoken words, which is about 2:50 at a normal pace, and its last beat ends at 2:55. It shows everything the site can do: the table under "What the site can do" lists each capability and the beat that shows it.

Each beat lists what is on screen and what to say. Record the screen and the voice separately if that is easier; the cuts between beats hide typing and waiting.

## Everything you need

- **The site**: <https://asked.howmanysmall.com>. Use this address everywhere. The microphone only works on HTTPS.
- **A phone** with Safari on iPhone or Chrome on Android, open on `https://asked.howmanysmall.com/record`.
- **The presenter code**. Run this from the repository, so mise points `kubectl` at the cluster. Don't show the code on screen.

  ```sh
  kubectl -n web get secret web-presenter -o jsonpath='{.data.code}' | base64 -d
  ```

- **A terminal with Claude Code** connected to the archive:

  ```sh

  ```

- **Browser tabs on the laptop**, in this order:
  1. The home page.
  2. `/sessions`.
  3. One sample session, for example "Surviving a node failure on a small k3s cluster".
  4. `/questions`.
  5. `/record?engine=model`, for the on-device model shot.
  6. Radar's view of the cluster.
  7. Elastic: the Agent Builder agent `asked-and-answered`, and the workflow `asked-themes-digest`.
  8. The Gitar review on <https://github.com/howmanyslop/hackathon-project/pull/13>.
  9. Dash0, on the `web` namespace's traces or logs.
- **A link to a video**, any address that starts with `https://`, to type into "Recording link (optional)". It makes "Open the recording at …" appear on the session page.
- **Screen recording with CleanShot X**. This opens the recording picker:

  ```sh
  open 'cleanshot://record-screen'
  ```

  Then click "Record in Studio Mode" by hand. CleanShot's URL scheme cannot start Studio Mode.
- **The phone on screen**. Connect the iPhone by cable, open QuickTime Player, choose File, then New Movie Recording, and pick the iPhone as the camera. You keep using the phone by hand, and its screen shows on the laptop. iPhone Mirroring also shows the screen, but it is untested with the microphone. On Android, `scrcpy` does the same.

## Before you record

- [ ] Rehearse once on the phone: start a recording, say two sentences, tap "Start Q&A", ask and answer one question out loud, tap "Stop and save". Check that the phone says "Saved." and how many questions it found.
- [ ] Rehearse the model shot: open `/record?engine=model` on the laptop, start a recording, and wait for "Getting the speech model ready" to finish. The first time, it downloads about 28 MB. If words don't appear, leave beat 4 out of the video.
- [ ] Delete every rehearsal session. Open its page, choose "Delete this session", enter the presenter code, and choose "Delete for good". A session that never got "Stop and save" stays "Live now" forever otherwise.
- [ ] Check the home page: 16 questions answered, 4 sessions, 0 live now, plus anything you chose to keep.
- [ ] Try both searches and the Ask question from the beats below, so the answers are fresh in your mind.
- [ ] Choose light or dark mode on purpose. The site follows the system setting, and beat 10 switches it once.
- [ ] Close notifications, and hide the bookmarks bar and anything with a name or address you don't want shown.
- [ ] Keep the presenter code out of the frame. Its field hides what you type.

## What the site can do, and where the video shows it

| What it can do                                                                        | Beat  |
| ------------------------------------------------------------------------------------- | ----- |
| Record a talk on a phone, with the browser's own speech-to-text                       | 2     |
| Send only text to the server; no audio or video is stored                             | 2, 10 |
| Mark where the questions begin with "Start Q&A"                                       | 2     |
| Find where the questions begin when the presenter forgets                             | 2     |
| Keep an optional link to the talk's video, and open it at the right minute            | 2, 3  |
| List every session, with "Live now" on the ones still recording                       | 3     |
| Show a live session's sentences a few seconds after they are said                     | 3     |
| Split the Q&A into questions and answers with an LLM on "Stop and save"               | 3     |
| Show one session: timeline strip, questions and answers, and the full transcript      | 3     |
| Run a small speech model on the device where the browser has no speech-to-text        | 4     |
| Search by meaning: answered questions first, then passages from the talks             | 5     |
| Jump from a result to the exact sentence (`/sessions/<id>?t=<seconds>`)               | 5     |
| Show the nearest questions when nothing matches closely                               | 5     |
| Answer a question in its own words, with links to the talks it quotes                 | 6     |
| Limit asking to ten questions a minute and $15 in total                               | 6     |
| Write an hourly note on what people are asking                                        | 6     |
| Let AI agents search through MCP: `search_archive`, `list_sessions`, `get_session`    | 7     |
| Show presenters what people typed, with no names, and what is still unanswered        | 8     |
| Delete a session with the presenter code                                              | 8     |
| Work on a phone and in light and dark mode                                            | 2, 10 |

## The beats

### 1. The problem (0:00 to 0:12)

On screen: the home page, with the big count of questions answered.

Every conference talk ends with questions. The answers are often the best part, and they are gone the moment the talk ends. Asked & Answered keeps them.

### 2. Recording on a phone (0:12 to 0:36)

On screen: the phone, on Record. Fill in "Presenter code", "Talk title", "Speaker", and "Recording link (optional)". Tap "Start recording", speak a sentence, then tap "Start Q&A".

A presenter opens Record on their phone, enters the presenter code and a title, and taps Start recording. Then they just talk. The phone's browser turns speech into text, and only text reaches our server. When the audience starts asking, they tap Start Q&A. If they forget, the app finds where the questions begin.

### 3. Live in the archive (0:36 to 0:57)

On screen: the laptop, on Sessions, with "Live now" next to the new talk. Open it and let the transcript fill in. On the phone, tap "Stop and save" and show "Saved." Back on the laptop, show the timeline strip, "Questions and answers", and "Open the recording at …".

On a laptop, the session is already listed live, and its sentences arrive a few seconds behind. On Stop and save, an LLM splits the Q&A into questions and answers, each marked on the talk's timeline and linked to its moment in the transcript and the video.

### 4. Without built-in speech-to-text (0:57 to 1:07)

On screen: the laptop tab on `/record?engine=model`, recording. Show "Getting the speech model ready", then the note that begins "This browser has no built-in speech recognition".

Some browsers can't turn speech into text. There, the page runs a small speech model on the device, so the audio never leaves it.

### 5. Was this already asked? (1:07 to 1:30)

On screen: the home page. Type "what happens when a server goes down" and press "Search". Show "Asked and answered" and "From the talks". Click "Read it at …" on the first result, and show the marked sentence. Go back and search "best pizza toppings in naples".

An attendee wonders: was my question already asked? We search for what happens when a server goes down. The archive finds it in two talks, asked in different words, plus passages from the talks themselves. One click jumps to the exact sentence. When nothing matches closely, it shows the nearest questions instead.

### 6. Ask the archive (1:30 to 1:49)

On screen: "Ask the archive". Type "What did speakers say about cost?" and press "Ask". Show the answer and its links, then scroll to "What people are asking".

Or just ask. An agent answers in a few sentences, naming each talk and the minute it was said, with links to check. Asking is rate limited and capped at fifteen dollars. Below it, an hourly note sums up what people are asking.

### 7. An agent using the archive (1:49 to 1:59)

On screen: the terminal. Ask Claude Code which talks covered node failures.

AI agents can search too. Claude Code connects to our MCP endpoint with one command and answers from the archive, with sessions and timestamps.

### 8. Questions for presenters (1:59 to 2:14)

On screen: Questions. Enter the presenter code and press "Show the questions". Show "Not answered yet" and "Already answered". Then open the session from beat 4, choose "Delete this session", and "Delete for good".

And it loops back. With the presenter code, Questions shows what people typed, with no names, and which ones nobody has answered yet. The same code deletes a session that should not be there.

### 9. What each sponsor does for us (2:14 to 2:40)

On screen: Radar's view of the cluster, then the Elastic agent and workflow, then the Gitar review, then Dash0.

It all runs on our own four-machine Kubernetes cluster, and Radar shows us what is running in it. Elastic does the search by meaning with Jina embeddings, the agent behind the Ask box, and the workflow behind the hourly note. Gitar reviews every pull request. Dash0 collects traces and logs through its operator, with no tracing code in the app.

### 10. What stays private (2:40 to 2:55)

On screen: the home page on the phone, then on the laptop. Switch the system between light and dark once. End on the footnote band at the bottom of the page.

It works on a phone, in light and dark. No audio or video ever reaches us; we store only text. That is Asked & Answered: every question kept, and one search away. Thank you.

## If something breaks

- The phone shows no microphone prompt: the page must be on HTTPS. Use the public address, not the cluster's plain HTTP one.
- Speech recognition stops: tap "Stop and save", then start a new session. Sentences already sent are kept.
- The model shot shows "The speech model could not be downloaded": check the connection and start again. If it still fails, leave beat 4 out; phones with their own speech-to-text never need the model.
- The model shot is slow to start: the first use downloads about 28 MB. Load it once before recording, so the browser has it cached.
- Search returns nothing at all: Elastic may be unreachable. Show a sample session page instead; Postgres still has everything.
- The Ask box says it is busy: it takes ten questions a minute. Wait a minute and ask again.
- The Ask box says it has used its budget, or is not available: skip beat 6 and go straight to the terminal.
- "What people are asking" is missing: the hourly note has not been written yet. Leave that sentence out.
- No questions after "Stop and save": the split runs once, while the session is saved, and the phone shows how many questions it found. If it found none, `mise run k8s:logs` says why; show a sample session instead.

## Likely questions

- **Why no audio?** We don't want to store people's voices, and the phone already turns speech into text.
- **What about browsers with no speech-to-text?** They download a small model, Moonshine Tiny, about 28 MB on first use, and run it on the device. Words appear a few seconds behind, and the audio never leaves the phone.
- **How does the split work?** An LLM reads the Q&A part of the transcript and returns questions and answers, each linked to the exact passage.
- **What if the presenter forgets the button?** The LLM finds where the Q&A starts from the transcript.
- **What does the Ask box cost?** It stops at $15 in total and takes ten questions a minute. The hourly note has its own cap of about $5.
- **How do agents connect?** They add our MCP endpoint, for example `claude mcp add -t http asked https://asked.howmanysmall.com/mcp`, and get three read-only tools.
- **Who can delete or record?** Anyone with the presenter code. Reading and searching are open to everyone.
