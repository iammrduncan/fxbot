# Phone v3: a call is a side conversation

A call with a bot is a conversation of its own, beside its main chat, as a chat room is. When it ends, the bot writes what happened into a pill in the middle of the main chat. That pill is part of what the bot knows from then on, in the main chat and on later calls.

- **A call has its own chat.**
  - The bot talks with you in a session of its own, with everything it can do in its main chat.
  - The call starts with a recap of what's recent in the main chat, so the bot knows what you've been doing.
  - The call's back-and-forth stays out of the main chat.
- **The pill is the call, in context.** When the call ends, the bot writes its summary, a compaction of the call and what came of it.
  - Phone puts the summary in a pill in the middle of the main chat: **Phone call · 4 min**.
  - The pill is in context: the model gets it with the chat's history, as it gets messages and tool calls, so the main chat and later calls know about it.
  - Clicking the pill opens the call's whole chat on the right, as a page opens.
- **Pills are core.** Any plugin can put a pill in a bot's chat, with words, text, a place it opens, and `inContext: true` to make it part of the history the model is sent.
- **Room calls work the same.** A room's call is a side conversation of the room. Its pill, with the summary, lands in the middle of the room.
- **Call chats can be searched.** The bot finds past calls with `chat_history`, as it finds any chat of its own.
- **A sidekick.** The bot says what it's doing in a few natural words ("Oh, let me check that."), and hands longer work to a subagent, while you talk about anything. Results come back at your next pause.
- **Newer voices.** ElevenLabs v3 and v4, over its Text to Dialogue WebSocket.
- **Cut-ins you can trust.** Every cut-off is logged with what caused it, and a misheard echo of the bot's own words counts as an echo.

Status: **built on 2026-11-25** on `release/0.12.0`, the day it was planned, and checked on real calls with Bob on the owner's dev. All but three checklist items are done ([What the build changed](#what-the-build-changed)):
- Bob's first words come about 5 seconds after the owner's last, not 2.
- Speakers, the watch, and Flash v2's line are the owner's to try.
- Phone-v2's part 2, SIP, stays there. The reference research was skipped at the owner's word.

## What the owner asked

After their first in-app calls with ElevenLabs:

- "I do want v2 v3 turbo, v4 et4 available ... why aren't those on the list for output audio?"
- "also this conversation it just said "quiet" and then stopped... Also it said "one moment.." when doing stuff but didn't act lik ea side kick like "Oh let me check that... " and do it behind the scenes its still call response... It didn't let us continue chatting etc... below expectations."

On how phone-v2's sidekick fell short: "how did your plan here just differ from the phone-v2 we did? why did you not build the sidekick we asked for for phone-v2? now you are playing catch up... you didn't actually build what I wanted... before... how do you know you are building it righ tnow?"

On the shape of a call: "It should act like a side conversation like chat-rooms with a bit separate context etc... it can get details from the main chat, and i tputs summaries of phone conversations into main chat after the call etc... you can view past call chats... This way we can keep the experiences a bit different. In the main chat you can see a chip in the middle for "1 phone call" or something like that, that you can click that opens the phone call chat history on the right hand summary side (like pages open)."

On the first draft of this plan:

- "No the pill is the context... and the model (bob) puts the summary in it, and its included in future calls. Pills should have a {incontext:true} option on them that would pull them into the convesation history for sending to model etc just like rest of chat history and tool calls etc..."
- "yeah 6000 characters is plenty for a summary. its basically a compaction of the phone chat history and call outcomes..."
- "call may do anything main thread can do, don't limit what it is able to do..."
- "room calls are treated same. pill in middle with phone call and compacted summary. chat history of phone calls available via search. opens on sidebar like pages if clicked etc..."
- "keep flash v2 thats fine." "phone call 4 min is fine yeah..."

On the revised plan: "sidekick should be part of bobs instructions only during the phone call..." "reaching model with next turn is the correct thing. We maintain context not libfx..." "recap for call makes sense."

On research: "skip research directive atm." "What I want here is different from anyone else."

From phone-v2, still the bar: "it can talk to me and delegate behin tthe scenes and keep our conversation interactive. A true sidekick..."

