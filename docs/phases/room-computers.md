# A room's computer, in the computer plugin

The chat-rooms-computer plugin goes, and the computer plugin gives rooms their computers itself:
- **With chat rooms added,** each room's header has its computer button, as now. Turned on, the room's bots share one computer in that room, taking turns, and keep their own computers for their own chats.
- **Without chat rooms,** nothing about rooms shows or runs.
- **Every room keeps its computer and its files** through the move.
- **The plugin API gets one small addition:** a need that's optional.

Status: planned on 2026-11-12, at the owner's word. Researched the same day, against fxbot's code at `ff25241`, OpenClaw's plugin manifest docs at `56eb6f3`, and Pi's extensions docs at `d78a75e`.

## What the owner asked

"`chat-rooms-computer` plugin shouldn't exist. It should just be part of the computer plugin and activates on chatrooms if they exist. Just like memories v2 did." (2026-11-12)

## 0. Core or plugin

**A plugin: computer 0.5.0, with one small addition to the plugin API.**
- **Computers and rooms are plugins.** The core names neither.
- **In the computer plugin, at the owner's word.** A room's computer is a computer: the computer plugin makes it, keeps its home, and decides which computer each call reaches. Today the last part goes through other plugins' `computerFor`, only because a room's computer lives in a plugin of its own.
- **As [memories v2](../_completed/phases/memories-v2.md) did,** the feature goes in a plugin that's already added, and turns on when rooms exist. Memories v2 put a room's memories in chat rooms, which owns rooms. This puts a room's computer in computer, which owns computers. Either way there's no third plugin, and nothing in core looks for a plugin.
- **The addition: an optional need.** Computer reads the rooms from chat rooms (`roomOf`, `rooms`). `fx.need` gives that only to a plugin that names chat rooms under `needs`, and a need is required:
  - A plugin whose need is missing doesn't load (`packages/sdk/src/plugins.ts:619-620`).
  - A plugin another one needs can't be removed (`plugins.ts:933-934`).

  So computer couldn't run without chat rooms. A need marked `optional` loads without it, and lets it be removed. `fx.need` answers null until it runs, as now.

## 1. Research

### fxbot today

- **chat-rooms-computer 0.1.0:** 84 lines of server, 75 of page, a skill, and a table.
  - **Its table,** `computers (room, key, enabled)`. A room's key is `room-` and 8 hex characters, made the first time it's turned on, and kept, so turning it off and on finds the same home.
  - **What it provides:** `computerFor({ bot, session })`, the room's computer for a room session whose room has it on, and `computers()`, every room's, on or off.
  - **Its hooks:** `instructions` says the computer is shared, and with whom. `message` puts `$room-computer` in a bot's first room turn after the computer is on.
  - **Its routes:** `GET` and `PUT /rooms/:id`, with `{ on }`.
  - **Its page:** a button in the room header's slot, `chat-rooms.room-header`, opening a dialog with a switch and **Open**.
  - **It needs** computer and chat rooms, both required.
- **computer 0.4.0:**
  - **The computer a call reaches** is the one a dependent's `computerFor` names, or else the bot's own (`plugins/computer/fxbot/server.ts:390-401`).
  - **Each computer is labelled** with the plugin that named it, `fxbot.by`, when it's made (`:493`).
  - **`forget()` removes a computer and its home** when its plugin is no longer added, or runs and doesn't list it. It keeps it while that plugin is added but not running (`:438-460`). So removing chat-rooms-computer today deletes every room's computer and its files.
- **chat rooms 0.4.0** gives its dependents `roomOf` and `rooms` (`plugins/chat-rooms/fxbot/server.ts:68-73`), and leaves the `chat-rooms.room-header` slot in the room's header.
- **`plugin-breaks.json`** can mark a plugin, below a version, unsupported since a release (`packages/sdk/src/plugin-fit.ts:25-29`). One from GitHub then doesn't load, and stays added.
- **Essentials** lists both (`packages/sdk/src/plugins-registry.json:2`).

