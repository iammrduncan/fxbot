# A room's context

A chat room keeps its context in check the way a bot's own chat does:
- **Idle compaction reaches rooms.** A long room that has sat idle is summarized while the owner is away, and its bots go on from the summary and the room's last messages, so the next message starts fast. The room shows **Compacted while idle**, which opens to the summary.
- **`/fresh` works in a room.** The owner types `/fresh` and what comes next. The room's bots stop, the room is summarized toward what the owner wrote, and they go on from that: **Started over**.
- **One control for every chat.** Rooms follow **Settings** › **General** › **Idle compaction** and **Summarize with**. Off is off everywhere.
- **History finds room messages and says where they came from.** `chat_history` already searches a bot's room sessions. A match from a room now says so, and a room's summary points the bots at it.

Status: built on 2026-11-13, for 0.10.0, with chat rooms 0.5.0. Planned that day, for the release after 0.10.0, and the owner answered the recommendations with "yeah do that": the whole room starts over, rooms follow the one setting, and `chat_history` is enough. Then the owner set the goal to build it before 0.10.0 was cut, so it's in 0.10.0. The core fix found here, a bot's own chat summary reaching its rooms, was built the same day (`0666cc1`). Planned:
- against the chat rooms plugin 0.4.0 and fxbot at `0666cc1`
- against libfx 0.0.16 as installed, and the [idle compaction](idle-autocompaction.md) and [/fresh in core](fresh-in-core.md) phases' reading of fx's source
- against OpenClaw at `56eb6f3fe` (2026-11-11) and Hermes Agent at `e7212db2` (2026-11-11), from their docs

## What the owner asked

On 2026-11-13, while 0.10.0 was being readied: "figure out how we do idle compaction, `/fresh`, chat history lookup etc for chat-rooms... Those should have similar mechanisms for control etc."

## 0. Core or plugin

**The chat rooms plugin,** with one small read-only addition to the plugin API, and one small change to `chat_history` in core.

