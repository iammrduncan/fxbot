# chat-rooms

A plugin for [fxbot](https://fxbot.sh): rooms where several of your bots talk with you, and with each other.

- **Rooms** in the sidebar lists your rooms, each with its bots' avatars. **+** makes one: name it, and pick its bots. The first one leads.
- **Tagging:** in a room, `@` lists its bots and **Everyone**. A pick becomes a chip with the bot's avatar.
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

The room's header leaves a place, `chat-rooms.room-header`, which a plugin fills with `app.slot`; each part gets `room`. The [computer](../computer/) uses both, for a room's computer. On fxbot 0.4, which has neither, the room works as in 0.2.0.

## Files

| File | What it is |
| --- | --- |
| `plugin.json` | Its name, version, and parts |
| `package.json` | What the page is built from, ProseMirror, and `"type": "module"` for the server code |
| `fxbot/server.ts` | Its routes, under `/api/plugins/chat-rooms/`, who answers, the queue and its limits, Stop, and what a bot is sent |
| `fxbot/mentions.ts` | The mention token, `<@bot:id>` or `<@all>`, and `@Name` to token and back. The page and the server share it |
| `fxbot/migrations/` | Its tables, in the schema `plugin_chat_rooms` |
| `fxbot/page.jsx` | The sidebar group, the room screen, and its settings |
| `fxbot/composer.jsx` | The message box: ProseMirror, the `@` list, and chips |
| `fxbot/faces.jsx` | A mention's chip, and a room's bots, stacked |
| `fxbot/page.css` | The box's, the chips', and the stacks' styles, and ProseMirror's |
| `fxbot/page.js` | The page, built |
| `fxbot/page-licenses.txt` | The licenses of the packages `page.js` bundles |
| `skills/` | `chat-room`, `room-handoff`, and `room-lead` |

## Build the page

`page.js` is `page.jsx` bundled with [rolldown](https://rolldown.rs), which comes with fxbot's packages. It's built without comments: ProseMirror's are long, and `page.jsx` keeps the plugin's own. Run these in this folder, in a checkout of fxbot, after changing the page or `package.json`:

```sh
npm install
npx rolldown fxbot/page.jsx --format cjs -e react -e react/jsx-runtime -e @fxbot/app --no-comments --file fxbot/page.js
```

React and `@fxbot/app` stay out of the bundle: the page hands over its own. When the bundled packages change, write `fxbot/page-licenses.txt` again from their `LICENSE` files.
