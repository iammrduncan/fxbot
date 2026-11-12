# /fresh in core

`/fresh` becomes part of fxbot, and the fresh plugin goes:
- **`/fresh` works in every bot's own chat,** with nothing to add. It does what it does now: it starts the chat over from a summary aimed at what you write after it, then sends your message to the new chat. The card says **Started over**.
- **The plugin retires.** It leaves fxbot's list and **Essentials**. An install that has it sees it as **Unsupported**, with words to remove it. It keeps no data, so nothing is lost.
- **Plugins keep what they have.** A message hook can still answer `{ startOver: { ask } }`, and `plugin.json` can still declare `commands`.

Status: built on 2026-11-12, for 0.10.0, as planned the same day at the owner's word, with the open questions' recommendations: the name `/fresh`, a break line for an install that has the plugin, and the message hook's `startOver` kept. Where the build differs from the plan, [What the build changed](#what-the-build-changed) says so. Researched the same day, against fxbot's code at `ff25241`, and from source at Pi `d78a75e`, Hermes Agent `e7212db`, and OpenClaw `56eb6f3`.

## What the owner asked

"`fresh` plugin is so light it should just be part of the core." (2026-11-12)

## 0. Core or plugin

**Core.**
- **It's context that fits the model,** which is core ([Core or plugin](../../../CONVENTIONS.md#core-or-plugin)). `/fresh` starts a chat over by hand. A provider switch and [idle compaction](idle-autocompaction.md) do the same on their own, and both are core.
- **Core already does the work:** the summary, the new session, the card, and the page following the chat. The plugin only says when, and what to ask: 41 lines (`plugins/fresh/fxbot/server.ts`).
- **This changes an earlier call.** On 2026-11-05, [fresh](fresh.md#0-core-or-plugin) made `/fresh` a plugin on two seams. Since then, idle compaction made starting over something core does by itself, and the command that does it by hand belongs beside it.
- **The seams stay in the plugin API.** A message hook's `startOver` answer and `commands` in `plugin.json` cost nothing to keep, and another plugin may start a chat over its own way. Removing them would break plugins for nothing.
- **Core still names no plugin.** Retiring fresh is data: a line in `plugin-breaks.json`, and fxbot's list.

## 1. Research

### fxbot today

- **The plugin** (`plugins/fresh/fxbot/server.ts`):
  - It acts on `/fresh` at the start of the owner's message to the bot's own chat. A plugin's message, such as a room's, passes through (`event.from`).
  - It takes `/fresh` off, and answers `{ startOver: { ask } }`. The ask is aimed at the rest of the message, up to 4,000 characters, or is a general one when nothing follows.
- **Core's side** (`deliver`, `packages/sdk/src/index.ts`):
  - It holds the chat, and checks that the chat has messages and that this message isn't a retry.
  - It calls `startOver` with the heading "Earlier conversation, summarized when the chat started over", then sends the message to the new chat.
  - A message that's empty after `/fresh` sends nothing.
- **The `/` list** is the bot's skills, then the commands of the plugins that are on for it, marked `command: true` (`profiles.skills`, `index.ts:980`).
- **Where it's listed:** fxbot's list, and **Essentials** (`packages/sdk/src/plugins-registry.json:2`).
- **What it keeps:** nothing. It has no tables, settings, or secrets.
- **How a plugin retires:** a line in `plugin-breaks.json` names a plugin, a version below which it's unsupported, and since which release (`packages/sdk/src/plugin-fit.ts:25-29`). fxbot.sh publishes the list, and fxbot reads it again every hour.
  - **An install from GitHub** then shows **Unsupported** with the line's words, and doesn't load.
  - **A local one** runs, with the words in its log.
- **Where it's named:** `how-to/start-fresh.md`, `explanation/bots-and-chats.md`, the README, `AGENTS.md`, the screenshots' plugin list (`scripts/screenshots/shoot.mjs:55`), and the changelog.

### The references

- **Pi builds both in:** `/new`, "Start a new session", and `/compact`, "Manually compact the session context" (`packages/coding-agent/src/core/slash-commands.ts:39-40`). `/compact` takes words that steer the summary: `customInstructions = text.slice(9)` (`src/modes/interactive/interactive-mode.ts:3434-3437`). Pi is the reference for a minimal core, and these are in it.
- **Hermes Agent builds in** `/new` and `/compress` (`hermes_cli/commands.py:87`, `:115`). `/compress` takes a focus topic (`tui_gateway/compute_host.py:484`).
- **OpenClaw builds in** `/new` and `/reset` (`src/tui/tui-session-history-selection.test.ts:240-241`).
- **None makes this a plugin.** Each keeps its commands to start over and compact in the core, beside its own automatic compaction.

## 2. Key takeaways

1. **Starting over is core everywhere.** Pi, Hermes, and OpenClaw keep it there, and fxbot's automatic start-overs are core already.
2. **The work is core already.** Only the command and its ask move.
3. **The seams stay.** A plugin can still start a chat over, through the message hook.
4. **Retire by data.** A break line and fxbot's list, so core names no plugin.
5. **A summary aimed at what's next, as now.** Pi's `/compact` and Hermes's `/compress` take words to steer theirs too.

## 3. Implementation

### Core

- **`freshAsk(next)` in `history.ts`,** beside `switchAsk` and `idleAsk`: the plugin's ask, word for word.
- **In `deliver`, before the plugins' message hooks:**
  - **When:** an owner's message to the bot's own chat (no `session`, no `from`) that starts with `/fresh` (`/^\s*\/fresh(?=\s|$)/`).
  - **What:** take `/fresh` off, and start the chat over with `freshAsk` on the rest, up to 4,000 characters, on the path a hook's `startOver` answer takes now.
  - **The plugins' hooks** then see the message without `/fresh`. A hook's own `startOver` runs only when `/fresh` didn't already start one.
- **The `/` list:** core's commands, `fresh`, "Start the chat over toward what you write next", come before the plugins' commands. A plugin command with a core command's name is left out, such as a local fresh in a checkout.

### Retiring the plugin

- **fxbot's list:** take `fresh` out of `plugins` and `essentials` in `plugins-registry.json`.
- **`plugin-breaks.json`:** `{ "since": "0.10.0", "plugin": "fresh", "below": "1.0.0", "says": "/fresh is part of fxbot since 0.10.0. Remove this plugin in Plugins: nothing is lost." }`.
- **The folder:** delete `plugins/fresh/`. An install that added it from GitHub keeps its own copy until the owner removes it.
- **The dev app:** take `plugins/fresh` out of its `FXBOT_PLUGIN_DIRS` when this lands. A folder on that list that's gone is an error in the log.
- **History:** [fresh](fresh.md) stays as it is. This doc says what replaced it.

### Docs

- **`how-to/start-fresh.md`:** built in, with no plugin to add.
- **`explanation/bots-and-chats.md`:** `/fresh` is built in.
- **The rest:**
  - The README and `AGENTS.md` lists.
  - The screenshots' plugin list. Its fresh scene runs on core.
  - `## Unreleased`: `/fresh` is built in. Under **Before upgrading**: remove the fresh plugin.
- **`sdk/reference/plugin-api.md`:** the `startOver` answer stays, and says core's `/fresh` uses the same path.

### Not in this phase

- **Another name,** such as `/compact` or `/new` ([Question 1](#5-open-questions)).
- **A `/new`** that starts over with no summary.
- **Moving other plugins into core.**

### Size

| Where | Lines, about |
| --- | --- |
| Core: the command, the ask, the `/` list | 50 |
| The plugin, its listing, and the break line | -45 |
| Docs | 40 |

## 4. Checklist

Against a disposable fxbot and a mock model that logs each request:
- [x] With no fresh plugin, `/fresh plan the trip` in a bot's own chat starts it over:
  - The mock gets one summary request, whose ask is the plugin's ask, word for word, aimed at "plan the trip".
  - The card says **Started over**.
  - "plan the trip" goes to the new chat, as the owner's.
- [x] `/fresh` alone starts over with the general ask, and sends nothing after.
- [x] `/fresh` in a room, in a routine's run, or in a plugin's message to the bot is sent as written.
- [x] A chat with no messages isn't summarized, and a message sent again doesn't start over twice.
- [x] The `/` list shows `/fresh` once for every bot, also with a local fresh plugin loaded.
- [x] A plugin's message hook sees the message without `/fresh`. A hook's own `startOver` answer still works on a message without `/fresh`.
- [x] fresh, added from a repository on the checks' stand-in for GitHub, shows **Unsupported** with the break line's words. Removing it changes nothing else.
- [x] **Essentials** and fxbot's list no longer have fresh.
- [x] Docs as above, `npm run typecheck`, `npm run build`, `npm run build-site`, and `git diff --check`.

Only a person can check, with a real model:
- [ ] `/fresh` with something to go on: the new chat keeps what bears on it, as before.

## 5. Open questions

1. **Keep the name `/fresh`?** Recommended: yes. Owners know it, and it also says the summary aims at what comes next. Pi's `/compact` and Hermes's `/compress` compact in place.
2. **An install that has the plugin:** **Unsupported** with words to remove it, through a break line? Recommended: yes. For fxbot to remove it itself, core would have to name a plugin.
3. **Keep the message hook's `startOver` answer** in the plugin API? Recommended: yes. Removing it gains nothing, and would break a plugin that uses it.

## What the build changed

- **The break line's words** are "/fresh is built in now. Remove this plugin in Plugins: nothing is lost." Plugins puts "It doesn't work on fxbot 0.10.0." before them, so the planned "since 0.10.0" said the version twice.
- **With `/fresh`, a hook's `startOver` doesn't count.** `/fresh` runs before the hooks, and a hook's answer starts a chat over only when `/fresh` didn't. The plugin API reference and the changelog's **For plugins** say so.
- **The guide keeps a short section** for an owner who still has the plugin: it shows **Unsupported**, and removing it loses nothing.
- **The screenshots' fresh scene stays,** on core's `/fresh`, and the plugin leaves their plugin list.
- **The checks,** against a disposable fxbot, the mock model, a probe plugin with a message hook, and the plugin-compatibility checks' stand-in for GitHub:
  - **On fxbot as 0.9.0,** fresh 0.1.0 was added from the stand-in. `/fresh plan the trip` ran one summary, whose ask matched the plugin's own `askFor`, word for word. The plugin's hook ran too, and the `/` list had `/fresh` once. That was fresh from the stand-in; a local copy goes through the same filter, by name, and wasn't run.
  - **As 0.10.0,** fresh showed **Unsupported** with the break line's words. Then:
    - `/fresh` alone used the general ask and sent nothing. A chat with no messages wasn't summarized, and a message sent again started over once.
    - A room, a routine's run, and a plugin's message sent `/fresh` as written.
    - The probe's hook saw the message without `/fresh`. Its own `startOver` worked without `/fresh`, and didn't count with it.
    - Removing fresh left `/fresh` working. **Essentials** and fxbot's list had no fresh.
  - **24 checks over two runs, 23 passed.** The one that failed compared the **Unsupported** text without the words Plugins puts first, and led to the rewording above. It passed after.
  - **The page, in Chromium:** the `/` list offered `/fresh` once, and Plugins showed fresh **Unsupported** with the break line's words. No page errors.
- **The dev app:** `plugins/fresh` leaves its `FXBOT_PLUGIN_DIRS` when this lands.