## 0. Core or plugin

**Core gains pills, and phone, chat rooms, and subagents use them.**

- **Core: pills.** A pill is an entry in the middle of a bot's chat that a plugin adds. It is core because two things only core owns are involved:
  - **The chat's stream.** The pill shows where it was added, live and on replay.
  - **What the model is sent.** With `inContext: true`, the pill's text is part of the chat's history, as messages and tool calls are.

  The pieces, about 150 lines:
  - A migration with a `pills` table.
  - `fx.chats.pill` in the plugin API.
  - A `pill` line in the chat's stream.
  - The page draws it.
  - The next turn carries it to the model.
  - It only adds, so it needs no line in `plugin-breaks.json`.
- **Phone:** a call's own session, the summary the bot writes, the pill, and the call's chat on the right.
- **Chat rooms:** a room's call runs in a call room of its own, linked to the room. The room gets pills of its own, in its timeline, in context through what it already sends each bot.
- **Subagents:** it learns a call's session as it learned a room's. Phone provides `{ callOf(session), wake(session, message) }`, so a subagent started on a call reports into the call while it's on, and to the main chat after.

**What it reuses:**
- `fx.chats.newSession`, and `send` and `stream` with a session.
- The `instructions` hook, `fx.provide`, `app.route`, and `openBeside`.
- Core's `chat_history`, which already searches a bot's plugin sessions.

There's no server change beyond the routes the SDK's new calls need.

## 1. What the first calls showed

The reference research is skipped at the owner's word: what they want here is different from anyone else's. What follows is from their calls, measurements on their account, and the code, on 2026-11-25.

### Why phone-v2's sidekick fell short

- **The plan narrowed what was asked.** The owner asked for a bot that delegates behind the scenes and keeps the conversation going. Phone-v2 said instead: "Quick looks it does in the conversation." "What's going on in the lab?" counted as a quick look, so the call went like this:
  - Bob ran `herdr_agents` in the call's turn.
  - Phone filled the wait with its canned "One moment.".
  - The owner waited for the answer.
- **It was checked with a mock model** scripted to start a subagent. That proved the wiring, not the behavior. The real-model items stayed unticked, and part 1 was still reported as passing.

### The call lives in the main chat

Today a call's words go to the bot's own chat, as "From your call", and phone speaks everything in that chat while the call lasts. So:
- The call's back-and-forth crowds the main chat.
- The main chat's running turns, and other plugins' messages there, reach the call.

### What core has for pills

- **fxbot keeps the context, not libfx.** A pill lives in fxbot's own table, and fxbot hands it to the model with the chat's next turn. From then on it's in the session's history, and in its compactions, like any message. libfx 0.0.16 has no way to add history without a turn anyway: a session's history is opaque bytes, and only `prompt` and `steer` add to it (`node_modules/libfx/types/libfx.d.cts`).
- **The chat already shows a message apart from what the model got.** Core's `sent` table holds what the chat shows of a message, and the stream shows that in place of libfx's input. A turn that carries pills to the model still shows only the owner's words.
- **A fold isn't a pill.** `app.fold`'s pills count what a plugin folded out of view, and unfold in place. A call's pill is an entry of its own: its words, its text in context, and a place it opens.
- **Search is there.** `chat_history` already searches every message of a bot, plugin sessions included, with the plugin each came from (`packages/sdk/src/history.ts`). A call's session is then searchable by the bot as it is.

### Chat rooms catch each bot up

Each bot in a room answers in a session of its own for the room, sent "what was said since its last turn". A room's compaction summary is already kept as a room message. So a room pill, kept as a room message, reaches each bot's next turn, and a pill that isn't in context is left out.

### ElevenLabs on the owner's account

- **Flash v2.5 and Turbo v2.5 garble the greeting.** They said "Hey, what's up?" as 3 to 12 seconds of babble, whether or not they were told the language. Flash v2 and Multilingual v2 said it cleanly in about a second. Flash v2 has been the default since `82b0f07`, and stays so.
- **v3 and v4 speak only over the Text to Dialogue WebSocket.** Over it:
  - v4 Turbo said the greeting in 1.23 seconds, and v3 Conversational in 1.09.
  - v4 Turbo kept a context open across a 25-second wait, with keep-alives every 10 seconds.
  - `is_final_audio_for_turn` comes once for each flushed sentence, in order.
