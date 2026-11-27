# Chat rooms v2: a room is a bot chat with several bots, and its calls work like one

A room looks and works like a bot's own chat, with several bots in it. A room's call works like a call with one bot, goodbye included.

- **The same chat:**
  - **Replies:** each one shows its thinking, its tool calls with their views from plugins, cards, and folds, under the bot's face and name.
  - **What the owner sent:** files, skill chips, and plugins' tags.
  - **Around the chat:** pills with their plugin's icon, summaries, Copy and Retry, older messages loading as you scroll up, and the chat's own scroller.
- **The same box:** `@` to tag, plus `$` for a skill, files to attach, drafts kept, **Make the box tall**, Stop, and the controls plugins put beside the paperclip.
- **A side panel,** as a bot's chat has: the room's bots, its memories and settings, and each bot's own panel parts, such as its computer and subagents.
- **Plugins' places reach a room:** what a plugin puts in a bot chat's header, above its box, or beside its paperclip shows in a room too, with no room twin of its own.
- **A room's call:**
  - **Goodbye:** say goodbye, and the lead says goodbye and hangs up, as Bob does on a call of his own.
  - **The quick word:** "Let me check." before a tool, and "Still working on it." while one runs.
  - **No interruptions:** no answer said over the owner while they're still talking, and no hanging up on quiet while a bot works.
  - **The call's chat** is the call room itself, opened beside the room.
  - **A phone line:** the room can be called on one, now that phone carries its own audio there.

Status: planned on 2026-11-27 at the owner's word, not built.
- **fxbot:** a bot's chat and a room were compared feature by feature on 2026-11-27 at `2baf293`, from the code, read-only.
- **References:** each one in the [research directive](../research-directive.md) with a repository was cloned and searched on 2026-11-27, OpenMausBot most closely.
- **Products:** text products were read on 2026-11-27 (ChatGPT group chats, Copilot Groups, Teams, Slack, Character.ai, LobeHub, Open WebUI, Microsoft Agent Framework and AutoGen, LangGraph, and the OpenAI Agents SDK). So were voice ones: Pipecat, LiveKit Agents, OpenAI Realtime, ElevenLabs Agents, Vapi, Retell, and Hume.
- Nothing of it has run.

## What the owner asked

- "chat rooms should really support and look like individual bot chats just with multiple bots... It shoul support all features of main bot threads too (pills, side bars, skills, etc...)" (2026-11-27)
- On a room call: "I did a room call and it was better. but when I said by it didn't hang up like a single bot call does. Go ahead and plan out the phase for better room-multibot-calls and chat-room-like-bot-chats..." (2026-11-27)

## 0. Core or plugin

