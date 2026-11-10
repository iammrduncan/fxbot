---
title: "Your first fxbot"
description: "In this tutorial you install fxbot on a machine of yours, make a bot, put fxbot on your phone, and chat with the bot there."
---

In this tutorial you install fxbot on a machine of yours, make a bot, put fxbot on your phone, and chat with the bot there.

You need:

- a Linux machine with systemd, where you can use `sudo`: Debian 12 or 13, Ubuntu 22.04 or 24.04, Fedora, AlmaLinux 9 or 10, openSUSE Tumbleweed or Leap 16, Arch, or a distro built on one of them. On Windows, WSL 2's Ubuntu works, with systemd on ([how](/docs/how-to/fix-an-install/)). On a Mac, use a Linux VM. It needs an x86_64 or arm64 CPU, 3 GB free in `/var/lib`, and 1 GB of memory free, more for each bot's computer.
- a browser on that machine, or, for a server with no screen, SSH to it from your computer
- a phone, for the last part
- an account to sign in with, such as a ChatGPT plan or OpenRouter, or a key from a provider such as OpenAI or Groq

## Install fxbot

On the machine, run:

```sh
curl -fsSL https://fxbot.sh/setup.sh | sudo bash
```

The script checks the machine first, and stops with what to do if it can't install there ([Fix an install that stopped](/docs/how-to/fix-an-install/)). Then it names each step in bold as it goes: the container engine, Compose, the fxbot user and its key, the release, the images, and the services. fxbot runs as three containers: the app, its database, and the local embedder for memory search. The script uses the engine that's there, a Docker that's running or podman, and with neither, it installs podman, or Docker's own `docker-ce` where the distro's podman is too old. Downloading the three images can take a few minutes, with their progress shown, and the embedder downloads its model, 310 MB, on its first start. It ends with:

```
fxbot <version> runs on http://127.0.0.1:8787
Open it there, or reach it:
  from your phone: add Web pairing in Plugins (https://fxbot.sh/docs/how-to/reach-it-from-your-phone/)
  from your computer, over SSH:  ssh -N -L 8787:127.0.0.1:8787 <you>@<this machine>
  with Tailscale:  sudo tailscale serve --bg 8787
Settings shows each new release, with an Update button. To uninstall: sudo fxbot uninstall
```

Ask it whether it is up:

```sh
curl http://127.0.0.1:8787/api/health
```

It answers `{"ok":true,"version":"<version>"}`. fxbot is running, but only this machine can reach it. To see its containers:

```sh
sudo fxbot status
```

It names the version, the engine, and where the local embedder runs, then lists three containers, `fxbot`, `db`, and `embed`.

## Open it

On the machine, open `http://127.0.0.1:8787` in a browser. fxbot shows **Set up fxbot**.

On a server with no screen, run this on your computer instead, and keep it running:

```sh
ssh -N -L 8787:127.0.0.1:8787 <you>@<the machine>
```

While it runs, open `http://127.0.0.1:8787` on your computer.

## Set up fxbot

The first time you open it, fxbot shows **Essentials**: the plugins most people want, each with what it gives you. One of them, the computer, sets up a computer engine on this machine, then restarts fxbot, and it says so there. Web pairing, which puts fxbot on your phone, isn't among them: you'll add it at the end.

Tap **Set up Essentials**. fxbot adds them one by one, and moves on by itself. To pick your own instead, tap **Choose my own**, where they're already ticked, and untick what you don't want. Plugins you leave out are under **Plugins** for later.

<img class="shot dark:sl-hidden" src="/shots/setup-choose-desktop-light.png" width="1280" height="1000" alt="First-run setup, on Essentials: the plugins most people want, each with what it gives you" />
<img class="shot light:sl-hidden" src="/shots/setup-choose-desktop-dark.png" width="1280" height="1000" alt="First-run setup, on Essentials: the plugins most people want, each with what it gives you" />

### Connect a model

fxbot lists the providers it can connect to, with sign-ins first. Tap **ChatGPT and Codex**, under **Sign in**.