- **Not yet known:** Flash v2's **Hear it** line comes back 1.74 to 1.82 seconds long, with no pause between its two sentences. Whether it says all of it hasn't been checked.

### "Quiet", then nothing

Bob's whole reply was in his chat ("Quiet — all five agents are idle, …"), and ElevenLabs says it in full every time. No error was logged, so the call cut him off after one word.

The likeliest cause is his own voice coming back through the desktop's speakers, misheard ("quite" for "quiet"). Phone's echo check matches whole words exactly, so two misheard words count as the owner talking. Phone logs no cut, so this is the likeliest cause, not a known one.

## 2. Key takeaways

- **A call is a side conversation.** It has a session of its own, with everything the main chat can do, and starts with a recap of the main chat.
- **The pill is the call, in context.** The bot writes its compaction, up to 6,000 characters, and the pill carries it into the main chat's history and into later calls.
- **Pills are a core part any plugin can use.** Rooms get pills of their own the same way.
- **Nothing is refused on a call.** The sidekick is the bot's manner, in its instructions only while a call is on: it speaks first, in its own words, and hands longer work to subagents. Phone's own lines are a net for silence.
- **Done means measured on real calls against the owner's bar, then the owner's own calls.** A mock proves the wiring, and is reported as only that.

## 3. Implementation

### Core: pills

- **The table.** Migration `0020_pills.sql`, with these columns:
  - `id`, `profile_id`, `session_id`: the chat it's in.
  - `after`: the `messageId` of the turn it follows, or null.
  - `plugin`, `label`, `text`, `open`, `in_context`.
  - `given_at`: when a turn carried it to the model, null until then.
  - `created_at`.
- **The plugin API:**

  ```ts
  fx.chats.pill(bot: string, pill: { label: string; text?: string; open?: string; inContext?: boolean; session?: string }): Promise<{ id: number }>
  ```

  - It goes in the bot's own chat, or in one of the plugin's sessions.
  - `label` is the pill's words, up to 80 characters.
  - `text` is up to 8,000 characters.
  - `open` is an app path, such as `/phone/calls/14`, which the pill opens beside the chat. Without one, the pill unfolds in place to show its text.
- **In context.** The chat's next turn, from the owner or from a plugin, carries each in-context pill not yet given to the model ahead of its message.
  - It reads: "[From phone, *label*:]\n*text*", oldest first.
  - The pill is then marked given.
  - The chat shows the message alone, through the `sent` table as now.
  - A turn that's running doesn't take one: it waits for the next turn.
- **In the chat.** The stream gets a `pill` line, `{ type: "pill", id, label, text, open, from }`:
  - Live, at the moment it's added.
  - On replay, right after the end of the turn it followed.

  It carries the cursor of the line before it, and `applyLine` keeps one entry for each pill id. `Thread` draws it in the middle, like a fold's pill, with the plugin's icon:
  - With `open`, a click opens the path beside the chat (`openBeside`).
  - Without it, the pill unfolds to show its text.
- **The client and the docs:**
  - `Turn` lists gain pill entries, and `client.ts` types them.
  - The plugin API reference documents `fx.chats.pill`.
  - The CHANGELOG gets a For plugins line, and its Before upgrading note names the migration.

### Phone: a call's own conversation (`call.ts`, `server.ts`)

- **A session for each call.** At the start, phone opens one with `fx.chats.newSession(bot, { label: "Call <id>", effort })`, and keeps it on the call's row. That needs migration `0003_call_session.sql`, adding `calls.session`.
- **The owner's words go there.** They're sent with `fx.chats.send(bot, { session, steer: true, … })`. Phone follows the session with `fx.chats.stream(bot, session)`, where it streamed the main chat from its start. What lands in the main chat during a call, such as herdr's watch reports, isn't spoken.
- **The call's instructions,** added by the `instructions` hook to that session only, and only while the call is on:
  - The call note, below.
  - A recap of the main chat: its last turns and pills, the owner's words and the bot's replies, newest last, up to about 6,000 characters. Its pills include the summaries of earlier calls, so later calls know them.
  - For a call the bot placed, its reason.
