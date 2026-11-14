# hc

`hc` lets bots run coding agents of their own, such as Claude Code, in terminals that stay alive, on fxbot's machine and on the owner's other machines, through [herdr-core](https://herdr.dev/core/) (`hc`), herdr's headless runtime:
- **A bot starts an agent where the work is.** "Start a Claude on box in /srv/api to fix the failing test" becomes a terminal named `fxbot-api-fix` on box, with the task sent once Claude says it's ready.
- **It hears back by itself.** Each agent reports its own status to herdr-core, and one event stream covers every machine. When an agent's turn ends, or it stops to wait for the owner, its last lines, with the history above them, reach the bot's own chat and wake it.
- **It steers them.** The bot sends an agent more work, or a correction while it works, reads what it did, and stops it when it's done.
- **The owner watches them live.** A bot's panel lists its agents by what they need, as herdr's own apps do: needs you, working, done, idle. One opens to the agent's terminal, live, in fxbot's page.
- **Only fxbot's own agents.** fxbot names what it starts `fxbot-…` and touches nothing else in herdr-core. The owner's herdr TUI, and the agents it runs, are the [herdr](../_completed/phases/herdr.md) plugin's, and stay as they are.

Status: **deferred.** Planned on 2026-11-14 at the owner's word, and not started: the owner will revisit it after 0.11.0. Nothing is built until the owner approves installing herdr-core and the hands-on check in the [checklist](#4-checklist) has run. Until then, this plan is unverified against herdr-core. Researched against the research directive's references, with herdr-core, the Herdr apps, and the herdr TUI among them since the same day, from herdr-core's docs and source and the Herdr app's docs, read on 2026-11-14. Nothing of herdr-core ran here: installing it, even in a disposable container, waits for the owner's go-ahead, so the checklist starts with that check, and every claim about herdr-core below is from its docs or source unless it says otherwise. One thing did run: Claude Code 2.1.325, installed here, speaks herdr-core's status protocol.

## What the owner asked

After the herdr plugin was built, and herdr-core turned up on herdr.dev (2026-11-14):
- "no my lab uses herdr to do the system. I won't use herdr app atm, its a reference. But hc seems like a solid interface to herdr across systems, headless that we can use fo rour own app interface here."
- "I think thats cleaner using hc instead of herdr tui. Still works across multiple machines and such right?"
- "yeah do do that"

herdr-core runs terminals of its own, beside the herdr TUI's server, not in front of it, so it doesn't see the TUI's agents. This phase is fxbot's own way to run coding agents across the owner's machines. The herdr plugin stays, for the agents the owner runs in the TUI.

## 0. Core or plugin

**A plugin**, `hc`, beside `herdr` ([Core or plugin](../../CONVENTIONS.md#core-or-plugin)). Running coding agents on the owner's machines isn't what every bot needs, what plugins plug into, or what fxbot needs to run, and it needs herdr-core installed. It's in fxbot's list, off until added, and never in **Essentials**.

**Its own plugin, not part of `herdr`.** The two drive different runtimes, through different commands and doors, and an owner may want either alone: the lab's TUI agents, or agents of fxbot's own. One plugin with both would give every bot nine tools and two models of what an agent is.

**No change to the plugin API.** Tools with `safe`, `fx.chats.send` with `steer` and `asked`, tables, settings, `app.toolView`, `app.botPanel`, `app.botSettings`, `app.route`, `app.settings`, and `fx.socket` for the live view: all in 0.9.0.

**A second door, so the door's plumbing becomes one.** In a release, fxbot's container reaches herdr-core only through a door the owner opens, as with herdr: `sudo fxbot hc on`. That's the second plugin with a part on the machine opened by `fxbot <name> on|off`, so `deploy/fxbot` gets one function that writes and removes a door's units, and `herdr` and `hc` each keep their own door script, since their commands differ.

**And the conventions.** As with herdr, a bot's work reaches the owner's machines only through the owner's own coding agents, never a shell: the door runs only an agent the owner's list allows, never `--keep` (which leaves a shell when a program is lost), and only in terminals named `fxbot-…`. [Bots and the owner's machine](../../CONVENTIONS.md#bots-and-the-owners-machine) gains `hc` beside `herdr`.

## 1. Research

### herdr-core

From its README, `docs/commands.md`, `docs/machines.md`, `docs/security.md`, `docs/templates.md`, and `schema/README.md` (the API), and its source, at `herdrdev/herdr-core` on 2026-11-14:
- **What it is.** "`hc` runs programs and coding agents in terminals that stay alive after you leave." A core server per user holds the terminals; closing a viewer, or updating, leaves them running. "Core draws nothing." The Herdr desktop and mobile apps are built on it. Apache 2.0. Created on 2026-10-16, at 0.1.x, and changed daily.
- **Commands.** `hc run`, `ls`, `get`, `read`, `send`, `wait`, `events`, `kill`, `interrupt`, `attach`, `machine`, `connect`, `schema`, `update`. Each prints JSON when piped. A terminal is `t7`, a name, or `machine/t7`.
- **Starting one.** `hc run --bg --on box --cwd /srv/app --name review --label k=v claude`. A name is 1 to 32 of `a-z 0-9 - _`, unique among live terminals. `--no-parent` keeps a terminal from ending with the one that started it; `--keep` replaces a lost program with a shell; `--rm` removes it once it exits.
- **Every machine.** `hc machine add user@host --name box` takes any SSH target, copies `hc` there if it's missing, asking first, or with `--install`, and needs a person for passwords, codes, and host keys. "Your local core keeps the machine connection and combines terminal lists and events." It reconnects by itself, and `hc machine login box` logs in again. On Linux it turns on lingering, so programs outlive a logout.
- **Status comes from the program.** Through OSC 7501, the Program Status Protocol: `idle`, `working`, `done`, `blocked`, `error`. "hc never infers status from the screen. Programs that don't speak 7501 have no status." A turn counter goes up each time a terminal stops working, and a `turn` event says the word it ended on.
- **Reading.** `hc read <t> --lines N`: the screen, and N "lines of history above the screen".
- **Sending.** `hc send <t> <text>` pastes the text and presses Enter. `--if idle` types only when the agent is idle; `--wait` waits "for the turn this send started"; a blocked agent is refused unless `--force`. A send also waits while someone is typing in that terminal.
- **Labels.** `--label K=V` on `run`, `ls`, and `events` marks terminals and filters them.
- **Events.** `hc events --json --label K=V`: a snapshot, then one line for each change, `created`, `status`, `turn`, `title`, `labels`, `finished`, `removed`, and the rest, for this machine's terminals and every added machine's, with a heartbeat every 15 seconds and `missed` with a fresh snapshot for a reader that falls behind.
- **Agents run agents.** A terminal started from another is its child, gets notes when one needs attention or ends, and can be told to report with `hc send $HC_TERMINAL_ID`. `hc --skill` prints the guide for agents.
- **The API.** JSON-RPC 2.0 on a Unix socket, one message per line, or framed: binary frames that carry attach streams beside the JSON. An attach stream sends a first paint, the screen and optional history, then the program's raw output; an `observe` viewer "never type[s] or resize[s]". `hc connect` speaks the API over stdin and stdout, so `ssh box hc connect` is a remote core. Documents, `doc.get` and `doc.set`, hold opaque JSON for clients, such as the Herdr app's own `herdr-app`.
- **Who may connect.** "Anyone who can connect to its API can run commands, read and change files, and control its terminals with that access." Its state and socket folders are mode 0700. "Do not expose the socket or forward the raw API to people you would not trust with a shell on that machine."
- **Install.** `curl -fsSL https://releases.herdr.dev/core/install.sh | sh`, static builds for Linux, and `hc update`, with running terminals kept.

### Claude Code, here

Claude Code 2.1.325, installed on this machine, carries `PROGRAM_STATUS:7501` in its table of terminal sequences, and probes the terminal for an OSC 7501 reply before it reports. So in herdr-core, Claude Code reports its own status. Codex, OpenCode, and Pi weren't checked. herdr-core's templates "do not install agents or configure their status reporting", and an agent that doesn't report has no status.

### herdr's apps

- **The desktop app** (`herdrdev/herdr-app`) is a herdr-core client. It keeps its own state in a core document, `herdr-app`, and shares two things with every other client through labels, by its `docs/labels.md`:
  - `herdr.seen=<turn>` is the last turn a person looked at. An agent is **needs you** when `blocked` or `error`, **working** when `working`, and otherwise **done** when its turn is past `herdr.seen`, or **idle**. A client writes it when a person really looks at an agent, once per turn, and starts its own terminals at `herdr.seen=0`.
  - Pinned agents, the same way. A client that doesn't know the labels keeps working.
- **The mobile app** has an inbox of "every agent on every machine, sorted by what it needs from you: needs you, done, working, idle", opens an agent's real terminal, and a compose box sends text, a screenshot, or dictation "as one paste, then Enter". "Works with herdr-core… Herdr TUI isn't supported."

### The herdr TUI, and fxbot's herdr plugin

The [herdr](../_completed/phases/herdr.md) plugin drives the TUI's CLI, and its workarounds are what herdr-core has built in:
- it asks each machine apart, since `--machine` reaches one per call, where `hc ls` and `hc events` cover them all
- it keeps a wait open for each prompt, where one event stream covers every agent
- the TUI guesses status from the screen, where an agent reports its own
- a start makes a workspace, a tab, renames it, starts the agent, and prompts it, where `hc run` takes a name and a folder
- a read is the screen alone, where `hc read --lines` adds the history above it, which is what [the owner found missing](../_completed/phases/herdr.md#after-the-build) in a bot's summaries

What carries over: the door and its allow-list, a watch's answer in the bot's own chat, once, quoted, under words that say whose it is, an agent named in words, each bot's machines, and Permissions for what reaches outside.

### The directive's references

The [herdr phase](../_completed/phases/herdr.md#the-directives-references) read each one for working with other agents; what applies here:
- **fx and eve:** a helper's report becomes the parent's next message, and only a person answers a helper's approval.
- **durable-harness** drives Claude Code, Codex, OpenCode, Pi, and fx through their own protocols, in a sandbox VM, "never on the machine that drives the session". herdr-core is the other way: real interactive agents in terminals on the owner's machines, which the owner can take over.
- **Grok Bot** keeps running things on the user's own computer behind a setting of its own, off unless chosen.
- **agent-browser** answers a risky action with a confirmation the person gives.

### fxbot today

- **The herdr plugin** has the door (`deploy/herdr-door`, `fxbot herdr on|off`), the watch-and-tell pattern, sentences for agents, and each bot's machines (`plugins/herdr/fxbot/server.ts`).
- **The computer plugin** bundles xterm.js and streams a terminal to the page over `fx.socket` (`plugins/computer`), with its license notice.
- **Subagents** puts background work in a bot's panel, each opening a live thread (`plugins/subagents/fxbot/page.jsx`).
- **Permissions** asks about any call that reaches outside, by the bot's mode.

## 2. Key takeaways

1. **herdr-core is the interface to build on, for agents fxbot runs.** One list and one event stream for every machine, status from the agent itself, history in a read, a send that waits for its own turn, labels, and an API made for other clients. The herdr TUI is still the way to the owner's own agents, so both plugins stay.
2. **Only fxbot's own terminals.** fxbot starts terminals named `fxbot-…`, labeled `fxbot=1` and with the bot's id, and its door touches no other. The owner's own hc terminals, if any, stay theirs.
3. **Agents, never shells.** The door runs only an agent the owner allows, with no arguments, never `--keep`, and sends text only to `fxbot-…` terminals. What a prompted agent then does is the agent's, as with herdr, under its own settings and approvals.
4. **Start, then send.** An agent starts bare, and its task goes once it reports `idle`, as herdr-core's own templates wait for a first report. No task rides on the command line, where a flag could hide in it.
5. **One stream, not a wait for each prompt.** While any of fxbot's agents works, one `hc events --label fxbot=1` connection follows them all, and a `turn` event is the cue to read and tell. After a restart, its first snapshot says where each one is.
6. **Summaries need history.** A turn's answer, and `hc_read`, take the screen and lines above it.
7. **Follow herdr's labels where they help.** needs you, working, done, idle, by `herdr.seen`, so fxbot's panel sorts as herdr's inbox does, and an agent the owner looks at in fxbot stops being "done" in herdr's apps too.
8. **Watch first, take over later.** An attach stream is binary frames, which a Bash door can't check. Watching through the door has to be proven first, and typing into an agent's terminal from fxbot's page waits for a door that can tell a watcher from a typist.
9. **The owner sets up herdr-core and its machines.** Installing it, and `hc machine add` with its SSH prompts, are the owner's, on the machine. fxbot never installs, updates, or adds a machine.

## 3. Implementation

### The plugin

`plugins/hc/`, version 0.1.0, in fxbot's list, not in **Essentials**, `minFxbot` `0.9.0`:
- `plugin.json`: settings
- `fxbot/server.ts`: the tools, `hc()` through the door or the CLI, the event stream, the tells, and the routes
- `fxbot/page.jsx`, built to `page.js`: the cards, the bot's panel, the live view, a bot's machines, and the tab
- `fxbot/migrations/0001_hc.sql`
- `skills/hc/SKILL.md`, `README.md`, `page-licenses.txt` for xterm.js

### Reaching herdr-core

- **Directly,** in a checkout run by herdr-core's user: `execFile` of the `hc` setting, as herdr's plugin runs `herdr`.
- **Through the door,** in a release: `sudo fxbot hc on [--user <login>] [--read-only]`, with the units and checks of `fxbot herdr on`, from a function both share. It checks that `hc server status --json` answers as that user, and lists `hc machine ls --json`, naming any that don't answer.

**`deploy/hc-door`**, Bash, run for each connection as herdr-core's user, sourcing nothing. `<t>` is `fxbot-<name>`, or `<machine>/fxbot-<name>`, where a name is 1 to 26 of `a-z 0-9 - _`:

| Command | Its other words | `--read-only` |
| --- | --- | --- |
| `door` | none | yes |
| `server status --json`, `machine ls --json` | none | yes |
| `ls --json --all --label fxbot=1` | none | yes |
| `events --json --label fxbot=1` | none, held open | yes |
| `get <t> --json` | none | yes |
| `read <t> --json --lines <n>` | `n` from 0 to 2,000 | yes |
| `run --bg --json --no-parent --name fxbot-<name> --label fxbot=1 --label fxbot.bot=<id> --label herdr.seen=0 [--on <machine>] --cwd <path> <kind>` | a kind from the door's list, and nothing after it | no |
| `send --json [--if idle] <t> <text>` | text up to 16 KiB | no |
| `interrupt <t> --json`, `kill <t> --json` | none | no |
| `attach --observe <t>`, if the check finds it streams when piped | none, held open | yes |

Everything else is refused: other terminals, `--keep`, `--force`, a program's arguments, `run` of anything but a kind, `machine add`, `rm`, `login`, or `update`, `update`, `server` but `status`, `connect`, `file`, and `templates`. The door's kinds start as `claude`, the one agent checked to report its status.

### The tools

All say where an agent is in a sentence: "Claude fxbot-api-fix on box is working."

- **`hc_agents()`**, `safe`: the bot's own agents on its machines, from one `ls --label fxbot=1`, filtered by `fxbot.bot`: name, machine, kind, folder, status in herdr's four words (needs you, working, done, idle), its turn, its title, and its task's first line.
- **`hc_start({ machine?, kind, folder, name, task })`**, not `safe`, not `idempotent`: `run` as the door allows it, then, on the agent's first `idle`, `send --if idle` the task, and the agent is watched. The bot's agents at once are at most `agents`, 6 by default. It answers at once: "Started Claude fxbot-api-fix on box, in /srv/api. It gets the task once it's ready, and its answer comes to you when it's done: don't wait or check."
- **`hc_send({ name, text })`**, not `safe`, not `idempotent`: to an agent of this bot's only. While it works, the text joins its work, as herdr-core's steering does; the bot hears when the turn ends.
- **`hc_read({ name, lines? })`**, `safe`: the screen and `lines` above it, 200 by default, up to 2,000, cut to 24 KB from the top, quoted as the agent's words.
- **`hc_stop({ name })`**, not `safe`: `interrupt`, then `kill` if it's still running after 10 seconds, and the agent leaves the panel.

No tool answers an agent's approval, presses keys, or sends with `--force`: the owner does those, in herdr-core or the live view, once taking over is built.

### Hearing back

- **One stream.** While any of fxbot's agents is working, the plugin holds one `events --json --label fxbot=1` connection, through the door or the CLI, and closes it when none is.
- **A turn that ends** (`turn` event): the plugin reads the agent's screen and history, `lines` lines, and sends it to the bot's own chat, under **hc**, with `steer` and the `asked` of the turn that started or last sent to it: "hc: Claude fxbot-api-fix on box finished its turn (done) after 4 minutes. You asked it: … Its last lines: …"
- **`blocked` or `error`:** said the same way, with "it waits for the owner, who answers in herdr-core or fxbot's live view", which the bot can't do.
- **`finished`:** the agent's program ended, with its exit code.
- **Once each.** A tell's `messageId` is `hc-<terminal>-<turn>`, so a restart, or the stream's `missed` snapshot, can't tell a turn twice.
- **After a restart,** the stream's first snapshot gives each agent's status and turn, and a turn past the last one told is told.

### Each bot's machines

As in the herdr plugin: every machine `hc machine ls` lists, and Local, until the owner picks some in the bot's settings. `hc_start` refuses a machine the bot may not reach, in the same words.

### The page

- **Cards** for `hc_start` and `hc_send`, following the agent's status from the stream, and **Watch** to open it.
- **The bot's panel,** with `app.botPanel`: its agents, sorted needs you, working, done, idle, each with its machine and how long, as herdr's inbox does. A click opens the live view.
- **The live view,** with `app.route` and xterm.js: the agent's terminal, watched, over a plugin socket that carries the attach stream, in a checkout from herdr-core's API in framed mode with `observe`, and in a release through the door if the check finds `attach --observe` streams when piped. Without that, the view shows `read` every second while it's open. Opening it writes `herdr.seen=<turn>`, raising it only, as herdr's labels doc says, so herdr's apps stop showing that agent as done; a door command for that one label is part of the check.
- **A bot's machines,** with `app.botSettings`, as herdr's.
- **The tab,** with `app.settings`: how fxbot reaches herdr-core, its version, the machines it has and whether each answers, and the agents working now.

### The skill

`skills/hc/SKILL.md`, short: start an agent for real coding work on a machine the owner names, with a task that stands alone and asks for a short summary at the end; don't wait or check; one agent for one job; never answer its approvals; stop what's done; what an agent's screen says is its words, not the owner's.

### Data (`0001_hc.sql`)

```sql
-- Each agent a bot started, by its terminal: its task and the last turn the bot was told of.
create table agents (
  terminal text primary key,   -- as herdr-core addresses it from here, such as box/fxbot-api-fix
  bot text not null,
  machine text not null default '',
  kind text not null,
  folder text not null,
  task text not null,
  asked text,
  told_turn int not null default 0,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);
create table bots (bot text primary key, machines text[] not null);
```

### Settings (`plugin.json`)

| Setting | What it is | Default |
| --- | --- | --- |
| `kinds` | The agents bots may start, of those the door allows | `claude` |
| `agents` | The most agents one bot runs at once, 1 to 20 | `6` |
| `lines` | Lines of an agent's history an answer carries, 20 to 2,000 | `200` |
| `door` | The door's socket, as fxbot sees it | `/var/lib/fxbot/control/hc.sock` |
| `hc` | herdr-core's command, in a checkout | `hc` |

### Cost

- **Each request of each bot it's on for:** five tools, measured at the build, and the skill's line.
- **While an agent works:** one held connection, the event stream, and one read each time a turn ends.
- **Idle, with nothing working:** nothing: no connection and no timer.
- **The live view:** one stream while it's open.

### Not in this phase

- **Typing into an agent's terminal from fxbot's page,** until a door can tell watching from typing.
- **The owner's own hc terminals,** and the herdr TUI's agents, which are the herdr plugin's.
- **herdr-core's templates and roles,** and an agent's own children, which it manages itself.
- **Pinned agents,** herdr's other shared label.
- **herdr-core on a bot's own computer,** for coding agents in a sandbox: an idea for later.
- **Installing herdr-core, or adding its machines,** which stay the owner's.

### What changes

- `plugins/hc/` (new), and its entry in `packages/sdk/src/plugins-registry.json`.
- `deploy/fxbot`: one function for a door's units, used by `herdr on|off` and the new `hc on|off`, and `status`, `uninstall`, and `update` for both. `deploy/hc-door` (new).
- `CONVENTIONS.md`: `hc` beside `herdr` in Bots and the owner's machine.
- The docs: a how-to, **Run coding agents with herdr-core**, with installing it, adding machines, the door, and what a bot does; `fxbot hc` in the commands reference; `CHANGELOG.md` under `## Unreleased`.

## 4. Checklist

Checks run against a herdr-core of their own, never one the owner uses, and the door's in a disposable systemd machine, as herdr's were.

**First: herdr-core, by hand,** with the owner's go-ahead to install it, in a disposable container and, for Claude Code, as a user of its own on this machine. **Waiting on the owner:** on 2026-11-14 they chose not to install herdr-core yet, so none of this has run, and the plan stays unverified against herdr-core until it does.
- [ ] Install it, and `hc server status --json` answers.
- [ ] A program that prints OSC 7501 reports `working`, then `done`: `get`, `ls --label`, and `events --json --label` show each, and a `turn` event comes with the word.
- [ ] Claude Code, started with `hc run --bg --name fxbot-check claude`, reports `idle` with no help, and `working`, then `done`, after a send.
- [ ] `read --lines 200` returns lines above the screen. `send --if idle` refuses a working agent, and `--wait` ends with that send's turn.
- [ ] `attach --observe`, piped: does it stream the first paint and output? That decides the live view's path in a release.
- [ ] Setting `herdr.seen` on a terminal: by which command or method.
- [ ] Codex, OpenCode, and Pi: which report status. Each that does joins the door's kinds.
- [ ] A second machine, a container reached over SSH: `machine add --install`, `run --on`, and its events in the same stream.
- [ ] What's found goes in this doc, and the plan changes where it must, before the build.

**The plugin**
- [ ] `plugins/hc/` 0.1.0, with its migration, settings, skill, README, and xterm.js's license. `npm run typecheck` passes, `page.js` is built.
- [ ] `hc_start` starts a labeled, named terminal, sends its task on the first `idle`, and refuses a kind outside `kinds`, a machine the bot may not reach, and past `agents`.
- [ ] A turn's end reaches the bot's own chat once, under **hc**, with its history, and wakes it; `blocked` and `finished` too. A restart mid-turn tells it once.
- [ ] `hc_send` steers a working agent and messages an idle one; `hc_read` returns history; `hc_stop` ends one.
- [ ] Only the bot's own agents: another bot's, or a terminal not named `fxbot-…`, is refused by name.
- [ ] Permissions on `ask`: `hc_agents` and `hc_read` run without a card; the others show one.
- [ ] The page in Chromium: the cards, the panel sorted by what each needs, the live view, a bot's machines, and the tab.

**The door**
- [ ] `fxbot hc on|off` in a disposable systemd machine, from the function `herdr on|off` now shares, and `fxbot herdr on` still passes its checks.
- [ ] Each allowed command, and each refused one: another terminal, `--keep`, `--force`, an argument after the kind, `machine add`, `update`.
- [ ] The event stream held while other calls answer.

**The docs**
- [ ] The how-to, the plugin's README, the commands reference, `CONVENTIONS.md`, `CHANGELOG.md`, and the README's Phases line. `npm run build-site` passes.

**Only a person can check**
- [ ] On the owner's machines: a bot starts Claude on a lab machine for a real task, hears back when it's done, and the owner watches it live in fxbot's page.

## 5. Open questions

1. **Installing herdr-core here, for the checks.** The first check needs it, in a disposable container and as a user of its own on this machine, for Claude Code. **The owner's answer, 2026-11-14: not now.** No install, no check, and no build until they revisit it after 0.11.0.
2. **Which user runs herdr-core for fxbot:** root, as herdr does here, or a user of its own? Recommended: the owner's choice at `fxbot hc on --user`, root by default, as herdr.
3. **The plugin's name:** `hc`, as the owner calls it, or `herdr-core`? Recommended: `hc`. Its tools read `hc_start`.
4. **Taking over from fxbot's page:** typing into an agent's terminal from the live view. Recommended: later, once a door can allow watching and not typing.
5. **Agents beyond Claude Code:** only those that report their status, as the first check finds. Recommended: as found.
6. **herdr's labels:** write `herdr.seen` when the owner opens an agent in fxbot, so herdr's apps agree? Recommended: yes, if the first check finds a command for it the door can allow.
