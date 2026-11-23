# herdr tags

Tag a herdr agent in a chat as you tag a bot: `@herdr:patcher`. The tag carries everything about the agent when you sent it, its machine, pane, tab, kind, session name and id, and status, so the bot knows exactly which agent you mean, and a click on the tag opens its terminal.

- **The herdr plugin keeps every agent it sees,** on every machine, in a table of its own, and syncs it every minute, so the list is there at once as you type.
- **`@` in the message box lists your bots, then herdr's agents,** each named by its pane's label, else its Claude Code session's name, else its kind and pane. `@herdr:` lists only agents.
- **A plugin can add to the `@` list,** with a new place in the page's plugin API, `app.mention`. herdr is the first.

Status: planned and built on 2026-11-23, for 0.11.0, at the owner's word: "named herdr panes should be stored in our herdr plugin itself and auto sync'd. then I can `@hc:<pane-name>` to reference it in a chat just like I can on messages to reference a bot. Then that resolves to the pane, pane id, and claude id or codex id etc all at once to give fxbot." The owner chose the prefix `@herdr:`, leaving `hc` to the [hc](../../phases/hc.md) plugin, and every agent, not only labeled ones. It builds on [herdr terminals](herdr-terminals.md), herdr 0.3.0, on the same branch. Where the build differs from the plan, [What the build changed](#what-the-build-changed) says so.

## 0. Core or plugin

**A plugin, with one new place in the page's plugin API.** The `@` list is the [messages](cross-bot-messaging.md) plugin's: its box, ProseMirror through `app.box`, lists the bots one can reach, and writes a pick as a link, `[@Bob](/profiles/<id>)`. Another plugin can't add to it today. The smallest widening is a page-side place, `app.mention(source)`, which any plugin fills with a search, and `useMentions()` in `@fxbot/app`, which the box reads. It only adds, so nothing breaks. No SDK, server, or hook changes: the tag is resolved when it's picked, and the bot reads it.

## 1. Research

- **fxbot's bot tags** (Messages): a chip in the box is a ProseMirror atom, written to the text as a Markdown link with the bot's id, so two Bobs can't be confused, and the text reads as a name in any Markdown. `app.said` draws a link in a sent message as a chip with the bot's face. The tag wakes no one: it's words the bot reads.
- **herdr's snapshot** names each agent's pane, tab, workspace, kind, status, folder, and title, and `agent_session`, the agent's own session id, which herdr's integrations report: Claude Code's and Codex's alike. Claude Code's own name for a session, such as `thermite-e9`, is in its file for each running session, on the machine it runs on ([herdr terminals](herdr-terminals.md#1-research)).
- **A pane id isn't forever:** herdr gives new ids after its server restarts, and an agent's session id changes when it starts over. So a tag holds what was true when it was sent, and the bot reads the agent again before it acts.
- **The cost of asking every machine:** a list of herdr's agents takes about as long as its slowest machine, about 420 ms for 10 here, and a machine that doesn't answer takes up to the timeout. Typing can't wait for that, so the list comes from what the plugin keeps.

## 2. Key takeaways

1. **The tag is the answer.** `[@herdr:patcher](/herdr/agents/local/w1%3Ap8 "Claude · pane w1:p8 on Local · the thermite tab · session thermite-e9 · id fca3d23a-… · working")`: the link names the machine and pane, and its title the rest, so the bot needs no lookup to know which agent, and the link is the agent's terminal.
2. **Kept, and synced.** A table of every agent herdr has, updated every minute and when the list is old, answers the box at once.
3. **One `@` list.** Bots first, then each plugin's choices, so the owner learns one gesture.

## 3. Implementation

### The page's plugin API

`app.mention({ search })`: `search(query, bot)` gives up to 8 choices, `{ key, name, link, title?, detail? }`, or a promise of them. `useMentions()` gives every plugin's sources, to a box that lists them. A box writes a pick as `[@<name>](<link> "<title>")`.

### Messages' box

- A chip is a bot's, `{ bot, name }`, as now, or a plugin's, `{ name, link, title }`. The text has each as its link. Any `[@…](/…)` link to the app reads back as a chip.
- `@` lists the bots, then each source's choices for what follows it, asked 150 ms after typing stops. A plugin's choice shows its name, its line, and its plugin's icon, and its chip is `@name`.

### herdr