- **Nothing is refused.** A call can do anything the main chat can, at the owner's word.
- **Phone-line calls work the same.** The session belongs to the call, not to whatever carries it: SignalWire today, SIP after phone-v2's part 2.

### Phone: the sidekick (`call.ts`, `server.ts`)

- **Only during the call.** The sidekick note is part of the bot's instructions for the call's session, and only while the call is on.
  - It's never a message, so it isn't in the call's chat, its summary, the main chat, or a subagent's task.
  - A call session opened after the call ended gets none, such as for the summary or a late report.
  - Phone-v2 sent the note as the call's first message into the main chat, where it stayed in the bot's history. That goes.
- **The call note** replaces phone-v2's "quick looks yourself":
  - Talk like a person on a call.
  - Before you use a tool, first say in a few natural words what you're doing ("Oh, let me check that."), so the owner hears you at once.
  - Anything that takes more than a moment, such as digging, work on your computer, a herdr agent's task, or more than one or two tool calls, goes to a subagent with `subagents_start`. Then come straight back to the owner, and keep talking about anything.
  - When a report comes, say what matters, briefly. "How's it going?" is `subagents_list`.
- **Phone's own lines.**
  - "One moment." waits 3 seconds, not 1.5, and only if nothing at all was said.
  - "Still working on it." stays, after 20 seconds of a silent tool.
- **Reports come back into the call.** Phone provides `callOf(session)` and `wake(session, message)` with `fx.provide`.
  - **During the call,** a subagent started there reports into the call's session. Phone speaks it at the owner's next pause, as today.
  - **After the call,** phone sends it to the bot's own chat, marked as from work started on the call.
- **Subagents** (0.3.0, unreleased) takes a call's session beside a room's:
  - `subagents_start` works in a live call's session.
  - Its `back()` uses phone's `wake`.
  - It needs phone optionally.

### Phone: the pill, written by the bot (`server.ts`)

- **The bot writes the summary.** When the call ends, phone sends a last message into the call's session: "[The call has ended. Write what your main chat should keep of it: what you talked about, what was decided and done, and what's still running. Up to 6,000 characters, in plain text.]" The bot's reply is the summary, a compaction of the call.
- **Phone puts it in a pill** in the bot's own chat:

  ```js
  fx.chats.pill(bot, {
    label: "Phone call · 4 min",
    text: summary,
    open: `/phone/calls/${id}`,
    inContext: true,
  })
  ```

  - It sits there at once.
  - The main chat's next turn carries it to the model, and later calls' recaps hold it.
  - No turn runs in the main chat for it.
- **A call where the owner said nothing gets no summary and no pill.**
- **The call's chat.** `app.route("/calls/:id", CallChat)`, drawn as subagents draws a thread: the session's lines, from phone's `GET /calls/:id/stream`, through `applyLine`.
  - **At the top:** when, how long, who, and the summary.
  - **Below:** the owner's words, the bot's replies, tools, subagents, and their reports, as in a chat. It's read-only.
  - It opens beside the chat, from the pill and from **Last calls** in phone's tab.

### Room calls (`room.ts`, and chat rooms)

- **A call room.** A room's call runs in a call room that chat rooms makes for it.
  - The rooms table gains `call_of`, the room it's for, and `messages` gains a `kind` and the pill's fields, in migration `0006_call_rooms.sql`.
  - A call room has the room's bots, lead, and settings, and is left out of the rooms list.
  - Phone speaks in it as it speaks in a room today.
  - Each bot's first turn there is sent the parent room's recent history, then the call's own.
- **The lead writes the summary** at the end, as a bot does on its own call.
- **The room gets a pill.** Chat rooms keeps it as a room message of a new kind, `pill`, with `label`, `open`, and `in_context`.
  - Its timeline draws it in the middle, opening the call room beside the room.
  - Each bot's catch-up includes it when it's in context.
  - Chat rooms provides `pill(room, …)` to phone.
- **Their history.** The bots' turns in a call room are in their room sessions, so `chat_history` finds them as it finds a room's.

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

