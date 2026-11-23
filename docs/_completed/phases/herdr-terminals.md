# herdr terminals

herdr 0.3.0 gives the owner and their bots more hands on the agents herdr runs:
- **Each agent's terminal, in fxbot.** A **herdr** button in the sidebar opens the agents on every machine. Picking one shows its terminal as herdr draws it, kept up to date while it's open, with a keyboard and a row of keys, so the owner can answer a question, approve, interrupt, or type, from the phone too.
- **A bot presses keys when the owner says so.** `herdr_keys` types text and presses keys in an agent's terminal, such as `1` and Enter at a question, or Escape to stop it. Permissions asks or judges each call, and the skill says to answer another agent only with the owner's word.
- **An agent's other name.** Claude Code names its sessions, such as `thermite-e9`, and its sessions message each other by those names. herdr shows the pane's label and the agent's title instead. The agents list now gives each Claude agent's own name too, and a bot can name an agent by any of the three.

Status: planned and built on 2026-11-23, for 0.11.0, at the owner's `/goal` from [issue #20](https://github.com/iammrduncan/fxbot/issues/20): "Bots get confused on named panes vs agent identities like Claude's agent names for same machine Claude messaging", "Herdr needs more power for interactions. Prompt and read only don't work for direct commands or answering pop up questions etc", and "look at adding terminal panes for herdr agents into fxbot UI somewhere via plugin so that I can do manual intervention to herdr". It builds on [herdr](herdr.md) 0.2.0, as herdr 0.3.0, and takes the nearer half of the [herdr screen](../../phases/herdr-screen.md) stub: the agents' terminals, not herdr's whole interface. Where the build differs from the plan, [What the build changed](#what-the-build-changed) says so.

## 0. Core or plugin

**Plugin.** All of it is the herdr plugin's, through what the plugin API already has: a tool, routes, `app.nav` for the sidebar button, and `app.route` for its two screens. The core never names herdr, and no hook is added. The door, `deploy/herdr-door`, takes four more commands.

## 1. Research

**herdr 0.9.3, on this machine, in a session of its own (`fxbot-check`), never the owner's:**
- `pane read <pane> --source visible --format ansi` gives the screen as herdr draws it: lines of text with color codes (SGR) only, no cursor moves, about 3 KB, in 3 ms. `--source recent --lines <n>` gives earlier lines too. The snapshot gives each pane a `revision` and its rows.
- `pane send-keys <pane> <key>...` checks every key before it writes one, and takes a single character (`1`, `y`, `?`, `é`), `enter`, `esc`, `tab`, `shift+tab`, `backspace`, `space`, `up`, `down`, `left`, `right`, `shift+<arrow>`, `f1` to `f12`, `ctrl+<key>`, and `alt+<key>`, in any case. It refuses `pageup`, `home`, `end`, `delete`, and a word such as `ab`. `pane send-text <pane> <text>` types text as it is.
- `agent send-keys` takes only an agent herdr started with a name, and answers `agent_not_ready` for one the owner started in a pane, which is most of them. So keys go to the agent's pane.
- `agent get <pane>` answers `agent_not_found` for a pane with only a shell in it. The door asks it first, so it types only where an agent is.
- herdr 0.9.3 has no stream of a pane's output on the CLI. Its socket API has `events.subscribe` with `pane_output_changed`, which only the raw socket gives, and the door doesn't. A screen open in the page asks again every second, which costs one `pane read` a second on the machine, and only while it's open.

**The owner's agents** (read-only): each Claude agent in herdr's snapshot has `agent_session.value`, Claude Code's own session id. Claude Code keeps a file for each running session, `~/.claude/sessions/<pid>.json`, with its `sessionId` and its `name`, such as `thermite-e9`, the name its other sessions message it by. That file has no secret: the session's peer token is in a separate `.key` file, which nothing here reads. So a pane labeled `patcher` in herdr, titled "Fix the flaky test", is the session `thermite-e9` to the owner's other Claude sessions, and nothing told the bot so. The files are on the machine the agent runs on, and herdr forwards no files, so names are found on Local only.

**The references:**
- The Herdr app and Herdr for phones, on herdr-core: the point of both is the agents' terminals, typed into from a phone. "Type, paste a screenshot or talk." They stream a terminal over herdr-core's own connection, which the TUI fxbot drives doesn't have ([hc](../../phases/hc.md) plans that runtime).
- fxbot's computer plugin: the owner's own terminal on a bot's computer is xterm.js over a WebSocket (`plugins/computer/fxbot/page.jsx`), and **Take over** hands its desktop to the owner. herdr's screen is already drawn by herdr, so it needs no terminal emulator in the page: it's text with colors.
- herdr's own guide: "Use logical keys for interactive agent UI controls", "If a wait fails or returns blocked, inspect agent get and agent read before deciding what input to send", and "Use the pane surface only when raw terminal control is intentional."

