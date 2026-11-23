---
title: "Work with your herdr agents"
description: "Bots see the coding agents herdr runs, on fxbot's machine and on herdr's saved machines, send them work, start new ones, press keys in them, and hear back when one is done. You see each agent's terminal and type into it, and choose each bot's machines."
---

[herdr](https://herdr.dev) runs coding agents, such as Claude Code and Codex, in terminal panes, on your machine and on the machines you saved in it. With the herdr plugin, a bot sees those agents, reads what they show, sends them work, starts new ones, answers their questions when you say so, and hears back when one is done. You see each agent's terminal in fxbot, and type into it.

1. Add **herdr** from **Plugins**, on **Browse**. It isn't in **Essentials**. It needs fxbot 0.11.0 or newer, and tags need Messages 0.2.1.
2. Let fxbot reach herdr, below.
3. Choose each bot's machines, below, or leave them all on.
4. Ask a bot: "What are my agents doing?", "Have the Codex on lab-2 run the tests and tell me what fails", or "Start a Claude in ~/api and have it review the open diff."

## Let fxbot reach herdr

**A release install** runs fxbot in a container, which can't reach herdr. Open the plugin's door to it, on the machine:

```sh
sudo fxbot herdr on
```

It runs as root, and herdr runs as root there. When herdr runs as another user, name it:

```sh
sudo fxbot herdr on --user <login>
```

The door is a socket in fxbot's control folder that takes a short list of herdr's commands, checks each word, and runs them as herdr's user: list and read agents, send one a prompt, wait for it, start one, and type and press keys in one. Its commands read a pane, or type into one, only when herdr says an agent is in it, never a shell. herdr's own screen, for [herdr in fxbot](#use-herdr-in-fxbot), is the exception. It never passes an agent flags of its own, or changes herdr. To let bots and you look but not send work, keys, or start agents, add `--read-only`. Opened by an older fxbot, the door takes keys once `fxbot update` brings the new one. `sudo fxbot status` says whether it's open, and `sudo fxbot herdr off` closes it.

`fxbot herdr on` also asks each saved machine the way the door will, with no SSH agent, and names any it can't reach. A machine whose SSH key has a passphrase needs it loaded where the door sees it.

**A checkout** run by herdr's own user reaches herdr directly, with nothing to open. One run by another user can't.

The plugin's tab in **Settings** says how fxbot reaches herdr, herdr's version, and whether each machine answers, Local first.

## Choose each bot's machines

Each bot reaches every machine, with any herdr adds later, until you choose. In a bot's settings, under **herdr**, turn off **Every machine** and pick its machines, **Local**, the machine fxbot runs on, among them. On the others, the bot doesn't see agents, can't send them work, and can't start them.

So one bot can work on every machine but this one, and a bot you keep for the machines' own upkeep can reach this one too. How careful each one is is up to its instructions and its [Permissions](/docs/how-to/choose-what-a-bot-can-do-alone/) mode: a bot on **Ask** asks you before every prompt and every start.

## Name your agents

Give an agent's pane a label in herdr, and bots call the agent by it. From any pane on that machine:

```sh
herdr pane rename w1:p8 patcher
```

Then a bot says: Claude "patcher" in the thermite tab of fxbot on Local is working. A label stays with the pane, so a new agent there keeps it. A bot that starts an agent gives its pane a label of its own, saying what it's for.

Claude Code names its sessions too, such as `thermite-e9`, and its sessions message each other by those names. The plugin reads each running Claude's name on the machine fxbot runs on, so a bot lists it beside the label, Claude "patcher" (thermite-e9), and you can use either: "ask thermite-e9 what's left." On other machines, it has the label and the title.

## Work it hands on

A bot says where an agent is in a sentence, with herdr's names, so you can find it in herdr: "Claude in the thermite tab of fxbot on Local is idle." Local is the machine fxbot runs on.

- **A prompt** goes to an agent that's ready. The bot gets an answer at once, and carries on. When the agent finishes, or stops to wait for you, its last lines reach the bot's chat as a message from **herdr**, which wakes the bot, and it tells you what happened. A card in the chat follows the prompt, from **Working on it** to **Answered**.
- **An agent it starts** opens in a tab of its own, in a workspace named **fxbot bots** on that machine, so it stays out of your own tabs. It starts with its own settings there: one that asks before acting still asks.
- **An agent waiting for you,** at an approval or a question: the bot tells you which one is waiting, where, and what it asks. Answer it yourself in its terminal, below, or in herdr, or tell the bot what to answer: "say yes", "pick 2". Only then does it press keys, and it tells you what it pressed and what the agent shows now. It can stop an agent with Escape the same way. It never closes a tab.

## Tag an agent

Tag an agent in a bot's chat as you tag a bot: type `@herdr:` and pick it, or `@` and its name. Each agent is named by its pane's label, else its Claude Code session's name, else its kind and pane, such as `claude-w1p8`. The tag carries which agent it is: its machine, pane, tab, session name and id, folder, and status as you sent it, so the bot doesn't have to guess, and it reads the agent again before it acts. In your message, the tag shows the agent's status now, and opens its terminal.

The plugin keeps every agent it sees, on every machine, and syncs the list every minute, or as you set `sync`, so the list is there as you type. Tags need the [Messages](/docs/how-to/let-bots-work-together/) plugin's box, where `@` tags a bot.

## Use herdr in fxbot

**herdr** in the sidebar opens herdr itself, in a real terminal in the page: its own screen, as in a terminal on the machine, with its scrollback, the wheel, the mouse, copy, and its keys. **Agents** lists every machine's agents, and one there, or its tag, or a prompt's card's **Open its terminal**, opens that one agent full size, attached with herdr's own client. While you're attached, its pane takes your page's size in herdr, and goes back when you leave.

- **Mobile,** a switch at the top, is on by default on a phone, and each device keeps your choice. It adds what a phone's keyboard lacks: Esc, Tab, the arrows, Enter, ^C, and Ctrl, which holds for the next key; quick answers, 1, 2, 3, y, and n, for a question or a menu; and a line to type in with your phone's keyboard, its corrections and dictation, which **Send** types and presses Enter. On a touch screen, a drag scrolls, as the wheel does.
- **An agent on another machine** opens as its screen read from herdr, kept up to date, with a row of keys and a line to type in: herdr attaches only on its own machine.
- **It needs `python3`** on the machine fxbot reaches herdr on, for the terminal.

herdr's screen can open a pane, a shell as herdr's user, so a release's door opens it whenever the door is open. `--read-only` keeps it shut, with the rest of what types.

A bot waits for an answer up to `hours`, 4 by default. Past that, it says the agent is still working, and stops waiting. If fxbot restarts meanwhile, it picks the wait up again, and the answer still comes once.

## Settings

| Setting | What it is | Default |
| --- | --- | --- |
| `kinds` | The agents bots may start | `claude, codex, opencode, pi` |
| `hours` | The most hours a bot waits for an agent's answer, 1 to 24 | `4` |
| `lines` | How many of an agent's last lines its answer carries, 20 to 400 | `80` |
| `watches` | The most prompts waiting for an answer at once, 1 to 16 | `8` |
| `sync` | How often, in seconds, the list of agents for tags syncs, 30 to 3,600 | `60` |
| `door` | The door's socket, as fxbot sees it | `/var/lib/fxbot/control/herdr.sock` |
| `herdr` | herdr's command, for a checkout | `herdr` |

## What it costs

- **Each message to a bot it's on for:** five tools, about 1,200 tokens, cached with the rest, and the skill's line.
- **A call:** herdr's own time, about 2 ms on this machine and a few hundred on another. A list asks every machine at once.
- **A prompt waiting for an answer:** one open connection to herdr until the agent settles.
- **herdr's screen open in the page:** one herdr client while it's open, and nothing to herdr in between: it sends what changes. An agent on another machine, two herdr calls a second while it's in view.
- **The list for tags:** herdr's list on every machine every minute, as `herdr_agents` asks for it.
- **Idle:** nothing else.