**The chat-rooms and phone plugins, with small additions to what core gives plugins.**
- **A room stays chat-rooms':** its own timeline of messages, its bots' sessions, who answers, tags, and start-overs.
- **A room call stays phone's.**
- **Core already draws a bot's chat.** It gives plugins the parts it's built from, rather than plugins copying them, as the conventions ask ([Core or plugin](../../CONVENTIONS.md#core-or-plugin)).
  - **What's given today:** `ui.Reply` and `applyLine`, enough for a turn's steps. Phone's call chat already draws a session with them.
  - **What isn't yet:** the timeline, the box, the panel, and places that know a room.

**What core adds,** each additive, so no line in `plugin-breaks.json`:
- **`ui.Thread`,** the chat's timeline, taking turns from several bots: each turn may name its bot, and a speaker's face and name show where the speaker changes.
- **`ui.ChatBox`,** the chat's box, taken out of `app.tsx` as a component: skills, files, drafts, tall, Stop, the composer places, and the format bar. A plugin gives it the skills, a draft key, and what sending does, and may put its own box in it, as the `@` box.
- **`ui.SidePanel`,** the bot panel's frame: resizable on a computer, a sheet on a phone. Plus `ui.BotParts`, the parts plugins put in a bot's panel, for one bot.
- **Room-aware places:** `composer`, `chat`, `header`, and `botPanel` parts get `{ bot, room }` in a room, `room` being `{ id, name, bots }`.
- **A route with `beside` may open beside another,** so a call room opens beside its room.
- **The drawing parts** behind those: `Said`, `TurnReply`, `Files`, `Handoff`, `CopyButton`, and `PillEntry`, exported for the plugins that need them.

**No migration in core, and no server change.** Chat-rooms adds a migration of its own.

## 1. Research

### fxbot today

A room is drawn by chat-rooms' own page, close to a bot's chat but its own copy, and much is missing. Each feature, with where it lives, is in the notes this plan was written from.
- **Replies are text only.** The room reads only a turn's `text_delta` lines (`plugins/chat-rooms/fxbot/server.ts:441-446`), so no thinking, tool calls, plugin tool views, cards, or folds reach it.
  - **Text across a tool call** is joined with nothing between: "Let me check.The build…". That also breaks phone's sentence split on a room call.
- **Nothing links a room message to the turn that wrote it.**
  - Each bot has its own session in a room (`sessions`: `room`, `bot`, `session`, `cursor`, `seen`).
  - The turn's id (`server.ts:404`) isn't kept on its message.
  - A start-over deletes the sessions' rows (`server.ts:502, 550`).
- **The room's stream** sends its whole table on every connect, with no cursor. Each reply is its whole text so far.
- **The box** is chat-rooms' own ProseMirror box (formatting since 0.6.0). It has no `$` skills or chips, files (the post route takes text), drafts, tall, or composer places. `/` lists only `/fresh`: there's no `/compact`.
- **Around it:**
  - There's no side panel, so the computer's and subagents' panel parts never show in a room, and no library.
  - `app.header`, `app.chat`, and `app.composer` parts don't reach a room. Phone, the computer, and permissions each add a room twin through a `Slot`.
  - The sidebar entry has no preview, pin, or menu.
- **The timeline:**
  - The owner's bubbles have no files, skill chips, or plugins' `said` tags.
  - There's no Copy, and Retry only puts a failed send back in the box.
  - Pills are redrawn without their plugin's icon.
  - Everything loads at once, with no paging.
  - A message sent while a bot is answering replaces the queue rather than reaching the running turn.
- **A room call's "bye"** didn't hang up, for three reasons, all in the plugins:
  1. **The room call's note** (`plugins/phone/fxbot/call.ts`, `roomCallNote`) has no goodbye line, where a one-bot call's says "When they're done, say goodbye and use phone_hang_up".
  2. **The call can't see turns:** `phone_hang_up` hangs up once the turn that called it ends, which phone sees in the bot's session stream (`read()`). A room call follows the room's events instead, which carry no turns, so it waits for the 60-second fallback.
  3. **Phone may be off** for a member, which then gets no call note and can't hang up: `talk()` checks only a one-bot call's bot (`plugins/phone/fxbot/server.ts`).
- **A room call against a one-bot call:**
  - **No tools in sight,** for the same reason as the goodbye: no "Let me check." before a tool and no "Still working on it.". The idle goodbye can hang up while a bot works.
  - **Answers aren't held** while the owner is still talking (`!o.room`, `call.ts`).
  - **The call's chat beside** is phone's plain text copy of the call room.
  - **No phone line.** Built since, with phone-v2's part 2 on 2026-11-27: one call path serves both, so a room's phone has **Call me**, through the default carrier.
  - **The summary isn't retried.**
- **Already alike:** voices for each bot, cut-in, the thinking level, the pill after, the bar's subagents, and the recap of what came before.

### The references

- **OpenMausBot** (`milind-soni/OpenMausBot` at `54ab8e3`) does most of this phase, and is the one to follow:
  - **A group is drawn with the one-bot chat's rows** (`src/components/GroupView.tsx` 140-300): tool runs, cards, compaction chips, and a streaming live row.
    - Each row carries `from: { botId, name, color }`.
    - A new cluster starts when the speaker changes (line 230), under a label with the face, the name in the bot's color, and "→" whoever it's addressed to (`RoomClusterLabel.tsx`).
  - **Who answers is a room setting** (`src/lib/room-responder.ts`): the lead, everyone, only when mentioned, or Auto. Auto is a small classifier with a 1.5 s limit and a 0.6 floor, falling back to the lead (`server/decider/room-routing.ts`).
  - **Speakers take turns, and the room says so:** "Queued · waiting for {name} ({position} of {of})" (`server/room-queue.ts`). A message typed while a bot speaks reaches that bot only if it names it, or names no one and the bot leads (`server/room-steer-addressee.ts`).
  - **Room calls** (`src/components/GroupCallView.tsx`, `src/lib/group-call.ts`):
    - They're half-duplex, each reply in its bot's voice.
    - A name at the start, "everyone", or a spoken `@Name` addresses a bot.
    - The bar says who's speaking and who's working.
    - A cut-in empties the queue and stops the room's turn.
  - **Hanging up a live call** (`server/live-call.ts` 211-230, `live-call-controller.ts`):
    - The owner's whole utterance must ask, "hang up" or "end the call", perhaps with "okay", "bye", or "thanks". A bare "bye" isn't enough.
    - Then one goodbye, and the line closes 4 s later.
  - **The call's record:** one row, "Call with Ada · 1:42", with its steps and approvals.
- **OpenBot** (`CopilotKit/openbot`, server code in OpenDuet's copy): its group view is "Not the CopilotKit chat", text only, polled every 1.5 s. That's what this phase moves away from. Its bots each keep their own thread, and runs of tool calls fold into one line.
- **eve** (`vercel/eve`):
  - A bot that passes leaves no trace (`status: "deferred"`).
  - A reply posts only if nothing came after what the bot read (`reply` with `after`).
  - Bots don't answer a bare acknowledgement.
- **Pi** (`earendil-works/pi`) matches a bot's name anywhere but not as a possessive ("Pi's"). In its voice room only a mention interrupts.
- **fx0 and Pi** fold tool runs. Questions and approvals never fold.
- **Hex** records a meeting as separate tracks, and merges a speaker's lines within 3 s in its transcript.
- **Grok Bot** keeps approvals, drafts, and bot-to-bot messages out of groups.
- **Nothing on rooms** in durable-harness or agent-browser.

### Products

- **Several agents in one conversation:**
  - ChatGPT group chats and Copilot Groups have one assistant with several people, not several bots.
  - LobeHub, AutoGen's selector, and Microsoft Agent Framework let a supervisor model pick each speaker. That costs a request and a wait each turn.
  - Research finds models poor at telling who's addressed: GPT-4o near chance, with only about 20% of turns naming anyone (Inoue, 2025).
  - Microsoft Agent Framework filters "function calls, function results, approval payloads" out before passing a turn to the next agent: bots see each other's words, not their tools.
- **Voice:**
  - Pipecat, LiveKit Agents, ElevenLabs, Vapi, and Retell hand on with a deliberate tool, `transfer_to_agent(agent, reason)` or the like.
  - They warn against ending a call on a bare "bye" (Vapi), wait for the goodbye to finish speaking before cutting the line (LiveKit, Retell), and check in on silence before a goodbye, pausing the timer while the agent works.
  - None puts several voiced agents with real tools on one live call, answering in turn. fxbot's room call already does.
  - A speech-to-speech model can't change voice after its first audio (OpenAI Agents SDK), so room calls stay text in the middle, as they are.

## 2. Key takeaways

1. **Draw a room with the bot chat's own parts,** each turn under its speaker, the face and name only where the speaker changes (OpenMausBot). A separate, simpler room view is what this phase removes.
2. **The room's table stays the timeline;** each bot message gains its turn's parts. A turn's lines go to the page as they come, and its parts are kept when it ends. Notes, summaries, pills, and plugins' messages live only in the room's table, so making the room a set of sessions that core shows would cost more for the same result. Keeping the parts at the turn's end opens no reader as a turn starts, which caused the ConflictingIdentity failures in phone-v3.
3. **Bots see each other's words, not their tools,** as now. Only the page shows a bot's tools.
4. **Core gives the parts, plugins compose them.** `Thread`, the box, the panel, and room-aware places, with none of them knowing about rooms beyond a `room` prop.
5. **Hanging up is the lead's, as it's the bot's on a one-bot call:**
   - The room call's note says to say goodbye and use `phone_hang_up`, and phone hangs up once that turn's words have played.
   - No bare "bye" matching in code, as every source warns.
6. **A room call needs the room's turns:** which bot's turn is running, its tools, and its end. That gives back the goodbye, the quick word, "Still working on it.", and the idle guard.
7. **Who answers stays the owner's setting.** No model picks the speaker, given the cost and how poor models are at it.

## 3. Implementation

### Core: the parts a room composes

- **`ui.Thread`** (`packages/ui/src/app.tsx`'s `Thread`, made exportable):
  - It takes `turns` and an optional `who(turn)` that names a turn's bot. Where the speaker changes, a turn's reply shows that bot's face and name in its color; with no `who`, it's a bot's chat as now.
  - It keeps its folds, pills, scroll anchors, and paging.
  - A room's notes and summaries are entries in the same list, drawn by `Handoff` and a note row.
- **`ui.ChatBox`** (`app.tsx` 944-1018 as a component of its own, which the bot's chat uses too):
  - It takes `skills`, a draft key, `onSend(text, files, skills)`, `running` with `onStop`, a placeholder, and an optional `box`.
  - It brings the `$` list and skill chips, attachments by picker, paste, and drop, drafts, **Make the box tall**, Stop, the format bar, and the composer places.
  - `useSkillPicker` takes a skills source in place of one bot's id.
- **`ui.SidePanel` and `ui.BotParts`:**
  - **`ui.SidePanel`** is `bot-panel.tsx`'s frame: resizable on a computer, a sheet on a phone.
  - **`ui.BotParts`** draws every plugin's `botPanel` part for one bot.
- **Room-aware places:** `composer`, `chat`, `header`, and `botPanel` parts get `{ bot, room }` in a room.
  - `bot` is the room's lead, or the bot a part is about.
  - `room` is `{ id, name, bots }`.
  - A part that ignores `room` behaves as in a bot's chat.
  - The room twins in phone, the computer, and permissions go, each plugin raising its `minFxbot`.
- **Beside:** `beside.tsx`'s two refusals of a route with `beside` go, so a call room opens beside its room.
- **The drawing parts:** `Said`, `TurnReply`, `Files`, `Handoff`, `CopyButton`, and `PillEntry` move out of `app.tsx` and onto `ui`.

### Chat rooms 0.7.0: a room drawn as a chat

- **Each message's turn** (`migrations/0007_turns.sql`):
  - A bot message gains its `session`, its turn's `turn` (messageId), and `parts` (jsonb): its thinking, its tools with their input and output, and its text, as `applyLine` builds them.
  - The parts are kept at the turn's end.
  - Older messages keep their text, and show as now.
- **The stream:**
  - The running turn's lines go to the page as they come, as `{ type: "line", bot, line }` events.
  - The page folds them with `applyLine` into the turn being written. A message's kept parts draw it after.
  - Text across a tool call joins with a blank line, as core joins it.
  - The stream takes a `cursor` (the last message id seen), so a reconnect sends only what's new, and older messages load in pages as you scroll up.
- **The page:**
  - `ui.Thread`, with `who` naming each message's bot. The owner's messages draw with `Said`, with files, skill chips, and plugins' tags.
  - Pills draw with `PillEntry`, with their plugin's icon. Copy and Retry work as in a bot's chat.
  - The queue line, such as "Mr Robot is next", stays above the box.
- **The box:**
  - `ui.ChatBox`, with chat-rooms' `@` box inside it.
  - **Skills:** the `$` list has every skill any of the room's bots has. A picked skill goes with the message to each bot it wakes that has it.
  - **Files:** the post route takes files and passes them on to each bot it wakes, with `fx.chats.send`.
  - **Drafts** are kept by room.
  - **`/`** lists `/fresh` and a new `/compact`, which summarizes each bot's room session and carries on from it, as idle compaction does now, at once.
- **A message while a bot answers:**
  - It joins that bot's running turn if it tags that bot, or tags no one and that bot leads, as OpenMausBot does.
  - Otherwise it replaces the queue, as now.
- **The side panel:**
  - **Room:** the bots, with each one's line and **Remove**, the room's memories, and its settings (who answers, the reply limit), in place of the Memories and Edit dialogs.
  - **One tab for each bot,** with that bot's `ui.BotParts`, such as its computer and its subagents.
- **The sidebar entry** gains the last message's start, a pin, and a menu with **Rename**, **Settings**, and **Delete**.
- **Pills from core:** `fx.chats.pill` on a room session puts the pill in the room.

### Phone: a room's call like a bot's

- **The note:** `roomCallNote` says, as `callNote` does, "When the owner is done, the lead says goodbye and uses phone_hang_up", with the greeting quoted.
- **Turns in a room call:** chat-rooms' events now carry each turn's lines (`{ type: "line", bot, line }`), so a room call follows its turns as a one-bot call does:
  - **Hang-up:** `phone_hang_up` hangs up once that turn's words have played.
  - **"Let me check."** on a tool started before a word.
  - **"Still working on it."** while a tool runs.
  - **The idle goodbye** waits while a turn runs.
- **Answers are held** while the owner is mid-words, as on a one-bot call.
- **Checks when a call starts:** a room call checks that phone is on for each of the room's bots, and says which isn't.
- **The call's chat beside** is the call room itself, as a room beside its room. Phone's own copy goes.
- **The summary** is asked again once if it doesn't come, as on a one-bot call.
- **Call me for a room:** the room's call menu offers **Call me** too, a room call over the phone line through phone's softphone. Built with phone-v2's part 2 on 2026-11-27, since a room's call and a bot's take the same path; untried on a real call.

### What the owner sees

- **In a room:** the same chat as a bot's, with each reply under its bot's face and name, its thinking and tools folded, and the same box. The panel on the right has the room and each bot.
- **Each plugin's parts** show in rooms by themselves: the computer's button beside the paperclip, permissions' cards above the box, and phone's call menu in the header.
- **On a room's call:** "Let me check." before a tool, "Still working on it." during one, and no answer over the owner. "Okay, bye" gets one goodbye from the lead, then the call ends.

### Docs, when it's built

- **[Talk with several bots in a room](../../packages/website/src/content/docs/docs/how-to/talk-in-a-room.md):** the chat, the box, the panel, `/compact`, and calls, goodbye included.
- **[The plugin API reference](../../packages/website/src/content/docs/sdk/reference/plugin-api.md):** `ui.Thread`, `ui.ChatBox`, `ui.SidePanel`, `ui.BotParts`, the drawing parts, `room` on places, and a beside route opening beside.
- **The READMEs:** chat-rooms', phone's, and those of each plugin whose room twin goes.
- **`CHANGELOG.md`:** under `## Unreleased`, chat-rooms' migration and its new `minFxbot`.
- **The README's Phases:** this entry, and this doc's "What the build changed".

### Size

- **Core:** about 300 lines.
  - Most of it moves out of `app.tsx` rather than being new: `ChatBox` 180 and the rest 40.
  - New: `Thread`'s speakers 40, places' `room` 30, `SidePanel` and `BotParts` 30, and beside's 5.
- **Chat rooms:** about 450 lines changed, with about 250 of the page's own copies taken out:
  - turns and parts, 120
  - the stream's lines and cursor, 80
  - the page on `ui.Thread`, `ui.ChatBox`, and the panel, 150
  - the post route's files and skills, 40
  - `/compact`, 30
  - the steering rule, 30
- **Phone:** about 120 lines. The note 5, following room turns 60, holding 10, checks 10, the summary's retry 15, and Call me for a room 20. Its room copy of the call's chat, about 120 lines, goes.
- **Computer, permissions:** about 20 lines each, their room twins replaced by `room` on places.

### Not in this phase

- **A model that picks who answers:** OpenMausBot's Auto. Who answers stays the owner's setting.
- **Each bot answering in its own part of the screen:** that's comparing, not a conversation.
- **Bots reading each other's tool calls.**
- **A full-duplex room call** with a speech-to-speech model.
- **Approvals by voice:** they stay on the screen.

## 4. Checklist

- [ ] **Core's parts,** each checked in a bot's chat first, unchanged:
  - [ ] `ui.Thread`, with and without `who`.
  - [ ] `ui.ChatBox`: skills, files, drafts, tall, Stop, and the composer places.
  - [ ] `ui.SidePanel`, `ui.BotParts`, and the drawing parts.
  - [ ] `room` on the four places, ignored by a part that doesn't read it.
  - [ ] A beside route opening beside one.
- [ ] **Chat rooms 0.7.0** on the disposable check fxbot, in Chromium, desktop light and phone dark, with two mock bots:
  - [ ] A reply shows its thinking and tools, a plugin's tool view, and a card, folded. Text across a tool call has its break.
  - [ ] A message's kept parts draw after a reload, and older messages before 0.7.0 still show as text.
  - [ ] A reconnect sends only what's new, and older messages load as you scroll up.
  - [ ] The owner's message with a file and a `$skill`: each woken bot gets the file, and the skill if it has it.
  - [ ] Drafts kept, tall, Stop, `@` chips, `/fresh`, and `/compact`.
  - [ ] A message tagging the bot that's answering joins its turn. One tagging another waits.
  - [ ] The panel: the room tab, a bot's tab with the computer's and subagents' parts.
  - [ ] The sidebar's preview, pin, and menu.
  - [ ] A pill from a plugin with its icon, and `fx.chats.pill` on a room session.
  - [ ] Phone's call menu, the computer's button, and permissions' cards in a room, with their room twins gone.
- [ ] **A room's call,** on the check fxbot with the fake voices and the mock model:
  - [ ] "Okay, bye": the lead's goodbye plays, then the call ends, well within the 60 s fallback.
  - [ ] "Let me check." before a tool, and "Still working on it." during one.
  - [ ] No answer over the owner mid-words, and no idle goodbye while a turn runs.
  - [ ] A bot phone is off for: the call says so.
  - [ ] The call room opens beside the room.
  - [ ] The summary asked again once.
- [ ] **On dev, with the owner's bots,** a real room call: the goodbye, the quick word, and the room drawn as a chat. The owner's to try too.
- [ ] **Call me for a room** on the owner's phone line: built with phone-v2's part 2 on 2026-11-27. The owner's to try.
- [ ] The docs listed above.
- [ ] The repo checks:
  - [ ] `npm run typecheck`, `npm run build`, `npm run build-site`, and `git diff --check`.
  - [ ] Each plugin's `page.js` rebuilt and committed.
  - [ ] Core, chat-rooms, phone, and the twins' plugins committed each on its own on the open release branch.
- [ ] Dev updated: each plugin's files landed in one write with no call on, the API restarted, and `npm run build` for web pairing.

## 5. Open questions

- **Who answers a plain message.** Today it's the lead, or everyone in order. Add "Only when mentioned", as OpenMausBot has, for a room where bots shouldn't speak unasked? Recommended: yes, a third choice, cheap.
- **A `$skill` in a room.** Should a picked skill go to each bot it wakes that has it (recommended), or only to the lead?
- **A message while a bot answers.** Should it join that bot's turn when it tags that bot, or tags no one and the bot leads (recommended, as OpenMausBot)? Or always wait for the queue, as now?
- **Hanging up.** Should the lead decide, as Bob does on his own call, from a note saying to say goodbye and hang up when the owner's done (recommended)? Or should phone also end the call on a whole utterance like "okay, hang up" or "end the call", with no bot turn? No source matches a bare "bye".
