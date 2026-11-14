# herdr

A plugin for [fxbot](https://fxbot.sh): bots see the coding agents [herdr](https://herdr.dev) runs, on fxbot's machine and on herdr's saved machines, send them work, start new ones, and hear back when one is done.

- `herdr_agents` lists the agents on a bot's machines: each one's machine, name or pane id, kind, status, folder, and title. The chat shows how many, and **Show agents now** lists them.
- `herdr_read` reads an agent's recent lines.
- `herdr_prompt` sends a ready agent work and answers at once. When the agent finishes or stops to wait for you, its last lines reach the bot's own chat, from **herdr**, which wakes it.
- `herdr_start` starts an agent in a folder, in a tab of its own in herdr's **fxbot bots** workspace on that machine, and with a prompt, sends it work.
- The `herdr` skill tells bots how to use them.

The two that read are safe, so [Permissions](https://fxbot.sh/docs/how-to/choose-what-a-bot-can-do-alone/) runs them without asking. Sending work and starting agents go through the bot's mode. No tool presses keys, answers an agent's approval, interrupts an agent, or closes anything: you do those in herdr.

Add it from **Plugins**. It needs fxbot 0.9.0 or newer. It runs inside fxbot: read its code there before you add it. See [Work with your herdr agents](https://fxbot.sh/docs/how-to/work-with-herdr-agents/).

## Reaching herdr

The plugin runs only herdr's CLI:
- **Through the door,** when its socket exists. In a release install, `sudo fxbot herdr on` opens it, from `deploy/herdr-door` in fxbot's own repository: it checks every word of each command, and runs the allowed ones as herdr's user.
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
| `door` | The door's socket, as fxbot sees it | `/var/lib/fxbot/control/herdr.sock` |
| `herdr` | herdr's command, for a checkout | `herdr` |

A value outside its range means its default, with a line in the plugin's log.

## Tables

In the plugin's own schema, `plugin_herdr`, from `fxbot/migrations/0001_herdr.sql`:
- `watches`: each prompt, from the call to the agent's settled state, and whether the bot was told. Ended ones are kept 30 days.
- `workspaces`: the **fxbot bots** workspace on each machine, by its id there.
- `bots`: the machines a bot reaches, when you picked them.

Removing the plugin drops the schema.

## Files

| File | What it is |
| --- | --- |
| `plugin.json` | Its name, version, parts, and settings |
| `fxbot/server.ts` | The tools, herdr's CLI through the door or directly, the watches, and the routes |
| `fxbot/page.jsx` | The cards, a bot's machines, and the plugin's tab |
| `fxbot/page.js` | `page.jsx`, built |
| `fxbot/migrations/0001_herdr.sql` | Its three tables |
| `skills/herdr/SKILL.md` | How bots use the tools |

## Building it

`fxbot/page.js` is `fxbot/page.jsx` bundled with [rolldown](https://rolldown.rs), which comes with fxbot's packages. Run this in this folder, in a checkout of fxbot, after changing `page.jsx`:

```sh
npx rolldown fxbot/page.jsx --format cjs -e react -e react/jsx-runtime -e @fxbot/app --file fxbot/page.js
```

Commit both.
