---
title: "Under the hood"
description: "What fxbot runs as, where its data lives, how it updates, and the ways in, at a glance. It's one small app with its database, on a machine of your own, made for one person."
---

What fxbot runs as, where its data lives, how it updates, and the ways in, at a glance. It's one small app with its database, on a machine of your own: the computer under your desk, a home server, or a small VPS.

| Part | What it is |
| --- | --- |
| Install | One command, [`setup.sh`](/docs/reference/commands/#setupsh). It checks the machine first, and adds podman or docker when neither is there. See [what it runs on](/docs/tutorials/first-fxbot/) and [what it creates](/docs/reference/install-layout/). |
| Runs as | Three containers: fxbot, Postgres with pgvector, and a local embedder for memory search |
| Agents | [libfx](https://fx.sh/docs/lib), one agent per provider |
| Data | Bots, chats, files, and keys, in Postgres on the machine, with every key and token sealed. Each message goes only to the provider its bot uses, or stays on your network with a local model server. |
| Updates | From **Settings**, with a backup first, and the release before when one doesn't start. See [Update to a new release](/docs/how-to/update/). |
| Ways in | `127.0.0.1:8787` on the machine. From other devices, web pairing, the recommended way, or Tailscale, SSH, or a proxy of your own. See [Reach fxbot from other devices](/docs/how-to/reach-it/). |
| Hosting | None. There's no hosted version, and no account to make. |
| People | One. fxbot has no login of its own, so whatever is in front of it decides who reaches it, and everyone who does sees every bot and every chat. See [Security](/docs/explanation/security/#loopback-only-with-no-login). |