- **`panes`** (migration `0003_panes.sql`), each agent herdr has: its machine and pane, which key it, its name, label, kind, session id and name, tab, workspace, folder, title, status, and when it was seen.
- **Its name:** the pane's label, else its Claude Code session's name, else its kind and pane, such as `claude-w1p8`.
- **Syncing:** 10 seconds after the plugin loads, then every `sync` seconds, 60 by default. A machine that answers has its rows written, and those it no longer has go. One that doesn't answer keeps its rows. A list asked for when the table is over 15 seconds old answers from it and syncs behind.
- **`GET /mentions?q=`:** a leading `herdr:` dropped, the agents whose name, label, session, title, or tab start with the rest, then those that hold it, up to 8, as choices named `herdr:<name>`.
- **A sent tag** is a chip with the terminal icon and the agent's status now, and a click opens its terminal.
- **The bot:** the skill and tools say a tag means exactly that agent, its machine and pane from the link, and its title as it was. Every tool's `agent` also takes `herdr:<name>`.
- **`sync`,** a setting: how often the list syncs, 30 to 3,600 seconds.

### Cost

Every minute, herdr's list on each machine, as `herdr_agents` asks for it: about 420 ms for 10 machines, all at once. The box asks the plugin, not herdr, as the owner types.

### Not in this phase

- Chat rooms' box, which has an `@` of its own.
- A tag that wakes the agent: it's words for the bot, as a bot's tag is.

## 4. Checklist

On a check fxbot with herdr, Messages, and Permissions, and herdr's check session, `fxbot-check`, with stand-in agents: one labeled, one with only a session, and one with neither, and a shell. The check fxbot's `herdr` on its PATH is the check session's, so from its first load it never reaches the owner's herdr.

- [x] The table fills, each agent named by the rules: `herdr:asker` by its label, the session's own name for the one with only a session, and `herdr:claude-w4p3` for the one with neither. The shell isn't offered. A pane's new label showed within a sync, and a closed workspace's agents went.
- [x] `/mentions?q=herdr:as` and `?q=as` find the labeled one, with its link, `/herdr/agents/local/w4%3Ap1`, and its title, and the session's name finds the other, with Claude Code's session id in its title.
- [x] In Chromium, a desktop in light and a phone in dark, with writes outside the chat's send and herdr's routes blocked, and no page errors: `@herdr:as` lists `herdr:asker` with "Claude · Waiting for the owner · tab 1 of ui on Local", Enter makes a chip, and Send sends `[@herdr:asker](/herdr/agents/local/w8%3Ap1 "Claude 'asker' · pane w8:p1 on Local · tab 1 of ui · /tmp · waiting for the owner")`, which the model gets as written. The sent chip opens the terminal. The skills list's pick, which takes `$herdr` out of the text, keeps the chip, and `@Ann` still makes a bot's chip, sent as `/profiles/<id>`.
- [x] A bot's `herdr_read` with the tag's pane and machine reads that agent, and with `herdr:asker` too.
- [x] `npm run typecheck`, with "fxbot's plugins fit 0.11.0", `npm run build-site`, where all 14,855 links in 125 pages resolve, and `git diff --check`.

## 5. Open questions

1. **The list's order:** bots first, then agents. Recommended, so a bot's tag stays where the owner's hand knows it.
2. **How often to sync:** every minute. Recommended: a minute old is fresh enough for a name, and the list syncs when it's asked for and older than 15 seconds.

## What the build changed

- **`ui.PluginIcon`** is new in the page's `ui`, so a box shows a plugin's choices with its icon, as the plan's list asked.
- **A label is in single quotes in a tag's title,** `Claude 'patcher' · …`, since a Markdown link's title is in double ones, and a status in a choice's line is capitalized.
- **A sent tag's status** comes from `GET /panes`, every agent kept, read at most every 30 seconds while a tag shows, shared by every tag on the page.
- **The first list:** before the plugin's first sync, `/mentions` waits for one, so the box never shows an empty list for agents that are there.
- **The check fxbot read the owner's herdr once.** Its herdr loads before its settings can be set, and its first sync ran herdr's own command against the owner's session, reading their four agents' names, and writing nothing to herdr. Later syncs replaced those rows. The checks then put the check session's wrapper first on the check fxbot's `PATH` as `herdr`, so from its first load it reaches only the check session.
- **A session's name changes.** Claude Code names a session from its work, so the session the stand-in borrows went from `split-phone-signalwire-plugin` to `herdr-pane-tags` during the build, and the list followed. The checks read the name from Claude Code's file.
- **In dev,** the migration ran, and the first sync listed the owner's four agents on Local by their labels, with each one's session name and id.
