# Phone v3: a call is a side conversation

A call with a bot is a conversation of its own, beside its main chat, as a chat room is. The bot is a true sidekick on it: it answers at once in its own words, and anything that needs a tool goes to the background while you keep talking.

- **A call has its own chat.** The bot talks with you in a session of its own. It starts with a recap of what's recent in the main chat, so it knows what you've been doing. The call's back-and-forth stays out of the main chat.
- **The main chat gets a summary.** When the call ends, a summary goes to the main chat. It shows as a pill in the middle, **Phone call · 4 min**. The pill opens the call's whole conversation on the right, as a page opens. Every past call opens the same way, from the pill or from phone's **Last calls**.
- **A true sidekick, enforced.** The bot says what it's doing in a few natural words ("Oh, let me check that."). Anything that needs a tool goes to a subagent. On a call, phone refuses any other tool, so the conversation never waits on one. You talk about anything meanwhile, and results come back at your pause.
- **Newer voices.** ElevenLabs v3 and v4, over its Text to Dialogue WebSocket.
- **Cut-ins you can trust.** Every cut-off is logged with what caused it. A misheard echo of the bot's own words counts as an echo.

Status: **planned on 2026-11-25**, after the owner's first ElevenLabs calls on dev, and at their direction. It builds on [phone-v2](phone-v2.md)'s part 1, on `release/0.12.0`. Phone 0.2.0 and subagents 0.3.0 aren't released yet, so they change in place. Phone-v2's part 2, SIP, stays there. The reference research was skipped at the owner's word. The v3 and v4 voices are built, and checked on the owner's account. The rest isn't started.

## What the owner asked

After their first in-app calls with ElevenLabs:

- "I do want v2 v3 turbo, v4 et4 available ... why aren't those on the list for output audio?"
- "also this conversation it just said "quiet" and then stopped... Also it said "one moment.." when doing stuff but didn't act lik ea side kick like "Oh let me check that... " and do it behind the scenes its still call response... It didn't let us continue chatting etc... below expectations."

On how phone-v2's sidekick fell short: "how did your plan here just differ from the phone-v2 we did? why did you not build the sidekick we asked for for phone-v2? now you are playing catch up... you didn't actually build what I wanted... before... how do you know you are building it righ tnow?"

On enforcing it, and the shape of a call: "Phone should. It should act like a side conversation like chat-rooms with a bit separate context etc... it can get details from the main chat, and i tputs summaries of phone conversations into main chat after the call etc... you can view past call chats... This way we can keep the experiences a bit different. In the main chat you can see a chip in the middle for "1 phone call" or something like that, that you can click that opens the phone call chat history on the right hand summary side (like pages open)."

On research: "skip research directive atm." "What I want here is different from anyone else."

From phone-v2, still the bar: "it can talk to me and delegate behin tthe scenes and keep our conversation interactive. A true sidekick..."

## 0. Core or plugin

**A plugin phase:** phone, with two small widenings.

- **Core's page API: a fold's pill can name itself, and open a path.** Today a fold's pill counts what it folded ("1 received, 1 sent") and unfolds in place. Phone's pill says **Phone call · 4 min** and opens the call beside the chat.
  - `Fold.message(id)` may answer `label` and `open`.
  - About 15 lines in `packages/ui`. A plugin that folds today sees no change.
- **Subagents learns a call's session, as it learned a room's.** Phone provides `{ callOf(session), wake(session, message) }`, and subagents needs phone optionally, as it needs chat rooms.
  - A subagent started on a call reports into the call while it's on, and to the main chat after.
  - About 20 lines in subagents.

**Everything else is plugin API phone already has:**
- `fx.chats.newSession`, and `send` and `stream` with a session.
- The `instructions` and `tool.before` hooks.
- `fx.models.ask`, `fx.provide`, `app.route`, `openBeside`, and `app.fold`.

There's no SDK or server change, and no core migration. Phone gets one migration, `calls.session`.

## 1. What the first calls showed

The reference research is skipped at the owner's word, since what they want here is different from anyone else's. What follows is from their calls, and from measurements on their account, on 2026-11-25.

### Why phone-v2's sidekick fell short

- **The plan narrowed what was asked.** The owner asked for a bot that delegates behind the scenes and keeps the conversation going. Phone-v2 said instead: "Quick looks it does in the conversation." "What's going on in the lab?" counted as a quick look, so the call went like this:
  - Bob ran `herdr_agents` in the call's own turn.
  - Phone filled the wait with its canned "One moment.".
  - The owner waited for the answer.
