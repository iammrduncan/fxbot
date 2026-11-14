---
title: "Work with your herdr agents"
description: "Bots see the coding agents herdr runs, on fxbot's machine and on herdr's saved machines, send them work, start new ones, and hear back when one is done. You choose each bot's machines."
---

[herdr](https://herdr.dev) runs coding agents, such as Claude Code and Codex, in terminal panes, on your machine and on the machines you saved in it. With the herdr plugin, a bot sees those agents, reads what they show, sends them work, starts new ones, and hears back when one is done.

1. Add **herdr** from **Plugins**, on **Browse**. It isn't in **Essentials**. It needs fxbot 0.9.0 or newer.
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

The door is a socket in fxbot's control folder that takes a short list of herdr's commands, checks each word, and runs them as herdr's user: list and read agents, send one a prompt, wait for it, and start one. It never types into a terminal, presses keys, passes an agent flags of its own, or changes herdr. To let bots look but not send work or start agents, add `--read-only`. `sudo fxbot status` says whether it's open, and `sudo fxbot herdr off` closes it.

`fxbot herdr on` also asks each saved machine the way the door will, with no SSH agent, and names any it can't reach. A machine whose SSH key has a passphrase needs it loaded where the door sees it.

**A checkout** run by herdr's own user reaches herdr directly, with nothing to open. One run by another user can't.

The plugin's tab in **Settings** says how fxbot reaches herdr, herdr's version, and whether each machine answers, this one first.

## Choose each bot's machines

Each bot reaches every machine, with any herdr adds later, until you choose. In a bot's settings, under **herdr**, turn off **Every machine** and pick its machines, this machine among them, by its name. Bots can call it by its name too, or "here". On the others, the bot doesn't see agents, can't send them work, and can't start them.

So one bot can work on every machine but this one, and a bot you keep for the machines' own upkeep can reach this one too. How careful each one is is up to its instructions and its [Permissions](/docs/how-to/choose-what-a-bot-can-do-alone/) mode: a bot on **Ask** asks you before every prompt and every start.

## Work it hands on

- **A prompt** goes to an agent that's ready. The bot gets an answer at once, and carries on. When the agent finishes, or stops to wait for you, its last lines reach the bot's chat as a message from **herdr**, which wakes the bot, and it tells you what happened. A card in the chat follows the prompt, from **Working on it** to **Answered**.
- **An agent it starts** opens in a tab of its own, in a workspace named **fxbot bots** on that machine, so it stays out of your own tabs. It starts with its own settings there: one that asks before acting still asks.
- **An agent waiting for you,** at an approval or a question, is yours to answer in herdr. The bot tells you which one is waiting, and where. It never answers one, and it never presses keys, interrupts an agent, or closes a tab: you do those in herdr.

A bot waits for an answer up to `hours`, 4 by default. Past that, it says the agent is still working, and stops waiting. If fxbot restarts meanwhile, it picks the wait up again, and the answer still comes once.

## Settings

| Setting | What it is | Default |
| --- | --- | --- |
| `kinds` | The agents bots may start | `claude, codex, opencode, pi` |
| `hours` | The most hours a bot waits for an agent's answer, 1 to 24 | `4` |
| `lines` | How many of an agent's last lines its answer carries, 20 to 400 | `80` |
| `watches` | The most prompts waiting for an answer at once, 1 to 16 | `8` |
| `door` | The door's socket, as fxbot sees it | `/var/lib/fxbot/control/herdr.sock` |
| `herdr` | herdr's command, for a checkout | `herdr` |

## What it costs

- **Each message to a bot it's on for:** four tools, about 450 tokens, cached with the rest, and the skill's line.
- **A call:** herdr's own time, about 2 ms on this machine and a few hundred on another. A list asks every machine at once.
- **A prompt waiting for an answer:** one open connection to herdr until the agent settles.
- **Idle:** nothing.