1. **They tap the phone at the top of Bob's chat, and choose In-app call.** "Hey, what's up?" Bob knows what they were doing in the chat a minute ago, and what they settled on their last call.
2. **"What's going on in the lab?"** Bob answers at once: "Oh, let me check on the lab." He looks, or starts a subagent for anything longer, and the call's bar shows it.
3. **They talk about something else, and Bob answers.** At their next pause: "The lab's quiet: all five agents are idle, and the backup copy is still running."
4. **They hang up.** In the middle of Bob's chat: **Phone call · 4 min**. It opens the call on the right, with Bob's summary at the top.
5. **Later, they ask in the main chat** "what did we decide on the call?", and Bob knows, from the pill. On the next call, he knows too.
6. **In a room,** the same: the call happens in its own call room, and the room gets the pill.

### Docs, when it's built

- **`how-to/talk-with-a-bot-on-the-phone.md`:** a call's own chat, the pill, the sidekick, and rooms.
- **`how-to/add-a-voice-provider.md`:** ElevenLabs' models, and that v3 and v4 cost more.
- **The plugin API reference:** `fx.chats.pill`, and the `pill` stream line in the client reference.
- **Phone's, chat rooms', and subagents' READMEs,** and their descriptions.
- **`CHANGELOG.md`:** the feature, a For plugins line, and the migration under Before upgrading.
- **Phone-v2's status** points here.

### Size

- **Core pills:** about 150 lines, with the migration.
- **Phone:** about 180 lines of server code and 120 of page.
- **Chat rooms:** about 80 lines, for call rooms and room pills.
- **Subagents:** about 20 lines.
- **Voices:** about 40 lines, built.

### Not in this phase

- **SIP and line 3:** phone-v2's part 2.
- **A live voice model fronting the bot:** the GPT-Live test, after.
- **The owner searching calls in the app.** The bot searches them, and the owner opens them from pills and Last calls.

## 4. Checklist

- [x] v3 and v4 over the Dialogue WebSocket, checked on the owner's account: v4 Turbo and v3 Conversational said the greeting cleanly, and a context held across a 25-second wait.
- [x] `eleven_v4` and `eleven_v3` with Hear it, timed on the owner's account: v4 said the line in 3.08 seconds of audio, back in 1.4 seconds; v3 in 2.72, back in 1.1, once Hear it waited for its last audio. v4 Turbo took 0.95 seconds, and v3 Conversational 1.17.
- [ ] Flash v2's Hear it line, played or transcribed whole. Its line is 1.74 seconds, with or without waiting for the last audio, so nothing is cut off at phone's end. Whether every word is in it is the owner's ear: installing a local transcriber here wasn't allowed.
- [x] Cut-ins:
  - [x] Each cut is logged. On the real calls: "Call 16: cut bob off on hearing "Also, tell me a quick joke while you wait.", while saying "One agent's busy and the rest are sitting still."".
  - [x] Near words match, and a node check shows "quite all five" counts as Bob's echo (1.00), while "hold on so you can't hear me" stays the owner's (0.29).
- [x] Core pills:
  - [x] The migration, `0020_pills.sql`, and `fx.chats.pill`.
  - [x] The `pill` stream line, live and on replay, after the turn it followed.
  - [x] `applyLine` and `Thread` draw it in the middle, opening beside or unfolding.
  - [x] An in-context pill reaches the model once, with the next turn, while the chat shows only that turn's own message, after a restart too.
  - [x] A pill that isn't in context never reaches the model.
  - [x] The reference and the CHANGELOG.
- [x] Phone, a call's own session:
  - [x] `calls.session` and its migration.
  - [x] The recap, with its pills, and the call note in its instructions.
  - [x] The owner's words go there, and phone follows it.
  - [x] What lands in the main chat during a call isn't spoken.
  - [x] Nothing is refused.
- [x] Phone, the sidekick:
  - [x] The note is in the call session's instructions only while the call is on: never a message, never in the main chat, and gone from the summary turn after the call.
  - [x] "One moment." waits 3 seconds.
  - [x] Phone provides `callOf` and `wake`. Subagents starts in a call's session, a report during the call is spoken at the owner's pause, and one after it goes to the main chat.