- **It was asked of the model, not enforced.** A model may run a tool whatever its instructions say.
- **It was checked with a mock model** scripted to start a subagent. That proved the wiring, not the behavior. The real-model items stayed unticked in phone-v2's checklist, and part 1 was still reported as passing.

### The call lives in the main chat

Today a call's words go to the bot's own chat, as "From your call", and phone speaks everything in that chat while the call lasts. So:
- The call's back-and-forth crowds the main chat.
- The main chat's running turns, and other plugins' messages there, reach the call.

### ElevenLabs on the owner's account

- **Flash v2.5 and Turbo v2.5 garble the greeting.** They said "Hey, what's up?" as 3 to 12 seconds of babble, whether or not they were told the language. Flash v2 and Multilingual v2 said it cleanly in about a second. Flash v2 has been the default since `82b0f07`.
- **v3 and v4 speak only over the Text to Dialogue WebSocket.** They refuse the text-to-speech one phone used. Over the Dialogue one:
  - v4 Turbo said the greeting in 1.23 seconds, and v3 Conversational in 1.09.
  - v4 Turbo kept a context open across a 25-second wait, with keep-alives every 10 seconds.
  - `is_final_audio_for_turn` comes once for each flushed sentence, in order.
- **Not yet known:** Flash v2's **Hear it** line comes back 1.74 to 1.82 seconds long, with no pause between its two sentences. Whether it says all of it hasn't been checked.

### "Quiet", then nothing

Bob's whole reply was in his chat: "Quiet — all five agents are idle, …". Phone sent it as one sentence, and ElevenLabs says it in full every time, after the greeting and with or without the dash. No error was logged, so the call cut Bob off after one word.

The likeliest cause is his own voice coming back through the desktop's speakers, misheard ("quite" for "quiet"). Phone's echo check matches whole words exactly, so two misheard words count as the owner talking. Phone logs no cut, so this is the likeliest cause, not a known one.

## 2. Key takeaways

- **A call is a side conversation:**
  - It has a session of its own.
  - It starts with a recap of the main chat.
  - It ends with a summary in the main chat, shown as a pill that opens the call.
- **Phone enforces the sidekick.** On a call, any tool but handing work off is refused, and the refusal says what to do instead.
- **The bot speaks first, in its own words.** Phone's own lines are a net for silence, not the voice of the call.
- **Done means measured on real calls against the owner's bar, then the owner's own calls.** A mock proves the wiring, and is reported as only that.

## 3. Implementation

### A call's own conversation (`call.ts`, `server.ts`)

- **A session for each call.** At the start, phone opens one with `fx.chats.newSession(bot, { label: "Call <id>", effort })`, and keeps it on the call's row. That needs migration `0003_call_session.sql`, adding `calls.session`.
- **The owner's words go there.** They're sent with `fx.chats.send(bot, { session, steer: true, … })`. Phone follows that session with `fx.chats.stream(bot, session)`, where it streamed the main chat from its start. What else lands in the main chat during a call, such as herdr's watch reports, isn't spoken.
- **The call's instructions,** added by the `instructions` hook for that session only:
  - The call note, below.
  - A recap of the main chat: its last turns, the owner's words and the bot's replies, newest last, up to about 6,000 characters. Phone reads it once, at the start, from the bot's chat, as it reads the chat today.
  - For a call the bot placed, its reason.

  The first message then carries only the owner's words.
- **Room calls stay in the room.** A room is already a conversation of its own, so its call keeps speaking there. The sidekick rule covers the room's sessions while its call is on.
- **Phone-line calls work the same.** The session belongs to the call, not to whatever carries it: SignalWire today, SIP after phone-v2's part 2.

### The sidekick, enforced (`call.ts`, `server.ts`)

- **The call note** replaces phone-v2's "quick looks yourself":
  - Talk like a person on a call.
  - Before anything that needs a tool, first say in a few natural words what you're doing ("Oh, let me check that.").
  - Hand that work to a subagent with `subagents_start`, then come straight back to the owner, and keep talking about anything.
  - When a report comes, say what matters, briefly. "How's it going?" is `subagents_list`.
- **Phone's `tool.before` hook does the enforcing.** It applies in a live call's session, and in a room's sessions while the room's call is on.
  - Any tool but the `subagents_*` tools and `phone_hang_up` is refused with: "You're on a call: say what you're doing, hand it to a subagent with subagents_start, and carry on talking."
  - It refuses only while subagents is on for the bot. Without subagents, nothing is refused, and the note says to keep each turn short and say what you're doing first.