### The references

- **OpenClaw has a soft dependency.** Its manifest's `requiresPlugins` lists "plugin ids that must also be installed for this plugin to have an effect. Discovery keeps the plugin loadable but warns when any required plugin is missing" (`docs/plugins/manifest.md:251`).
- **Pi's extensions declare no dependencies.** They talk through `pi.events.on` and `emit` (`packages/coding-agent/docs/extensions.md:1965-1971`). An extension whose partner isn't loaded hears nothing. One composes with "another extension that already replaced the editor" by keeping what was there (`:3155`).
- **Both let a plugin light up when another is there,** without requiring it. fxbot's `needs` has only the required kind.

## 2. Key takeaways

1. **One plugin per thing, lit by what's there.** The owner asks for it, and OpenClaw's soft dependency does the same.
2. **The smallest addition:** `optional` on a need, read where needs are read now.
3. **Every room keeps its computer.** Copy the keys, adopt the old labels, and order the retirement so nothing deletes a home.
4. **Retire by data:** a break line, and fxbot's list.
5. **`computerFor` stays** for other plugins.

## 3. Implementation

### The plugin API: an optional need

- **A block `{ "optional": true }` under `needs`:**
  - The plugin loads without that plugin.
  - That plugin can be removed. Only required needs refuse a removal.
  - `fx.need` and `fx.dependents` work as now.
  - When both are added, the needed one loads first, as now.
- **An older fxbot reads it as required,** so a plugin that uses it raises `minFxbot` to the release that brings it.
- **`plugin-api.md`,** and `## Unreleased` under **For plugins**.

### Computer 0.5.0

`minFxbot` goes to 0.10.0, and `plugin.json` gets `"needs": { "chat-rooms": { "optional": true } }`.

- **A migration, `0002_room_computers.sql`:**

  ```sql
  -- Each room given a computer: its key, which names the computer and its home, and whether the room uses it now. A
  -- room's computer from chat-rooms-computer, which this replaces, keeps its key, and so its home.
  create table room_computers (room int primary key, key text not null unique, enabled boolean not null default true);
  do $$ begin
    if to_regclass('plugin_chat_rooms_computer.computers') is not null then
      insert into room_computers (room, key, enabled) select room, key, enabled from plugin_chat_rooms_computer.computers
        on conflict do nothing;
    end if;
  end $$;
  ```

- **The server,** moved from chat-rooms-computer, about 70 lines:
  - **A room session's room** comes from `fx.need("chat-rooms")?.roomOf(session)`.
  - **The computer a call reaches:** for a room session whose room has its computer on, the room's computer. Then other dependents' `computerFor`, then the bot's own.
  - **Its label:** a room's computer is labelled `fxbot.by` `chat-rooms`. `forget()` treats that label, and the old `chat-rooms-computer`, as rooms':
    - It keeps a room's computer while `room_computers` has its key and chat rooms lists the room.
    - It removes one whose room chat rooms no longer lists.
    - It keeps them all while chat rooms isn't running, since nothing can tell.
  - **`known(key)`,** for the page and its sockets, finds a room's computer the same way.
  - **The hooks, as they were:** `instructions` for a room session, and `message`, for `event.from === "chat-rooms"`.
  - **Routes:** `GET` and `PUT /rooms/:id`, now under `/api/plugins/computer/`.
- **The skill `room-computer`** moves into computer's `skills/`, as it is.
- **The page:** the room's computer button joins computer's `page.jsx`, in the `chat-rooms.room-header` slot, on computer's routes. Rebuild `page.js`.
- **Its README:** a room's computer. Under **For other plugins**, `computerFor` and `computers()` stay.

### Retiring chat-rooms-computer

