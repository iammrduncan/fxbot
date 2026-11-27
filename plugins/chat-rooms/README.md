# chat-rooms

A plugin for [fxbot](https://fxbot.sh): rooms where several of your bots talk with you, and with each other.

- **Rooms** in the sidebar lists your rooms, each with its bots' avatars. **+** makes one: name it, and pick its bots. The first one leads.
- **Tagging:** in a room, `@` lists its bots and **Everyone**. A pick becomes a chip with the bot's avatar.
- **Formatting,** since 0.6.0, on fxbot 0.12.0 or newer: the box formats as you type, as a bot's chat box does, with the app's ProseMirror and its formatting, and **Aa** beside it opens the format bar. What you sent shows formatted, with its chips. See [Format a message](https://fxbot.sh/docs/how-to/format-a-message/).
- **Who answers:** a message wakes the bots it tags. One that tags no one wakes the lead, or every bot in order, by the room's setting.
- **Handing on:** a reply that tags another bot wakes that bot next. A reply that tags no one ends the round.
- **Limits:**
  - at most 3 bots tagged per reply
  - the room's limit of bot replies to one message, 10 by default: past it, bots stop tagging each other, and the ones already asked still answer
  - **Stop**, which ends the reply being written and drops the rest
- **What a bot is sent:** each bot answers in a session of its own for the room, so a room stays out of the bot's own chat. Each turn it's sent:
  - who it is, and who else is in the room
  - the room's memories
  - what was said since its last turn, the other bots' words quoted
  - who woke it, and the replies left
- **Memories,** since 0.4.0: each room keeps notes of its own, such as what the room is for, what was decided there, and who does what. Every bot in the room reads them there, after its own memories and the team's, and not in its other chats.
  - **Memories,** on a room, lists them, newest first, with who saved each one, and adds, edits, and deletes them.
  - **Bots** save one with `chat-rooms_remember` (with `replaces`, to change one) and remove one with `chat-rooms_forget`, by its `room-mem:<id>`. Each finds its room from the bot's session, so it works only in a room.
  - **Limits:** a memory is at most 1,000 characters, and the newest that fit in 6,000 bytes go to each bot. Saving one that's there answers with it.
  - **Deleting a room** deletes its memories, and removing the plugin removes them all.
- **Starting over,** since 0.5.0, as a bot's own chat does:
  - **Idle compaction:** a room that sits idle past **Settings** › **General** › **Idle compaction**, with at least **Only chats**' size of text since its last summary (120 KB, about 30,000 tokens, on fxbot before 0.11.0), is summarized while you're away. Its lead writes the summary, on **Summarize with**'s model when you pick one. The room shows **Compacted while idle**, which opens to the summary. A message you send meanwhile calls it off.
  - **`/fresh`:** start a message with `/fresh`, and the room stops its turns, is summarized toward what you wrote next, shows **Started over**, then posts the rest. `/` at the start of the message box lists it.
  - **Then** each bot's next turn there starts a new session, sent the room since the summary, with the summary in its instructions. Its earlier sessions stay, and `chat_history` finds them.
  - On fxbot before 0.10.0, which has no idle compaction setting for plugins, rooms aren't compacted while idle. Before 0.6.0, `/fresh` says the room can't be summarized.
- **Skills:** three, `chat-room`, `room-handoff`, and `room-lead`, teach a bot how to work in a room. The room sends `chat-room` with a bot's first turn there, and `room-lead` with the lead's first untagged turn.
- **Edit**, on a room, changes its name, its bots and their order, what an untagged message does, and its replies per message, or deletes it.
- **Order:** drag a room in the sidebar to move it, with a mouse, or with a finger after a moment's hold. On fxbot before 0.7.0, rooms stay in the order they were made.

Add it from **Plugins**, where fxbot's list has it. It runs inside fxbot: read its code there before you add it. Only bots it's on for can be in a room. See [Talk with several bots in a room](https://fxbot.sh/docs/how-to/talk-in-a-room/).

On fxbot 0.4.0, which has neither `fx.chats.cancel` nor `createPortal`:
- **Stop** lets the reply being written finish.
- Chips in the message box show `@Name` without the avatar.

## For other plugins

Since 0.3.0, chat rooms provides, with `fx.provide`, for plugins that name it under `needs`:
- `roomOf(session)`: the room one of its sessions is for, `{ id, name, untagged, replies, members }`, or null
- `rooms()`: every room

Since 0.6.0, for phone's calls in a room and for subagents:
- `post(room, { text, label, note, effort })`: the owner's message, as from a call. The room shows `label` with it, such as "your call". Its bots read `note` and the room doesn't show it. `effort` is how hard the round it starts thinks, on fxbot 0.12.0 or newer.
- `stop(room)`: the room's **Stop**.
- `on(room, listener)`: the room's events, as its page hears them, until the function it answers is called.
- `callRoom(room)`: a call room for the room's call, for phone 0.2.0: a room of its own, with the room's bots and settings, left out of the rooms list. Each bot's first turn there starts with what the room said before the call. Deleting the room deletes its call rooms.
- `pill(room, { label, text, open, inContext })`: a pill in the middle of the room, such as the call's **Phone call · 4 min**, opening `open` beside the room, or unfolding to show its text. In context, each bot's next turn reads it with what was said since.
- `wake(session, { text, label })`: a message from another plugin, such as a subagent's report, into the room whose session that is, under `label`. It wakes the bot whose session it is.

The room's header leaves a place, `chat-rooms.room-header`, which a plugin fills with `app.slot`; each part gets `room`. Since 0.6.0, so does the space above its message box, `chat-rooms.room-box`, where [phone](../phone/) shows a room's call. The [computer](../computer/) uses `roomOf` and the header, for a room's computer. On fxbot 0.4, which has neither, the room works as in 0.2.0.

## Files

| File | What it is |
| --- | --- |
| `plugin.json` | Its name, version, and parts |
| `package.json` | `"type": "module"`, for the server code |
| `fxbot/server.ts` | Its routes, under `/api/plugins/chat-rooms/`, who answers, the queue and its limits, Stop, and what a bot is sent |
| `fxbot/mentions.ts` | The mention token, `<@bot:id>` or `<@all>`, and `@Name` to token and back. The page and the server share it |
| `fxbot/migrations/` | Its tables, in the schema `plugin_chat_rooms` |
| `fxbot/page.jsx` | The sidebar group, the room screen, and its settings |
| `fxbot/composer.jsx` | The message box: the app's ProseMirror and formatting, the `@` list, and chips |
| `fxbot/faces.jsx` | A mention's chip, and a room's bots, stacked |
| `fxbot/page.css` | The box's, the chips', and the stacks' styles |
| `fxbot/page.js` | The page, built, with nothing bundled |
| `skills/` | `chat-room`, `room-handoff`, and `room-lead` |

## Build the page

`page.js` is `page.jsx` bundled with [rolldown](https://rolldown.rs), which comes with fxbot's packages. Run this in this folder, in a checkout of fxbot, after changing the page:

```sh
npx rolldown fxbot/page.jsx --format cjs -e react -e react/jsx-runtime -e @fxbot/app -e prosemirror-model -e prosemirror-state -e prosemirror-view --no-comments --file fxbot/page.js
```

React, ProseMirror, and `@fxbot/app` stay out of the bundle: the page hands over its own, so it bundles nothing of anyone else's.
