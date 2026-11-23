# herdr

A plugin for [fxbot](https://fxbot.sh): bots see the coding agents [herdr](https://herdr.dev) runs, on fxbot's machine and on herdr's saved machines, send them work, start new ones, press keys in them, and hear back when one is done. You see each agent's terminal in fxbot, and type into it.

- `herdr_agents` lists the agents on a bot's machines: each one's machine, workspace, and tab, as herdr names them, its name or pane id for calls, its pane, its session's own name, kind, status, folder, and title. The chat shows how many, and **Show agents now** lists them.
- `herdr_read` reads an agent's recent lines.
- `herdr_prompt` sends a ready agent work and answers at once. When the agent finishes or stops to wait for you, its last lines reach the bot's own chat, from **herdr**, which wakes it.
- `herdr_start` starts an agent in a folder, in a tab of its own in herdr's **fxbot bots** workspace on that machine, with a label on its pane if the bot gives one, and with a prompt, sends it work.
- `herdr_keys` types text and presses keys in an agent's terminal, such as `1` and Enter at its question, or Escape to stop it, and answers with its screen after. When the keys leave it working, its answer comes back as a prompt's does.
- The `herdr` skill tells bots how to use them, and how to answer what the agents are doing. A bot says where an agent is in a sentence, with herdr's names: \"Claude in the thermite tab of fxbot on Local is idle.\"

The two that read are safe, so [Permissions](https://fxbot.sh/docs/how-to/choose-what-a-bot-can-do-alone/) runs them without asking. Sending work, starting agents, and keys go through the bot's mode. The skill tells a bot to answer another agent's question or approval only with your word. No tool closes anything, or types into a pane with only a shell in it.

**An agent's names.** The owner calls an agent by the label they gave its pane in herdr, and Claude Code names each of its sessions, such as `thermite-e9`, which its other sessions message it by. The plugin finds that name in Claude Code's own file for each running session, `~/.claude/sessions/<pid>.json`, on the machine fxbot runs on, reading only its id and name. Every tool's `agent` takes a target, a pane's label, or a session's name.

**Tags.** `@herdr:` in the message box lists your agents after your bots, each named by its pane's label, else its Claude Code session's name, else its kind and pane, such as `claude-w1p8`. `@` alone lists them too. A pick is a link that carries the agent's machine, pane, tab, session name and id, folder, and status, so the bot knows exactly which agent you mean, and the sent tag shows its status and opens its terminal. The plugin keeps every agent it sees in its own table, `panes`, synced every `sync` seconds. It needs a box with an `@` list, as [Messages](../messages/)' has.

**herdr itself, for you.** **herdr** in the sidebar opens herdr's own screen in a real terminal, xterm.js, running herdr's client on the machine fxbot runs on, so herdr draws everything and takes every key: its scrollback, the wheel, the mouse, copy, and its own keys. **Agents** lists every machine's agents, and an agent there, or its tag, or a prompt's card, opens that one agent full size with `herdr agent attach`. While it's attached, its pane takes your page's size in herdr. **Mobile**, a switch at the top, on by default on a phone and kept for each device, adds what a phone's keyboard lacks, Esc, Tab, the arrows, Enter, ^C, and Ctrl, quick answers, 1, 2, 3, y, and n, and a line to type with the phone's own keyboard, which **Send** types with Enter. On a touch screen, a drag scrolls as the wheel does. An agent on another machine, which herdr doesn't attach to from here, shows its screen read from herdr every second, with keys.

herdr's client runs in a pseudo-terminal that `fxbot/terminal.py` makes, so the machine needs `python3`. herdr's screen can open a pane, a shell as herdr's user, so the door opens it whenever it's open, as it does prompts: `--read-only` keeps it shut.

Add it from **Plugins**. It needs fxbot 0.11.0 or newer, which has its door. It runs inside fxbot: read its code there before you add it. See [Work with your herdr agents](https://fxbot.sh/docs/how-to/work-with-herdr-agents/).

## Reaching herdr

The plugin runs only herdr's CLI:
- **Through the door,** when its socket exists. In a release install, `sudo fxbot herdr on` opens it, from `deploy/herdr-door` in fxbot's own repository: it checks every word of each command, and runs the allowed ones as herdr's user. It reads a pane, or types into one, only when herdr says an agent is in it. Its `terminal` runs herdr's client for the page, with its own copy of `terminal.py`.
- **Directly,** otherwise: a checkout run by herdr's own user.

## Each bot's machines

A bot reaches every machine herdr has, and any it adds later, until you pick its machines under **herdr** in its settings, **Local**, the machine fxbot runs on, among them.

## Settings

| Setting | What it is | Default |
| --- | --- | --- |
| `kinds` | The agents bots may start | `claude, codex, opencode, pi` |
| `hours` | The most hours a bot waits for an agent's answer, 1 to 24 | `4` |
| `lines` | How many of an agent's last lines its answer carries, 20 to 400 | `80` |
| `watches` | The most prompts waiting for an answer at once, 1 to 16 | `8` |
| `sync` | How often, in seconds, the list of agents for `@herdr:` tags syncs, 30 to 3,600 | `60` |
| `door` | The door's socket, as fxbot sees it | `/var/lib/fxbot/control/herdr.sock` |
| `herdr` | herdr's command, for a checkout | `herdr` |

A value outside its range means its default, with a line in the plugin's log.

## Tables

In the plugin's own schema, `plugin_herdr`, from `fxbot/migrations/`:
- `watches`: each prompt, from the call to the agent's settled state, how herdr shows its agent, and whether the bot was told. Ended ones are kept 30 days.
- `workspaces`: the **fxbot bots** workspace on each machine, by its id there.
- `bots`: the machines a bot reaches, when you picked them.
- `panes`: every agent herdr has, on every machine, as the plugin last saw it, for tags. A machine that answers has its rows written and its gone agents removed, and one that doesn't keeps its rows.

Removing the plugin drops the schema.

## Files

| File | What it is |
| --- | --- |
| `plugin.json` | Its name, version, parts, and settings |
| `fxbot/server.ts` | The tools, herdr's CLI through the door or directly, the watches, the sessions' names, and the routes |
| `fxbot/terminal.py` | herdr's client in a pseudo-terminal, for the page's terminal: framed input, sizes, and what it draws |
| `fxbot/page.jsx` | The cards, a bot's machines, the plugin's tab, herdr's screen, the agents, and each agent's terminal |
| `fxbot/page.js` | `page.jsx`, built |
| `fxbot/xterm.js` | xterm.js and its fit addon, built as one file, which the page loads from a route, gzipped, once a terminal opens |
| `fxbot/xterm-licenses.txt` | Their licenses, MIT |
| `fxbot/page.css` | xterm.js's styles |
| `xterm.entry.js` | What `fxbot/xterm.js` is built from |
| `package.json` | xterm.js, for the build |
| `fxbot/migrations/` | Its four tables, and how a prompt's agent is shown |
| `skills/herdr/SKILL.md` | How bots use the tools |

## Building it

`fxbot/page.js` is `fxbot/page.jsx` bundled with [rolldown](https://rolldown.rs), which comes with fxbot's packages. `fxbot/xterm.js` is [xterm.js](https://xtermjs.org) and its fit addon, from `package.json`, kept apart so a page that shows no terminal doesn't carry it, and `fxbot/page.css` is xterm.js's `css/xterm.css`. Run these in this folder, in a checkout of fxbot, after changing `page.jsx` or `package.json`:

```sh
npm ci
npx rolldown fxbot/page.jsx --format cjs -e react -e react/jsx-runtime -e @fxbot/app --file fxbot/page.js
npx rolldown xterm.entry.js --format cjs --no-comments --file fxbot/xterm.js
cp node_modules/@xterm/xterm/css/xterm.css fxbot/page.css
```

Commit both.