A room's transcript, its turns, its sessions, and its page are the plugin's ([Core or plugin](../../../CONVENTIONS.md#core-or-plugin)). It already has what a start-over takes: the whole room in its own table, `fx.models.ask` for a tool-free summary, `fx.chats.newSession`, and its `instructions` hook. What it can't read is the owner's idle compaction setting, which lives in core's settings. So core gives plugins that setting, read at each use, as it gives them the time zone.

Core doesn't learn to start a plugin's session over. That was weighed ([Key takeaways](#2-key-takeaways)) and costs more.

## 1. Research

### fxbot today

- **A room turn** (`plugins/chat-rooms/fxbot/server.ts`):
  - The owner's message goes into the plugin's own `messages` table, and the bots it wakes answer one turn at a time (`:467-485`, `drain` at `:351`).
  - Each bot has one session per room, made with `fx.chats.newSession(bot)` and kept in the plugin's `sessions` table, with `seen`, the last message it was sent (`:233-246`, `migrations/0001_rooms.sql`). A new one is made only on the bot's first turn there, or when a provider switch makes the old one answer 409 (`:276-282`).
  - It's sent the room's lines since `seen`, at most the newest 40 within 24,000 characters (`:25`, `since` at `:210-227`). A new session gets "The room so far", the room's recent lines, and `$chat-room`.
  - Core adds the bot's instructions, memories, the team's, and its skills (`packages/sdk/src/index.ts:347-363`), and the plugin's hook adds the room's line and its memories (`server.ts:97-113`).
  - Core records the prompt, the reply, and the thinking and tool steps in core's `messages`, under the room session. The plugin saves the reply in its own table too.
- **Nothing trims a room's sessions.** Each turn adds up to 24,000 characters, the reply, and tool steps, for weeks.
  - Idle compaction sweeps only a bot's own chat, `profiles.session_id` (`index.ts:678-680`). Its phase left plugin sessions out on purpose.
  - Only libfx compacts a room session, near 80% of the model's input, inside a turn the owner waits on, one bot after another. It keeps user messages word for word, and a room's prompts are user messages, so it shrinks them little ([idle compaction](idle-autocompaction.md#libfx)).
- **`/fresh` does nothing in a room.** Core acts on it only in a bot's own chat, `!session && !from` (`index.ts:836`), and a hook's `startOver` only there too. The room posts "/fresh …" as written, and the bots read it. The `/fresh` build checked that on purpose.
- **`chat_history` works from a room.** It's in every session, finds the bot from the session, and searches all of the bot's sessions (`packages/sdk/src/history.ts:121-155`). But:
  - A match from another session says "(earlier chat)", whether it's the bot's own earlier chat or a room (`history.ts:155`).
  - It reads only core's `messages`, so it misses room lines the bot was never sent.
- **The owner has no control over a room's context.** **Edit** sets the name, bots, order, what an untagged message does, and replies per message; there's **Memories**, **Stop**, and **Delete**. Only deleting a room starts it over.
- **Found here and fixed for 0.10.0:** core put the bot's own chat's summary, its `handoff`, in every session's instructions, rooms', routines', and subagents' too. With idle compaction, each room got a summary of the bot's private chat, and read its whole context again whenever it changed. Now only the bot's own chat gets it (`0666cc1`).

### libfx

- **No compaction call for a host.** 0.0.16's `FxSession` has `prompt`, `resume`, `stream`, `steer`, `cancel`, and `checkpoint` (`types/libfx.d.cts:865-888`). So every start-over is a new session plus a summary, as core's is.
- **A plugin can't read a checkpoint.** A room's summary is written from the room's own text, without the bots' tool results. Core's own summary falls back to the stored transcript the same way when it has to.
- **A session belongs to its provider.** After a provider switch, the old session answers 409, and the room already makes a new one (`server.ts:276-282`).

### Other assistants

- **OpenClaw** gives each group chat a session of its own (`session.groupScope: "per-group"`, the default), and keeps groups and DMs apart both ways: "replies in those conversations do not receive private transcript context" (`docs/concepts/session.md:191-250`). `/new` and `/reset` work in any chat. Automatic resets are off by default, and can be set per chat type, such as `resetByType.group: { mode: "idle", idleMinutes: 120 }` (`:263-313`). "The message that triggers an automatic reset continues in the new conversation."
- **Hermes Agent** gives each person in a group a session of their own by default, or one shared "room brain" with `group_sessions_per_user: false`, which "shares token costs, interrupt state, and context growth" (`website/docs/user-guide/sessions.md:1054-1074`). `/compress` and `/new` work in gateway chats, groups too. A compression starts a continuation session (`:337-339`). Time-based resets moved out of core to a plugin (`:1076-1084`).

## 2. Key takeaways

- **Both references treat a group like a chat:** the same reset and compaction commands work there, and a group's context is kept apart from the owner's private one. fxbot's rooms should do the same, and now keep the private summary out.
- **One summary per room, not one per bot.** Every bot in a room was sent nearly the same transcript. A core start-over for each plugin session would write one summary per bot over it, and need a handoff per plugin session in core.
- **Start bots over lazily.** Dropping the room's session rows makes each bot's next turn make a new session, with "The room so far" and the summary, through code the room already has. A bot that never speaks again costs nothing.
- **One setting.** The owner already has one control for idle compaction. A room setting of its own would be a second place to look.
- **The owner's message wins,** as in a bot's chat: a summary still being written when a message comes is dropped.

## 3. Implementation

### Core: the setting, for plugins

- `fx.compaction()` answers `{ idleMinutes, provider, model }`: Settings' `idleCompactMinutes`, `compactProvider`, and `compactModel`, read at each use, as `fx.timeZone()` is (`packages/sdk/src/plugin-api.ts:166-167`, `index.ts:220`). `idleMinutes` is 0 when it's off.
- It only adds to the plugin API, so it needs no `plugin-breaks.json` line. A line under `## Unreleased`'s **For plugins**, and a row in `plugin-api.md`.

### Core: where a match came from

- `chat_history` says where a match from another session came from: "(earlier chat)" for the bot's own earlier chats, and "(in <plugin>)" for a plugin's session, such as "(in chat-rooms)", from `plugin_sessions.plugin`. Core names no plugin: it reads the name.

### Chat rooms 0.5.0: a room starts over

`startOver(room, kind, ask)`, used by idle compaction and `/fresh`:
1. **The transcript:** the previous summary, if there is one, then the room's lines since it, as "Owner:", the bot's name, and notes left out, the newest that fit 200,000 characters. A room has no model window to read, and 200,000 characters, about 50,000 tokens, fits every model fxbot lists.
2. **The summary:** `fx.models.ask(lead, { instructions, text: ask + transcript, provider, model, timeoutMs: 120_000 })`, with `fx.compaction()`'s provider and model when one is set, else the lead's own. The lead is the room's first bot.
3. **Kept as a message:** author `summary`, its text a heading, then the summary. "Earlier in this room, summarized after 30 minutes idle:" or "Earlier in this room, summarized when the owner started it over:".
4. **Each bot starts over:** the room's rows in `sessions` are deleted, so each bot's next turn makes a new session (`make`, `server.ts:238`), with "The room so far". Their old sessions stay in core, and `chat_history` finds them.
5. **The hook:** for a session of the room, the newest summary goes after the room's line, with "Search earlier messages with chat_history.".
6. **`since` leaves out** `summary` messages, as it does notes, and starts no earlier than the newest summary.

A room starts over once at a time: a message, `/fresh`, or the sweep waits for one already running.

### Idle compaction for rooms

- **A timer in the plugin,** every minute, only while the plugin is added, the first a minute after it loads.
- **It compacts a room when:**
  - `fx.compaction` exists and `idleMinutes` isn't 0
  - the room's newest message is older than `idleMinutes`
  - no turn runs there, and none waits
  - the room's text since its last summary is at least 120 KB, about 30,000 tokens, as core's gate
  - it wasn't tried for that newest message: a failure isn't tried again until a new one comes, as in core
- One room at a time, the longest idle first.
- **The ask** is core's `idleAsk`, worded for a room: "Write a summary of this room's conversation so far, for the room's bots, to carry on after a break. Keep the owner's requests and instructions in their own words, who said what that still matters, what was decided and why, and each open task, who has it, and where it stands. At most 1,500 words." Plugins import only types from the SDK, so the words are the plugin's own.
- **A message that comes meanwhile wins:** `fx.models.ask` takes no signal, so when the summary comes back, it's dropped if the room has a newer message, and the room goes on as it was.

### `/fresh` in a room

- The room's message route takes `/fresh` off the start, as core's `freshCommand` does: `/^\s*\/fresh(?=\s|$)/`.
- It stops the turn running and empties the queue, as **Stop** does, and emits `starting`, so the page shows "Starting the room over…".
- It summarizes toward what follows, with core's `freshAsk` worded for a room, and starts the room over, kind `fresh`.
- Then it posts what follows as the owner's message, and the bots it wakes answer from the summary. With nothing after `/fresh`, the room waits.
- A summary that fails changes nothing, and the room says so in a note: "The room couldn't be summarized, so it goes on as it was."
- **The message box** suggests `/fresh`, "Start the room over toward what you write next", when the owner types `/`, as it suggests bots after `@`.

### The page

- A `summary` message is a folded card in the room, **Compacted while idle** or **Started over**, that opens to the summary, as a bot's chat shows its handoff. Compacted while idle links **Turn off in Settings**.
- The messages before it stay above it.

### Docs

- **The skill `chat-room`:** a room may start over from a summary; search earlier messages with `chat_history`.
- [Talk in a room](../../../packages/website/src/content/docs/docs/how-to/talk-in-a-room.md): a **Start a room over** section, with `/fresh`.
- `bots-and-chats.md`'s **Idle compaction** section: rooms are compacted too, with chat rooms 0.5.0.
- `plugin-api.md`: `fx.compaction()`, since 0.10.0.
- The chat rooms README, the changelog, with **Before upgrading** for chat rooms 0.5.0, and the README's Phases list.

### Not in this phase

- **A room's own setting, or one per room.** Rooms follow the one setting.
- **`/fresh @Bot`,** one bot starting over. The whole room starts over.
- **A room-only history tool** over the plugin's table. `chat_history` is enough for now.
- **Loading a room's page in parts.** It loads every message on open (`server.ts:86`). A long room's page grows; that's its own fix.
- **A removed plugin's sessions show as the bot's own earlier chats.** Removing a plugin deletes its `plugin_sessions` rows (`packages/sdk/src/plugins.ts:946`), and `earlier()` shows each session not in that table as the bot's own (`history.ts:174-175`). So after chat rooms is removed, a bot's chat lists its old room turns above its handoff. It's core's, older than this phase, and a fix of its own.

### Size

- Core: `fx.compaction()` and its type, about 10 lines, and `chat_history`'s "(in <plugin>)", about 5.
- Chat rooms: `startOver`, the sweep, `/fresh`, and the hook's summary, about 150 lines of `server.ts`; the card and the `/` suggestion, about 60 lines of `page.jsx`. No migration: the summary is a message.

## 4. Checklist

Against a disposable fxbot, the mock model, and Chromium, with chat rooms from this branch:

- [x] `fx.compaction()` answers Settings' three values, and `idleMinutes` 0 when it's off. `plugin-api.md` lists it.
- [x] `chat_history` from a room marks a match from the bot's own chat "(earlier chat)", and from a bot's own chat marks a room's "(in chat-rooms)".
- [x] A room idle past the setting, with at least 120 KB of text since its last summary, is compacted once: one summary request, on the setting's model, or the lead's. A `summary` message holds it, the room's `sessions` rows are gone, and the room shows **Compacted while idle**, which opens to it.
- [x] Each bot's next turn there makes a new session, sent "The room so far", with the summary in its instructions after the room's line. Its old session is still in core, and `chat_history` finds its messages.
- [x] A short room, a room with a turn running, a room idle less than the setting, and a compacted room with no new message aren't compacted. With **Off**, no room is.
- [x] A message sent while a room's summary is written wins: the summary is dropped, and the room goes on as it was.
- [x] `/fresh plan the trip` in a busy room stops the turn, empties the queue, shows "Starting the room over…", then **Started over** and the owner's "plan the trip", which the lead answers from the summary. `/fresh` alone waits for the next message.
- [x] A summary that fails changes nothing and says so in a note.
- [x] Typing `/` in a room's message box suggests `/fresh`.
- [x] On fxbot without `fx.compaction`, chat rooms 0.5.0 loads, rooms aren't compacted, and `/fresh` works on the lead's model.
- [x] Phone width and light and dark: the card and the suggestion fit, in Chromium and WebKit.
- [x] Typecheck, build, the site, and the rebuilt `page.js` after `npm ci` in `plugins/chat-rooms`. Docs and changelog as above.
- [ ] With a real model, by a person: a long room compacted while idle, and the next message's answer knows what was going on.

## 5. Open questions

Settled on 2026-11-13, with the recommendations:
- The whole room starts over, not one bot.
- Rooms follow the one setting.
- `chat_history` is enough; no room-only tool.
- Built after 0.10.0 is cut. The owner then set the goal to build it before the cut, so it's in 0.10.0.
- Only the bot's own chat gets its summary: built for 0.10.0.

Built with the recommendations, for the owner to revisit:
1. **Should the lead write a room's summary, when Summarize with is each bot's own model?** Built: yes, the room's first bot, since the room has no model of its own.
2. **Should a room's summary leave out what the bots did with their tools?** It has to: a plugin can't read a session's checkpoint, so the summary comes from what was said in the room. Built that way, as core's own transcript fallback does.

## What the build changed

- **The summary card is a native `<details>`.** A plugin's page doesn't get the app's Collapsible, so **Compacted while idle** and **Started over** open with the browser's own marker. Compacted while idle links **Settings**, as a bot's card does.
- **`chat_history` says "(your own chat)"** for a match in the bot's own chat when it's called from a room, or any plugin's session, and "(earlier chat)" only from the bot's own. A match from a plugin's session says "(in chat-rooms)", or that plugin's name. Its description says so.
- **`/fresh` answers at once,** with 202 and `{ starting: true }`, and starts the room over in the background. A message sent meanwhile waits for it. The room's turns stop first, as **Stop** does, and the room waits up to 30 seconds for the one running to end.
- **A summary that fails still posts what followed `/fresh`,** after the note "The room couldn't be summarized, so it goes on as it was", so the owner's words aren't lost.
- **When Summarize with's model fails,** such as one too small for the room, the lead's own model writes the summary, as a bot's own model does in its chat. fxbot's log says so.
- **An empty room starts over with no summary:** `/fresh` there drops the room's sessions, and the next message starts each bot afresh.
- **The list under the message box spans it.** The app's styles have `right-0` but not `left-0`, so the list of bots or commands was as wide as its longest line, from the right edge. `/fresh`'s description pushed it off the screen on a phone. `page.css` sets it, for both lists.
- **No migration:** a summary is a message, with `summary` for its author, and its heading says which kind it is.
- **The checks,** against a disposable fxbot built from this branch, chat rooms 0.5.0, the mock model, and a probe plugin that reads `fx.compaction()`:
  - **`fx.compaction()`** answered 30 minutes and each bot's own model, 0 with **Off**, and the picked provider and model.
  - **`chat_history`,** from a room, marked Ann's own chat "(your own chat)", and from her own chat, the room's matches "(in chat-rooms)".
  - **Idle compaction:** a room with 138 KB of text, idle past 5 minutes, got one summary request and one **Compacted while idle**, and its session was dropped, still in core. A small room wasn't compacted. Ann's next turn there was a new session, with the summary in her instructions, sent the room since the summary and not before. With nothing new, the room wasn't compacted again, and with **Off**, a long idle room wasn't.
  - **The owner's message wins:** with the summary slowed by 30 seconds, a message sent while it was written was answered in the room's session, and the summary was dropped.
  - **`/fresh`** in a room with a turn running stopped it, kept a **Started over** summary asked toward what followed, then posted it, and the lead answered it in 2 seconds. `/fresh` alone kept a summary and posted nothing. A summary the model refused left the room's sessions as they were, with the note.
  - **In Chromium and WebKit,** at a desktop width in light and a phone width in dark: both cards, Compacted while idle opening to the summary and the last messages, its Settings link, `/` listing `/fresh` with what it does, Enter picking it, and **Starting the room over…** while a slowed summary was written. No page errors.
  - **On fxbot 0.9.0,** chat rooms 0.5.0 loaded, `/fresh` started a room over, and a room idle with 138 KB of text wasn't compacted, since 0.9.0 has no `fx.compaction()`.
  - **Not run:** a real model, which is the last box.