## 2. Key takeaways

1. **Keys go to an agent's pane, never to a shell.** The door asks `agent get` before it reads a pane or types into one. The plugin checks the same against herdr's snapshot, to answer clearly first.
2. **No terminal emulator.** herdr draws the screen. The page shows its text and colors, and asks again every second while it's open. A stream is later, through hc or a newer herdr.
3. **The bot answers another agent only with the owner's word,** as the skill said before, but now it can carry that word itself instead of sending the owner to herdr. Permissions judges each `herdr_keys` call.
4. **Names are matched, not guessed.** The list shows each Claude agent's own name, and a tool takes a target, a pane's label, or that name. Two that fit are a question for the owner.

## 3. Implementation

### The tool: `herdr_keys({ agent, machine?, text?, keys? })`

Not `safe`, not `idempotent`. `text` is typed first, up to 4 KiB with no control characters, then `keys` are pressed, up to 32, each one of herdr's names above. It finds the agent's pane in the snapshot, types and presses, waits a second and a half, and answers with the agent's status and its screen as it is now: "Pressed 1, enter in Claude "patcher" (thermite-e9) in tab 1 of workspace 1 on Local. It's working now. Its screen: """…""" Its answer comes to you when it's done." When the agent is working after it, and nothing follows it yet, a watch follows it as one after `herdr_prompt` does, so its answer comes back by itself.

### Names

- `herdr_agents`' rows gain `session`: the agent's own name for its session, where fxbot can find it. On Local in a checkout run as herdr's user, the plugin reads `~/.claude/sessions/*.json` itself, only `sessionId` and `name`. Through the door, the new `sessions` command does it as herdr's user. Kept 10 seconds.
- Every tool's `agent` takes a target, a pane's label, or a session's name, matched on that machine. A word that fits two agents answers with both, for the bot to ask the owner.
- An agent in words says its session's name after its label: `Claude "patcher" (thermite-e9) in tab 1 of workspace 1 on Local`.
- The tools' descriptions and the skill say an agent may have three names, and that the owner may use any of them.

### The owner's terminals

- **`app.nav`:** a **herdr** button in the sidebar's footer, to `/herdr/agents`.
- **`/herdr/agents`:** every machine's agents, as the agents card's table shows them, with each agent's own name, and each row opens its terminal. Asked again every 5 seconds while it's open.
- **`/herdr/agents/:machine/:pane`:** the agent in words, its status, and its screen, asked every second while the page is in view and once at once after a key. **Earlier lines** shows 400 recent lines instead. Below it, keys as buttons (Esc, Tab, ↑, ↓, ←, →, Enter, Ctrl+C, 1, 2, 3), and a line to type in, with **Send**, which types it and presses Enter. On a computer, the screen takes the keyboard once it's clicked: letters are typed, and Enter, Escape, Tab, Backspace, the arrows, F-keys, and Ctrl or Alt with a key are pressed.
- **Links:** the agents card's rows, and a prompt's card, open the agent's terminal.
- **Routes:** `GET /screen?machine=&pane=&earlier=` gives `{ text, status, shown }`, and `POST /keys` takes `{ machine, pane, text?, keys? }`. Both are the owner's, on any machine herdr has, whatever a bot may reach.

### The door

| Command | Its other words | `--read-only` |
| --- | --- | --- |
| `sessions`, only without `--machine`: each running Claude Code session's id and name, from herdr's user's `~/.claude/sessions/*.json` | none | yes |
| `pane read <w<n>:p<n>> --source visible\|recent --format ansi --lines <n>`, only for a pane with an agent in it | `n` from 1 to 1,000 | yes |
| `pane send-keys <w<n>:p<n>> <key>...`, only for a pane with an agent in it | 1 to 32 keys, each one of herdr's names | no |
| `pane send-text <w<n>:p<n>> <text>`, only for a pane with an agent in it | up to 4 KiB, no control characters | no |

It asks `agent get <pane>` on the same machine first, and refuses when no agent is there. `pane` commands stay refused otherwise: `run`, `split`, `close`, and the rest.

### Cost

One `pane read` and one `agent get` a second for each terminal open in the page, 2 to 3 ms each here, or 200 to 360 ms on another machine, and nothing when none is open.

### Not in this phase