- **Phone's own lines.** "One moment." waits 3 seconds, not 1.5, and only if nothing at all was said. "Still working on it." goes, since a call's turns no longer wait on tools.
- **Reports come back into the call.** Phone provides `callOf(session)` and `wake(session, message)` with `fx.provide`.
  - **During the call,** a report from a subagent started there wakes the bot in the call's session. Phone speaks it at the owner's next pause, as today.
  - **After the call,** phone sends it to the bot's own chat, marked as from work started on the call.
- **Subagents** (0.3.0, unreleased) takes a call's session beside a room's:
  - `subagents_start` works in a live call's session.
  - Its `back()` uses phone's `wake`.
  - It needs phone optionally.

### After the call: a summary in the main chat (`server.ts`)

- **The summary.** When the call ends, phone reads its session: the owner's words, the bot's replies, and each tool as one line. It asks for a summary with `fx.models.ask(bot, …)`: what was talked about, what was decided, and what was started and still runs, in a few sentences.
- **The message.** Phone sends it to the bot's own chat:

  ```js
  fx.chats.send(bot, {
    messageId: `phone-call-${id}`,
    label: "your call",
    text: "[A call with the owner just ended. This is what was said and done, for your record. Reply in one short line.]\n\n" + summary,
    shown: summary,
    effort: "low",
  })
  ```

  From then on, the bot knows about the call in its main chat. A turn running there gets the message after it ends.
- **A call where the owner said nothing sends no summary.**

### The pill, and the call's chat on the right (page, core)

- **Core: `Fold`.**
  - `message(id)` may answer `label`, the pill's words in place of its counts.
  - It may also answer `open`, a path the pill opens beside the chat with `openBeside`, instead of unfolding in place.
  - A turn whose fold has `open` gets a pill of its own, and isn't merged into a run.
  - About 15 lines in `app.tsx` and `fold.tsx`, plus a line in the plugin API reference.
- **Phone's fold.**
  - `phone-call-<id>` folds as a `turn`.
  - Its label is **Phone call · 4 min**, from the calls phone's page keeps. It reads **Phone call** until they load.
  - It opens `/phone/calls/<id>`.
- **The call's chat.** `app.route("/calls/:id", CallChat)`, drawn as subagents draws a thread: the session's lines, from phone's `GET /calls/:id/stream`, through `applyLine`.
  - **At the top:** when, how long, who, and the summary.
  - **Below:** the owner's words, the bot's replies, its subagents, and their reports, as in a chat. It's read-only.
- **Last calls** in phone's tab link to each call's chat.

### Voices (`speech/elevenlabs.ts`), built

- **One `speak()` with two connections,** picked by the model: `eleven_v3*` and `eleven_v4*` go over Text to Dialogue's multi-context WebSocket.
  - Each reply gets a context.
  - The context's first message names its voice, and each sentence is an input, flushed.
  - A context with text is kept alive every 10 seconds.
  - Each sentence's mark comes from the alignment, or from `is_final_audio_for_turn`.
- **The list:** `eleven_flash_v2` (the default), `eleven_v4_turbo`, `eleven_v3_conversational`, `eleven_multilingual_v2`, `eleven_flash_v2_5`, `eleven_v4`, and `eleven_v3`.
- **Left to do:** check `eleven_v4` and `eleven_v3` with Hear it, find out whether Flash v2 says all of the Hear it line, and update the docs.

### Cut-ins (`call.ts`)

- **Each cut is logged:** the words that cut the bot off, and what it was saying, from `cutIn()` and the batch listener's cut. The next surprise is then in the log, and the 1.5-second echo window can be tuned from real calls.
- **Near words match.** In the echo check, a heard word matches a said one when they're equal, or both have four or more letters and are one edit apart, with a swap of two letters counted as one ("quite" and "quiet"). The 0.6 share stays.

### What the owner sees

1. **They tap the phone at the top of Bob's chat, and choose In-app call.** "Hey, what's up?" Bob knows what they were doing in the chat a minute ago.
2. **"What's going on in the lab?"** Bob answers at once: "Oh, let me check on the lab." A subagent starts, and the call's bar shows it.
3. **They talk about something else meanwhile, and Bob answers.** At their next pause: "The lab's quiet: all five agents are idle, and the backup copy is still running."
4. **They hang up.** In Bob's chat, a pill in the middle says **Phone call · 4 min**. It opens the call on the right, with the summary at the top. Bob's main chat knows what was said and done.
5. **Later, they ask in the main chat** "what did we decide on the call?", and Bob knows.

### Docs, when it's built

- **`how-to/talk-with-a-bot-on-the-phone.md`:** a call's own chat, the pill, and the sidekick.
- **`how-to/add-a-voice-provider.md`:** ElevenLabs' models, and that v3 and v4 cost more.
- **The plugin API reference:** `Fold`'s `label` and `open`.
- **Phone's and subagents' READMEs,** and their descriptions.
- **`CHANGELOG.md`,** with a For plugins line.
- **Phone-v2's status** points here.