- [x] Phone, the pill:
  - [x] At the end, the bot writes the summary in the call's session, up to 6,000 characters.
  - [x] Phone pins it as **Phone call · 4 min**, in context, opening the call.
  - [x] A call with no words gets none.
  - [x] The call's chat opens beside the main chat, from the pill and from Last calls.
- [x] Room calls:
  - [x] Chat rooms makes a call room, left out of the list, with the parent's recent history.
  - [x] The lead writes the summary.
  - [x] The room's pill, in its timeline and in each bot's catch-up.
  - [x] It opens the call's chat beside the room, showing the call room.
- [x] Checked in Chromium, on a desktop in light and a phone in dark: the pills, the call's chat, a room's, Last calls' Open, and the call bar's button.
- [x] The wiring, on the disposable check fxbot with fake voices and the mock model, reported as wiring only:
  - [x] The session.
  - [x] The recap.
  - [x] The summary turn.
  - [x] The pill in the stream and in the model's next input.
  - [x] A subagent's report during and after a call.
  - [x] A room's call room and pill.
- [ ] **The owner's bar, measured on real calls with Bob on dev,** automated from headless Chrome with a voice ElevenLabs makes, each number in the build notes:
  - [ ] Bob's first words come within about 2 seconds of the owner's last, in his own words. Not met: 5.2 seconds after "What's going on in the lab?", and 3.6 after "Thanks, that's all for now. Bye.", in his own words. That's the owner's 2-second `pause`, then 1.6 to 3.2 seconds of the model.
  - [x] Asked for something that takes a while, Bob says so and hands it off, and the conversation goes on: "Let me look.", one quick tool, a subagent for the rest, and "Anything else while we wait?"
  - [x] Asked something else while the work runs, Bob answers: the joke, while the subagent read the pane.
  - [x] The result comes at the owner's next pause, not over them: the first answer waited out the owner's next words, and the report came when they were quiet.
  - [ ] On speakers, nothing cuts Bob off falsely, and the log says what each cut was. The log does. Headless Chrome has no speakers, so the false cuts are the owner's calls to find.
  - [x] After the call, the pill holds Bob's summary. Asked in the main chat about the call, Bob knows it, and on a second call, he does too.
- [ ] **The owner's own calls,** on desktop speakers and from the watch: it feels like a sidekick. This item is theirs to tick.
- [x] The docs listed above.
- [x] The repo checks:
  - [x] `npm run typecheck`, `npm run build`, `npm run build-site`, and `git diff --check`.
  - [x] Phone's and chat rooms' `page.js` rebuilt. Subagents' page didn't change.
  - [x] Dev updated, with each plugin file landed while no call was on, and its API restarted after core and non-entry files.
  - [x] Committed on `release/0.12.0`.

## 5. Open questions

Answered on 2026-11-25:
- **The pill is the context,** in context with `inContext: true`, and the bot writes it.
- **The summary is up to 6,000 characters,** a compaction of the call and what came of it.
- **A call may do anything the main chat can.**
- **Room calls work the same,** with a pill in the room.
- **Call chats are searchable,** and open beside the chat.
- **The voice stays Flash v2.**
- **The pill reads "Phone call · 4 min".**
- **An in-context pill reaches the model with the chat's next turn,** ahead of that turn's message: "reaching model with next turn is the correct thing. We maintain context not libfx..."
- **A call starts with a recap of the main chat,** about its last 6,000 characters, pills included: "recap for call makes sense."
- **The sidekick note is in the bot's instructions only during the call:** "sidekick should be part of bobs instructions only during the phone call..."

Nothing is still open.

## What the build changed

Built on 2026-11-25 in a worktree of `release/0.12.0`, landed there by fast-forward with no call on, and checked on the owner's dev.

**As planned:**
- **Core pills,** about 120 lines: `0020_pills.sql`, `fx.chats.pill`, the `pill` stream line, `applyLine`, the pill in the middle of the chat, the next turn carrying an in-context pill, and a start-over's handoff taking any left.
- **Phone:** a call's own session, its note and recap only while it's on, the summary and the pill, the call's chat on the right, `callOf` and `wake`, near words, and the cut log.
- **Chat rooms:** call rooms and room pills, `0006_call_rooms.sql`.
- **Subagents:** a call's session, `0004_calls.sql`.
- **v3 and v4 voices.**

