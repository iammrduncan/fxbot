---
title: "Your first fxbot"
description: "In this tutorial you install fxbot on a Linux machine, open it on your phone, and chat with a bot you made."
---

In this tutorial you install fxbot on a Linux machine, open it on your phone, and chat with a bot you made.

You need:

- a Linux machine with systemd, where you can use `sudo`: Debian 12 or 13, Ubuntu 22.04 or 24.04, Fedora, AlmaLinux 9 or 10, openSUSE Tumbleweed or Leap 16, Arch, or a distro built on one of them. It needs an x86_64 or arm64 CPU, 3 GB free in `/var/lib`, and 1 GB of memory free, more for each bot's computer. On a Mac or on Windows, use a Linux machine, or a Linux VM.
- [Tailscale](https://tailscale.com/download) on that machine and on your phone, in the same tailnet, with [HTTPS turned on](https://tailscale.com/kb/1153/enabling-https). This tutorial uses it to reach fxbot from your phone, the recommended way; fxbot itself doesn't need it.
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
  from your computer, over SSH:  ssh -N -L 8787:127.0.0.1:8787 <you>@<this machine>
  from your phone, with Tailscale:  sudo tailscale serve --bg 8787
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

## Reach it from your phone

Using fxbot only on this machine? Open `http://127.0.0.1:8787` there, and carry on at the next step. Otherwise, serve it on your tailnet:

```sh
sudo tailscale serve --bg 8787
```

Tailscale prints the address it serves, `https://<machine>.<tailnet>.ts.net`. Open that address on your phone. fxbot shows **Set up fxbot**.

Install it as an app:

- **Android, in Chrome:** open Chrome's menu, and tap **Add to Home screen** or **Install app**.
- **iPhone:** tap **Share**, then **Add to Home Screen**, and leave Open as Web App on.

Open fxbot from the home screen. It opens on its own, without the browser's bars.

## Set up fxbot

The first time you open it, fxbot shows **Essentials**: the plugins most people want, each with what it gives you. One of them, the computer, sets up a computer engine on this machine, then restarts fxbot, and it says so there. Web pairing, which opens fxbot on your phone, isn't among them: add it from **Plugins** when you want it.

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

## Chat

Send `Hello! What can you do?`. While Scout works, its blob in the sidebar hops and looks around, and the reply streams in as it is written.

Now close the app and open it again. The chat is still there, because it lives on the server, not in the page. A reply still being written when you leave carries on without you.

## Give it instructions

Open the bot panel with the button at the top right of the chat, then **Edit**. Under **Instructions**, write `Answer in one short paragraph.` and tap **Save**. Ask Scout something else, and notice the shorter reply.

## What you have now

A release of fxbot, served on your tailnet and installed on your phone, with a provider and a bot that keeps its chat. From here:

- [Add a skill](/docs/how-to/add-a-skill/) to give your bots instructions for a kind of task.
- [Add an MCP server](/docs/how-to/add-an-mcp-server/) to give your bots tools.
- [Serve fxbot at its own name](/docs/how-to/tailscale-service/), such as `bot.<tailnet>.ts.net`, or [reach it another way](/docs/how-to/reach-it/).
- Read about [bots, chats, memories, and the library](/docs/explanation/bots-and-chats/), and the [security model](/docs/explanation/security/).