### Size

- **Core:** about 15 lines.
- **Phone:** about 180 lines of server code and 140 of page.
- **Subagents:** about 20 lines.
- **Voices:** about 40 lines, built.

### Not in this phase

- **SIP and line 3:** phone-v2's part 2.
- **A live voice model fronting the bot:** the GPT-Live test, after.
- **Calls the bot places on its own** get a session too, but when they happen doesn't change.

## 4. Checklist

- [x] v3 and v4 over the Dialogue WebSocket, checked on the owner's account: v4 Turbo and v3 Conversational said the greeting cleanly, and a context held across a 25-second wait.
- [ ] `eleven_v4` and `eleven_v3` with Hear it, with how long each takes to start.
- [ ] Flash v2's Hear it line, played or transcribed whole.
- [ ] Cut-ins:
  - [ ] Each cut is logged.
  - [ ] Near words match, and a node check shows "quite all five" counts as Bob's echo, while "hold on so you can't hear me" stays the owner's.
- [ ] Core `Fold` `label` and `open`, with the plugin API reference, and a For plugins line in the CHANGELOG.
- [ ] A call's own session:
  - [ ] `calls.session` and its migration.
  - [ ] The recap and the call note in its instructions.
  - [ ] The owner's words go there, and phone follows it.
  - [ ] What lands in the main chat during a call isn't spoken.
- [ ] The sidekick:
  - [ ] Phone's `tool.before` refuses other tools on a live call while subagents is on, and refuses nothing without it.
  - [ ] "One moment." waits 3 seconds, and "Still working on it." is gone.
- [ ] Subagents and phone:
  - [ ] Phone provides `callOf` and `wake`.
  - [ ] Subagents starts in a call's session.
  - [ ] A report during the call is spoken at the owner's pause.
  - [ ] A report after the call goes to the main chat.
- [ ] After the call:
  - [ ] The summary goes to the main chat as `phone-call-<id>`, and the bot answers in one line.
  - [ ] A call with no words sends none.
- [ ] The pill and the call's chat:
  - [ ] **Phone call · 4 min** in the middle of the main chat opens the call on the right.
  - [ ] The call's chat shows the summary and the whole call.
  - [ ] Last calls link to it.
  - [ ] Checked in Chromium, on a desktop in light and a phone in dark.
- [ ] The wiring, on the disposable check fxbot with fake voices and the mock model, reported as wiring only:
  - [ ] The bot's own words are spoken before the subagent starts.
  - [ ] A refused tool's refusal reaches the model.
  - [ ] The owner's next words get a turn at once.
  - [ ] The report comes at the pause.
  - [ ] The summary and the pill.
- [ ] **The owner's bar, measured on real calls with Bob on dev,** automated from headless Chrome with a voice ElevenLabs makes, each number in the build notes:
  - [ ] Bob's first words come within about 2 seconds of the owner's last, in his own words.
  - [ ] No tool runs in the call's own turns, but handing off.
  - [ ] Asked something else while the work runs, Bob answers.
  - [ ] The result comes at the owner's next pause, not over them.
  - [ ] On speakers, nothing cuts Bob off falsely, and the log says what each cut was.
- [ ] **The owner's own calls,** on desktop speakers and from the watch: it feels like a sidekick. This item is theirs to tick.
- [ ] The docs listed above.
- [ ] The repo checks:
  - [ ] `npm run typecheck`, `npm run build`, `npm run build-site`, and `git diff --check`.
  - [ ] Phone's and subagents' `page.js` rebuilt.
  - [ ] Dev updated, with each file landed in one write while no call is on, then its API restarted.
  - [ ] Committed on `release/0.12.0`.

## 5. Open questions

1. **The summary's turn.** For the main chat's model to keep the summary, the message must run a turn, so the bot answers in one line, which the pill hides. The other way is a core hook that puts a message in a chat's history with no turn: no answer, but a core change. The plan is the one-line answer.
2. **The recap.** Is the main chat's last 6,000 characters enough? Or should a call also have a tool to read further back in the main chat? It would be local and instant, so it could be allowed on a call.
3. **What a call may run itself.** Only the subagent tools and hang-up? Or also instant local reads, such as memory search?
4. **Room calls.** Should they keep speaking in the room, which is already a side conversation, with only the sidekick rule added? The plan says yes.
5. **The default voice.** Flash v2 is the fastest that's been checked. Should it become v4 Turbo, once that's measured on real calls?
6. **The pill's words.** "Phone call · 4 min", or "1 phone call"?