- A live stream of a pane, and herdr's whole interface: [herdr screen](../../phases/herdr-screen.md).
- Typing into a pane with only a shell in it.
- Claude Code's names on other machines: herdr forwards no files.

## 4. Checklist

All against a herdr session of its own, `fxbot-check`, with no `HERDR_*` variables from the owner's pane, and a stand-in agent: a script that asks a question in color and prints each key it gets, reported to herdr as Claude. A check fxbot with herdr and Permissions, a mock model, and Chromium. Never the owner's herdr, except one read-only look at their agents' names, and Claude Code's session files, read only.

- [x] `herdr_keys` types `hi` and presses `2`, `Enter`, `ESC`, and `A` in the stand-in, and the stand-in got exactly `h`, `i`, `2`, a newline, an escape, and `A`. Its answer says what it pressed, in whom, its status, and its screen after them.
- [x] `herdr_keys` refuses: a shell pane, `pageup`, 33 keys, text with a newline, text over 4 KiB, and a call with neither text nor keys. The stand-in got nothing from any, and the shell pane nothing at all.
- [x] After keys that leave the agent working, a watch follows it, and its answer, "All done: the answer is 42.", reaches the bot's chat once, with what was pressed.
- [x] Permissions on `ask` shows a card for `herdr_keys`, nothing is typed while it waits, a denied call types nothing, and one allowed once types. `herdr_agents` asks nothing.
- [x] `herdr_agents` gives `session` for an agent whose session file names it. `herdr_read` with that name, and with a pane's label in another case, reads that agent. A name no agent has says so.
- [x] The door, run as a script against the check session: `sessions`, `pane read`, `pane send-keys`, and `pane send-text` answer, and the stand-in got the keys. Refused: a shell pane, for reading and for keys, `pageup`, `é` as a key, 33 keys, text with a newline, text over 4 KiB, `pane run`, `pane close`, and `sessions` with `--machine`. `--read-only` refuses keys, and reads still work. `bash -n` passes.
- [x] The page in Chromium, a desktop in light and a phone in dark, no page errors: the sidebar's **herdr** button, the agents screen, a terminal at its own address with the stand-in's colors and status, Esc and `2` from the key row, the line and **Send**, the keyboard once the screen is clicked (`ab`, ↑, Ctrl+X), **Earlier lines**, and a prompt card's link to the terminal.
- [x] `npm run typecheck`, with "fxbot's plugins fit 0.11.0", `npm run build-site`, where all 14,847 links in 125 pages resolve, and `git diff --check`.

**Only a person can check:** answering a real Claude Code's approval from the phone, and a bot pressing a key the owner named.

## 5. Open questions

1. **Keys through the door by default?** Recommended: yes, as prompts are, since a prompt already types into an agent, and `--read-only` still refuses both. Keys can approve what an agent asks, so each bot's call goes through Permissions.
2. **A shell pane's terminal for the owner?** Recommended: not in this phase. The door types only where an agent is, so nothing in fxbot's container can type a command into a shell.

## What the build changed

- **herdr counts ids past 9 with letters,** such as `wA:p1` and `wB:pA`, which the checks met once the session had made ten workspaces. herdr 0.2.0's pattern took digits only, in the plugin and in the door, so an agent in an owner's tenth pane, or tenth workspace, couldn't be read or prompted. The plugin, the door, and the page take letters and digits now. The owner's herdr is at `w1:p9`.
- **A prompt's card links from its own call,** the agent and machine it named, not from its watch, so the link is there when the prompt failed too, and the terminal finds an agent named by its label or its session.
- **A key of one character is printable ASCII,** in the plugin and the door, which compares bytes. Anything else is typed as text.
- **The stand-in:** herdr takes an agent's session only from its own Claude integration's source, `herdr:claude`, and once it has one, takes the agent's states only from there too. So one stand-in has a session, for the names, and another has none, for the work herdr sees. herdr refuses a prompt to an agent whose process isn't the pane's, so the stand-in, a script, can't be prompted: a prompt's card was checked with a prompt that failed.
- **A half-written `server.ts` ended dev's API.** Dev reloads a plugin on each write, and between two edits, a bot's `herdr_read` reached a tool that called the new lookup without waiting for it. Its rejection went unhandled, and Node ended the process, for about three minutes, until the API was restarted. The plugin was right once whole.

**Later:** [herdr screen](herdr-screen.md) replaced the owner's terminal for an agent on this machine with herdr's own client, in a real terminal, at the owner's word: the terminal read from herdr couldn't scroll back. An agent on another machine still opens as this one did.