**What changed from the plan, and why:**
- **The first real call failed:** every turn in the call's session ended with libfx's `ConflictingIdentity`, before any model request.
  - **Narrowed on dev** with a diagnostic session: the call's note, its recap, and its level weren't the cause. Core's new pill step was: it asked libfx's store for each stream's newest line, and asking a session that a turn was starting in raced libfx's own writing. With the lookup off, 5 of 5 tries that had failed 2 of 3 worked.
  - **Now:** the pill step gives the rest of the pills once a replay has been quiet for 100 ms, and asks libfx nothing.
- **Steered messages race in core, not fixed here.** A plugin session's messages sent with `steer` failed now and then the same way: 2 of 5, even with the pill step fixed. So phone sends into a call without `steer`, and words said while a turn runs are its next turn. Subagents still steer, which wasn't checked.
- **Phone keeps one reader for a call's session,** through its wrap-up. Closing it and opening another for the summary, while the goodbye turn was ending, failed the summary. The summary is also asked once more if the first answer doesn't come, and the ask says to keep to what was said on the call.
- **Nothing Bob says starts while the owner is mid-words.** On the first real call, Bob's answer to "What's going on in the lab?" began 2 seconds into the owner's next words, and was cut off. An answer to the owner's own words now waits for their pause, as a report already did, without the moment after their final words.
- **One quick tool call, not two.** Bob ran `herdr_agents` and `herdr_read` himself, and the owner waited 14 seconds. The note now allows one quick tool call, and hands anything more to a subagent. On the next call, Bob looked once, started a subagent for the rest, and asked "Anything else while we wait?"
- **Every call's chat opens through phone's view,** `/phone/calls/<id>`, a room's call showing its call room. A room can't open beside a room, so the call room itself didn't open beside its room.
- **The call bar has a button for the call's chat,** since the main chat no longer shows the call as it goes.
- **Hear it waits for half a second of quiet:** the mark comes from the text's timing, and v3's line came back cut at 1.56 seconds of 2.72.
- **A call's level rides on each message,** as in phone-v2, not on its session. fxbot sends a level only to AI Gateway, Vercel, ChatGPT, and Grok, so it never reached the owner's OpenCode Go model either way.
- **A bad `callThinking`** now stops the call as it starts, where it refused each message.

**The real calls,** on dev, with Bob on OpenCode Go's `deepseek-v4.1-flash`, ElevenLabs Scribe and Flash v2. Headless Chrome's microphone played the owner's three lines in ElevenLabs' Sarah: at 6 seconds, at 21, and at 78.
- **Call 20, after the fixes:**
  - "Let me look." came 5.2 seconds after the owner's first line.
  - One `herdr_agents` call, then a subagent, "Lab status detail", and the answer by 27.6 seconds, after the owner's second line had ended.
  - The joke, while the subagent worked.
  - The report, spoken until the owner's goodbye cut it off, which was logged.
  - "Alright, labs quiet …" 3.6 seconds after the goodbye, then `phone_hang_up`.
  - Its pill holds Bob's summary, in context.
- **In the main chat, then on the next call:** asked "what did we talk about on the last phone call", Bob answered from the pills. On call 21, he recapped call 20.
- **Call 21's summary** put the main chat's check question into the call. The ask now says to keep to the call.

**Wiring checks,** on the disposable check fxbot with fake voices and the mock model, all passing:
- core pills;
- the call (22 checks), a room's call (11), the page in Chromium on a desktop in light and a phone in dark;
- answers held while the owner is mid-words;
- phone-v2's checks c1–c5, c7, c8, c10–c15.

c9's four failures are its voice expectations from phone 0.1. A bot's voice is phone's speaker's since 0.2.0, and the committed phone before phone-v3 fails them the same way.

**Not checked here:**
- Speakers and the watch, for false cuts.
- Flash v2's line, by ear.
- Subagents' own steered messages.
- A phone-line call carried by SignalWire with a session of its own, past phone-v2's line checks.