fxbot shows a code, and a QR of its link. Open the link, or scan the QR with your phone, sign in to ChatGPT, and enter the code. The page moves on by itself once you have.

With a key instead, tap the provider under **Use a key**, such as **OpenAI** or **OpenRouter**. Its card links to the page where its keys are made. Paste the key, and tap **Add**. fxbot checks the key with the provider before it keeps it.

Then pick the model your bots use, and tap **Continue**.

<img class="shot dark:sl-hidden" src="/shots/setup-provider-desktop-light.png" width="1280" height="800" alt="First-run setup, on Connect a model, with sign-ins first" />
<img class="shot light:sl-hidden" src="/shots/setup-provider-desktop-dark.png" width="1280" height="800" alt="First-run setup, on Connect a model, with sign-ins first" />

### Make a bot

Name the bot `Scout`, pick how it looks, or tap **Surprise me**, and tap **Create**. As you choose, the bot watches.

fxbot says where plugins live for later. Tap **Start chatting**, and Scout's chat opens.

If you leave partway, fxbot comes back to the same step. **Skip for now** skips the step it's on, and on the bot step, the last, it ends setup. Everything a step does is still there later: **Plugins** at the foot of the sidebar, **Settings** › **Providers**, and **New bot**.

<img class="shot dark:sl-hidden" src="/shots/setup-bot-desktop-light.png" width="1280" height="800" alt="First-run setup, on Make a bot, with the look picker" />
<img class="shot light:sl-hidden" src="/shots/setup-bot-desktop-dark.png" width="1280" height="800" alt="First-run setup, on Make a bot, with the look picker" />

## Put it on your phone

Before you say hello, put fxbot on your phone. Web pairing opens your fxbot at [web.fxbot.sh](https://web.fxbot.sh), on your phone, over a connection straight to it, away from home too.

1. In fxbot, open **Plugins**, find **Web pairing**, and add it.
2. On your phone, open web.fxbot.sh and install it:
   - **iPhone:** in Safari, tap **Share**, then **Add to Home Screen**. Open fxbot from the Home Screen.
   - **Android:** in Chrome, tap **Install app** in its menu, and open the app.
3. In fxbot, open **Settings** › **Web pairing**, and choose **Pair a device**. It shows a code and a QR code.
4. On your phone, in the app, choose **Pair a device**, and type the code. On Android, **Scan the QR code** scans it instead.
5. Both screens show six digits. Check they're the same, then choose **Approve** in fxbot.

The phone says **Paired**. Tap **Open**: your fxbot fills the screen, with your bots, plugins, and settings. Open Scout's chat.

To check it'll connect away from home, see **Settings** › **Web pairing** › **Reachability**. A network that won't connect directly has [other ways](/docs/how-to/when-a-device-cant-connect/).

## Chat

On your phone, send `Hello! What can you do?`. The reply streams in as it is written, and the same chat on the machine shows it too.

Now close the app and open it again. The chat is still there, because it lives on your fxbot, not in the app. A reply still being written when you leave carries on without you.

## Give it instructions

Open the bot panel with the button at the top right of the chat, then **Edit**. Under **Instructions**, write `Answer in one short paragraph.` and tap **Save**. Ask Scout something else, and notice the shorter reply.

## What you have now

A release of fxbot, on your machine and paired with your phone, with a provider and a bot that keeps its chat. From here:

- [Put fxbot on your computer too](/docs/how-to/reach-it-from-your-computer/), as an app of its own.
- [Add a skill](/docs/how-to/add-a-skill/) to give your bots instructions for a kind of task.
- [Add an MCP server](/docs/how-to/add-an-mcp-server/) to give your bots tools.
- [Pair another device](/docs/how-to/pair-another-device/), so a phone that loses its pairing can pair again from anywhere, or [reach it another way](/docs/how-to/reach-it/), such as Tailscale.
- Read about [bots, chats, memories, and the library](/docs/explanation/bots-and-chats/), and the [security model](/docs/explanation/security/).