- **fxbot's list:** take it out of `plugins` and `essentials`.
- **`plugin-breaks.json`:** `{ "since": "0.10.0", "plugin": "chat-rooms-computer", "below": "1.0.0", "says": "A room's computer is part of the computer plugin since its 0.5.0. Update Computer first, then remove this plugin: each room keeps its computer." }`.
  - While it's **Unsupported** it stays added, so Computer 0.4.0 keeps the rooms' computers. Rooms just don't use them until Computer 0.5.0.
- **The folder:** delete `plugins/chat-rooms-computer/`.
- **The order matters,** and **Before upgrading** says so: update Computer, then remove chat-rooms-computer. Removed first, on Computer 0.4.0, the rooms' computers and their files go, by that version's own rule, which can't change now ([Question 3](#5-open-questions)).
- **The dev app:** take `plugins/chat-rooms-computer` out of its `FXBOT_PLUGIN_DIRS` when this lands.

### Docs

- **`how-to/give-bots-a-computer.md#give-a-room-a-computer`:** no plugin to add, with chat rooms and computer added.
- **The rest:**
  - `how-to/talk-in-a-room.md`'s link.
  - The README and `AGENTS.md` lists, and the screenshots.
  - `## Unreleased`, with the order under **Before upgrading**.
- **`sdk/reference/plugin-api.md`:** `optional` under `needs`.

### Not in this phase

- **Other plugin pairs.**
- **Core detecting a plugin.**
- **A computer for other groups of bots.**

### Size

| Where | Lines, about |
| --- | --- |
| The plugin API: optional needs | 10 |
| Computer: the table, a room's computer, hooks, routes, page, skill | 150, most of it moved |
| chat-rooms-computer, removed | -273 |
| Docs | 50 |

## 4. Checklist

Against a disposable fxbot and the mock model, with the computer's engine as rootless podman, as the computer phase's checks ran. Never load the computer plugin in a check run as root.
- [ ] **Optional needs:**
  - A plugin with an optional need loads without the other, and `fx.need` answers null.
  - Added after, the other is found.
  - Removing the needed plugin isn't refused. A required need still refuses.
- [ ] **Computer 0.5.0 without chat rooms** loads. No room logic runs, its room routes answer "No such room.", and no button shows.
- [ ] **With chat rooms:**
  - The room's header has the computer button, and turning it on makes a `room-` key.
  - A room turn's computer calls reach the room's computer, and the bot's own chat reaches its own.
  - The instructions and the skill go as before.
- [ ] **The move,** on a database where chat-rooms-computer 0.1.0 gave a room a computer, with a file in its home:
  - On fxbot 0.10.0, chat-rooms-computer shows **Unsupported**, and the room's computer is kept.
  - After Computer 0.5.0, the room's key is copied, and its computer and the file are there.
  - Removing chat-rooms-computer then keeps them.
- [ ] **Deleting and turning off:** deleting a room deletes its computer on the next sweep. A room's computer turned off is stopped, and kept.
- [ ] **Removing chat rooms** keeps the rooms' computers, and Computer runs on.
- [ ] **Essentials** and fxbot's list no longer have chat-rooms-computer.
- [ ] Docs as above, `npm run typecheck`, `npm run build`, `npm run build-site`, and `git diff --check`.

Only a person can check, on a real machine:
- [ ] A room's bots share its computer with a real model, after the move, as before.

## 5. Open questions

1. **In computer, as asked.** Settled by the owner: "yes I expected it in the computer plugin not the chat rooms plugin, that's what I asked for." (2026-11-12)
2. **An optional need in `plugin.json`, or `fx.need` for any plugin without naming it?** Recommended: an optional need. It says what a plugin works with, where Plugins can show it.
3. **The order of the move:** words in the break line and **Before upgrading**, which is all fxbot can do for an install still on Computer 0.4.0. Recommended: yes.
4. **Computer's migration reads chat-rooms-computer's table,** another plugin's schema, once. Recommended: yes, once. Otherwise every room loses its computer's files.
