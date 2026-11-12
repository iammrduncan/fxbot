# fxbot

Join the Hackers in the Loop community on [Discord](https://discord.gg/3Qs2uejUf9) to talk about fxbot, share what you build with it, and get help.

fxbot is AI assistants that do real work, built your way. Each one chats, remembers, works on a computer of its own, and runs tasks on a schedule. Pick its model, hosted or local, its look, and what it can do, and talk to it from any browser or the fxbot app on your phone. It's an open alternative to OpenClaw, Hermes Agent, Grok Bot, Muse, Claude Duet, and OpenAI's dots: free and open source, lighter, fully featured, and made to be good to use.

- **Any model.** Sign in with ChatGPT, Grok, or OpenRouter, add a key for Claude, Gemini, or about 30 others, or run one with Ollama or LM Studio. Each bot can use a different one.
- **On your phone.** The fxbot app, away from home too, with [web pairing](https://fxbot.sh/docs/how-to/reach-it-from-your-phone/). No VPN needed.
- **Yours.** One command installs it on your own machine, and your bots, chats, files, and keys stay with you. Add only what you want them to do, as plugins: a computer of their own, routines, subagents, pages, and more.

Under the hood, one Node server and Postgres run on your machine, and the browser is the UI on desktop and mobile. [libfx](https://fx.sh/docs/lib) sends each chat to the provider its bot uses.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="packages/website/public/shots/hero-desktop-dark.png">
  <img src="packages/website/public/shots/hero-desktop-light.png" width="1280" alt="fxbot in a desktop browser: Juniper's chat, with a page it wrote, and the other bots in the sidebar. The bots and what they say are made up.">
</picture>

Simplicity is the rule: a small core, few dependencies, and no abstraction until a second real use. The core is what every bot needs, and everything else is a plugin. See [Core or plugin](CONVENTIONS.md#core-or-plugin).

## Stack

A TypeScript monorepo with four npm workspaces under `packages/`, laid out after [eve](https://eve.dev): a core package with a client subpath, a thin server, a UI on the client, and the public site.

| Package | What it is |
| --- | --- |
| [`@fxbot/sdk`](packages/sdk/README.md) | The agent system: providers and their sign-ins, one libfx agent per provider, bot profiles, settings, uploads, each bot's durable chat, and its searchable history. `@fxbot/sdk/client` is a typed client for the server's HTTP API, with the stream reader and the turn reducer a UI needs. To build your own app on it, see [the SDK's pages](https://fxbot.sh/sdk/). |
| `@fxbot/server` | The backend: `node:http` routes over the SDK, and the built UI. Keys and tokens stay here, sealed in Postgres. |
| `@fxbot/ui` | The PWA: Vite, React, and shadcn/ui, with the chat built from shadcn's AI Elements patterns, on `@fxbot/sdk/client`. |
| `@fxbot/website` | The public site and its docs, static pages in `out/` built by `npm run build-site`: the home page in React and Tailwind, and the docs in Astro's [Starlight](https://starlight.astro.build), with search. `FXBOT_SITE_BASE` sets the path it is served under. |

Records live in Postgres, and so do libfx's sessions, each chat's. No Next.js, and no Vercel AI SDK. The packages run as TypeScript source on Node 22.18 or newer, with no build step but the UI's and the site's.

## Phases

In order of execution priority. Checked phases are built. Each is marked **core** or **plugin** ([Core or plugin](CONVENTIONS.md#core-or-plugin)). A core seam is a part of the core that plugins plug into. Built phases link to their phase docs in `docs/_completed/phases/`. The rest are one-page stubs in `docs/phases/` until they're planned, as Distribution and Mac support are.

- [x] [v1](docs/_completed/v1-plan.md) (core): bot profiles and a streaming chat
- [x] [Provider logins](docs/_completed/phases/provider-logins.md) (core): ChatGPT, Grok, and Vercel accounts, API keys, and local model servers
- [x] [Library](docs/_completed/phases/library.md) (core): every file the chats hold, for people and bots
- [x] [PWA](docs/_completed/phases/pwa.md) (core): installs on phones and desktops
- [x] [MCP servers](docs/_completed/phases/mcp.md) (core seam): tools from any remote MCP server, with OAuth sign-in
- [x] [Releases](docs/_completed/phases/releases.md) (core): install a release, and update when the next one is ready
- [x] [Plugin search](docs/_completed/phases/addons.md) (core seam): search GitHub's MCP registry, add a server from its page, and update installed ones
- [x] [Skills](docs/_completed/phases/skills.md) (core seam): instructions bots read when a task needs them, from fxbot's list and skills.sh
- [x] [Containers](docs/_completed/phases/containers.md) (core): podman or docker, one compose file for fxbot and its database with pgvector, and updates through the machine's `fxbot` command
- [x] [Memories](docs/_completed/phases/memories.md) (core): each bot keeps what it has learned, and search by meaning from a local or remote embedder
- [x] [Plugins](docs/_completed/phases/plugins.md) (core: the plugin API): plugins that change the app, with hooks, tools, data, and screens of their own; fxbot's first two were chat rooms and herdr: [chat rooms](plugins/chat-rooms/README.md) is in `plugins/`, and herdr left in 0.4.1, to be planned again
- [x] [One kind of plugin](docs/_completed/phases/one-kind-of-plugin.md) (core seam): one name and one list. A plugin carries any mix of code, MCP servers, and skills, and only the ones fxbot vets show until a switch in Settings
- [x] [Agent computer](docs/_completed/phases/computer.md) (plugin, one others build on): a Linux computer for each bot, in the machine's own podman or docker, run rootless; the [computer](plugins/computer/README.md) is in `plugins/`
- [x] [Streams](docs/_completed/phases/streams.md) (core): chats in the Postgres fxbot already runs, so an open chat costs nothing while idle and a long one is as quick to send to as a new one
- [x] [Computer v2](docs/_completed/phases/computer-v2.md) (plugin, with one core hook): a whole computer in one plugin: a desktop the owner watches and takes over, a shared terminal, a browser on the desktop, and the tools to drive them by pixels, accessibility trees, and text
- [x] [Permissions](docs/_completed/phases/permissions.md) (plugin, on a core hook; 0.6.0): ask, auto, and yolo modes for tool calls, with a reviewer model and an approval card
- [x] [Chat rooms](docs/_completed/phases/chat-rooms.md) (plugin, with two core hooks; 0.4.1): rooms of the owner and several bots, with `@` chips, bots tagging each other within limits, a Stop, and skills for working in a room
- [x] [Cross-bot messaging](docs/_completed/phases/cross-bot-messaging.md) (plugin, with core steering and Stop; 0.6.0): bots message each other in their own chats, where the owner watches them work together, and a message to a working bot joins what it's doing
- [x] [Routines](docs/_completed/phases/routines.md) (plugin, with a core time zone; 0.6.0): saved tasks a bot runs on a schedule, with everything it has, telling the owner in its chat
- [x] [Plugin compatibility](docs/_completed/phases/plugin-compatibility.md) (core; 0.7.0): a minimum fxbot for each plugin, a list of what each release broke, and **Unsupported** where a plugin can't run
- [x] [Onboarding](docs/_completed/phases/onboarding.md) (core; 0.7.0): an Essentials pack at the top of Browse, and a first-run flow that adds plugins, sets up the first bot, and says where plugins live
- [x] [Pages](docs/_completed/phases/pages.md) (plugin, with small core hooks; 0.7.0): reports and guides bots write for reading outside the chat, in Markdown or HTML, kept in the library with every version
- [x] [Pages v2](docs/_completed/phases/pages-v2.md) (plugin; 0.7.0): pages that remember, that bots can feed with data, and that reach back to the bot
- [x] [Avatars](docs/_completed/phases/avatars.md) (core; 0.7.0): a look for each bot, of 32 shapes in soft color with big dark eyes, a feeling, and things to wear, that shows when it's working, waiting, finished, or asleep
- [x] [Web pairing](docs/_completed/phases/web-pairing.md) (plugin, with two small hooks; 0.8.0): web.fxbot.sh opens your own fxbot from a phone or any computer over a WebRTC connection straight to it, STUN only, with only the handshake passing through fxbot.sh, paired once with a code and kept, and docs for Tailscale, WireGuard, and your own TURN when a network won't connect directly
- [x] [Operations](docs/_completed/phases/operations.md) (core; 0.8.0): the computer on every engine, Fedora, AlmaLinux, openSUSE, and Arch beside Debian and Ubuntu, `setup.sh` checks before it changes anything, another port, and `fxbot backup` and `fxbot uninstall`
- [x] [Providers v2](docs/_completed/phases/providers-v2.md) (core; 0.8.0): an Add provider page that leads with sign-ins (ChatGPT/Codex, Grok, OpenRouter, Hugging Face, OrcaRouter), walks through making a key for each popular gateway, takes the clouds' own sign-ins, and leads first-run setup, with docs for each provider
- [x] [Subagents](docs/_completed/phases/subagents.md) (plugin, with a session label in core; 0.9.0): a bot starts helpers that work in the background with its tools, sharing its computer as a room's bots do, their reports come back to its chat together, and its panel lists them, each opening to its thread
- [x] [First impressions](docs/_completed/phases/first-impressions.md) (site and docs, no app code; on `main` after 0.9.0): the link preview, home page, README, and tutorial say what fxbot is, "AI assistants that do real work. Built your way.", that it takes any model, hosted or local, and that phones use web pairing, with answers to what people ask first
- [x] [Mermaid](docs/_completed/phases/plugin-mermaid.md) (plugin, with a code-block hook in core; 0.9.0): the Mermaid diagrams bots write draw in replies, pages, rooms, and the library, with Pele, in the app's own look
- [ ] [Claude's own API](docs/phases/claude-messages.md) (core; on hold until libfx is checked again): Claude by key over Anthropic's Messages API, with prompt caching, thinking at a bot's effort, cache counts in a turn's usage, and cache keys for the providers that want one ([#18](https://github.com/iammrduncan/fxbot/issues/18)). Meanwhile, Claude by key caches through AI Gateway
- [ ] [Gateways](docs/phases/gateways.md) (plugins, with a small core hook): talk to bots from the chat apps you already use, as the owner, in the same conversation the app shows
- [ ] [Telegram and Discord](docs/phases/telegram-and-discord.md) (plugins): the first two gateways
- [ ] [Distribution](docs/phases/distribution.md) (core; after 0.8.0): the main install, one download for Linux, macOS, and Windows that brings its own Postgres and embedder and a Linux machine for the computer, and later the desktop app; the container release is for hosting
- [ ] [Mac support](docs/phases/mac-support.md) (core; after 0.8.0): one line installs fxbot on a Mac, as Distribution's macOS download built first, with only the computer in a Lima VM, and a handoff to check it on a real Mac
- [ ] [Triggers](docs/phases/triggers.md) (plugins): webhooks and new email start a bot's turn
- [ ] [Memories v2](docs/phases/memories-v2.md) (core, and the chat rooms plugin): team memories every bot reads, which the owner adds in Settings and a bot saves when asked, and a room's own memories, which every bot in that room reads
- [ ] [Soul](docs/phases/soul.md) (plugin): each bot writes a short soul in a first meeting with its owner, guessing who it is from its name, keeps it up when asked, and can bring one in from Hermes Agent or OpenClaw
- [ ] [Reasoning](docs/phases/reasoning.md) (core, and the subagents plugin): how hard a bot's model thinks, and its subagents', from the levels each model offers; AI Gateway, ChatGPT, and Grok now, every other provider with the next libfx release
- [ ] [Idle compaction](docs/phases/idle-autocompaction.md) (core): a long chat left idle for 30 minutes is summarized, with a note in the chat, so the next message starts fast; off or another time and model in Settings
- [ ] [Context management](docs/phases/context-management.md) (core): one never-ending chat that fits the model's context window, past the compaction libfx does
- [ ] [Past sessions](docs/phases/past-sessions.md) (core): earlier conversations stay browsable
- [ ] [Knowledge base](docs/phases/knowledge-base.md) (plugin): knowledge the bots draw on
- [ ] [herdr screen](docs/phases/herdr-screen.md) (plugin): the [herdr](https://herdr.dev) interface in the app, from a herdr plugin
- [ ] [Remote control](docs/phases/remote-control.md) (plugin): heavy work handed to coding agents through herdr
- [ ] [Web search](docs/phases/web-search.md) (plugin): bots search and read the web, and cite it
- [ ] [X feed](docs/phases/plugin-x-feed.md) (plugins): bots read X (Twitter) for free with tools of their own, posts, search, mentions, followers, and lists, from X's public pages, its embeds, and FxTwitter, or through a signed-in tab on the bot's computer, and watches start a turn when someone posts or the owner is mentioned
- [ ] [Vault](docs/phases/vault.md) (plugin): saved secrets and details bots use when allowed
- [ ] [1Password](docs/phases/1password.md) (plugin): bots use stored logins and items from 1Password
- [ ] [Local access](docs/phases/plugin-local-access.md) (plugin): bots reach folders the owner picks on the machine itself, off until the owner turns it on
- [ ] [Image and video generation](docs/phases/media-generation.md) (plugin): bots create images and video
- [ ] [Voice memos](docs/phases/voice-memos.md) (plugin): send a bot a recorded voice memo
- [ ] [Phone calls](docs/phases/phone-calls.md) (plugin): talk with a bot by voice, in the app or over a phone line

The previous design and spike are in [archive/](archive/README.md). The git host may still use the old repository name until the owner renames it.

## Install

On Linux with systemd, `setup.sh` installs the newest release, or the one you name: on Debian, Ubuntu, Fedora, AlmaLinux and the other RHEL rebuilds, openSUSE, Arch, and the distros built on them, through apt, dnf, zypper, or pacman.

```sh
curl -fsSL https://fxbot.sh/setup.sh | sudo bash
curl -fsSL https://fxbot.sh/setup.sh | sudo bash -s -- v0.3.0
curl -fsSL https://fxbot.sh/setup.sh | sudo FXBOT_PORT=8780 bash   # another port than 8787
```

Or ask your AI agent to set it up: `Set up fxbot on this computer for me: follow https://fxbot.sh/agent-setup.txt`. [Set up with your AI agent](https://fxbot.sh/docs/tutorials/set-up-with-an-agent/) has that, and all the docs as plain text.

fxbot runs as containers: the app, its database in pgvector's Postgres image, and the local embedder for memory search, from one compose file. `setup.sh` checks the machine first, and stops with what to do before it changes anything when it can't install there ([Fix an install that stopped](https://fxbot.sh/docs/how-to/fix-an-install/)). Then it reads the versions the machine has and sets up what's missing: the engine that's there, a Docker that's running or podman, or else podman from the distro, or Docker's own `docker-ce` where that podman is too old, and Compose 2.26 or newer, from the distro or from Compose's own release. Each package it installs is listed in `/etc/fxbot/packages`. Then:
- the `fxbot` user, and a key in `/etc/fxbot/secret.key` that only `fxbot` reads
- `/opt/fxbot`: the release's `compose.yaml`, an `.env` with its version and a random database password, and the `fxbot` command, also at `/usr/local/bin/fxbot`
- `/etc/fxbot/fxbot.env` for the app's settings, with plugins' files in `/var/lib/fxbot/data`, backups in `/var/lib/fxbot/backups`, and the app's update requests in `/var/lib/fxbot/control`
- `fxbot.service`, which starts the containers at boot, on 127.0.0.1:8787, and `fxbot-control.path`, which hands Settings' updates to the `fxbot` command

Running it again finishes an install that stopped, and leaves a working one alone. It stops, and says why, if another program holds port 8787: give it another with `FXBOT_PORT`. A checkout's `npm run dev` stays clear of it ([Run from a checkout](#run-from-a-checkout)), so both can run on one machine.

| Command | What it does |
| --- | --- |
| `sudo fxbot status` | The version, whether fxbot answers, and the containers |
| `sudo fxbot logs [fxbot \| db]` | Their logs, followed in a terminal |
| `sudo fxbot update [version]` | Moves to the newest release, or the one named. See [Update](#update) |
| `sudo fxbot up` and `down` | Starts and stops the containers, as `fxbot.service` does |
| `sudo fxbot backup [<folder>]` | Backs up the database and the data folder into a folder `restore` takes. See [Back up fxbot](https://fxbot.sh/docs/how-to/back-up/) |
| `sudo fxbot restore <folder>` | Puts a backup in place of the database, and unpacks its data folder |
| `sudo fxbot rotate-key` | Seals every stored key and token again under a new key, and keeps the old key as `secret.key.old` |
| `sudo fxbot embedder cpu\|gpu\|off` | Runs memory search's local embedder on the CPU, on a GPU after a trial run reaches one, or not at all |
| `sudo fxbot computer on\|off` | Sets up the computer plugin's engine, as adding the plugin does, or takes it away with its computers |
| `sudo fxbot uninstall [--purge]` | Takes fxbot off the machine, keeping a backup, the key, and the `fxbot` user unless `--purge`. See [Uninstall fxbot](https://fxbot.sh/docs/how-to/uninstall/) |

**Moving from 0.2.** An install of 0.2 ran on the machine's own Postgres. Run `setup.sh` again: it stops 0.2, copies its database into the database container, and starts the containers on the same chats, key, and settings. The 0.2 files, settings, and database stay until you remove them, and `sudo fxbot status` says how to remove them or go back to 0.2. Settings' Update in 0.2 can't make this move.

### Reaching it

fxbot listens on 127.0.0.1:8787 and has no login of its own. On the machine itself, open `http://127.0.0.1:8787`: everything works there, installing the app included.

From your phone and other devices, web pairing is the recommended way: add **Web pairing** from **Plugins**, and pair each device once at [web.fxbot.sh](https://web.fxbot.sh), over a connection straight to your fxbot ([Reach fxbot from your phone](https://fxbot.sh/docs/how-to/reach-it-from-your-phone/)).

[Tailscale](https://tailscale.com) works too. It adds HTTPS, which a phone needs to install the app, and only your own devices can reach fxbot. Give it the machine's own address:

```sh
sudo tailscale serve --bg 8787       # https://<machine>.<tailnet>.ts.net
```

Or a name of its own, `bot.<tailnet>.ts.net`, as a [Tailscale Service](https://tailscale.com/kb/1552/tailscale-services). The machine must be tagged, and a tailnet admin does three things once:
1. **Define the service** on the admin console's Services page: **Define a Service**, named `bot`, with the port `tcp:443`.
2. **Approve this machine** as its host on that service's page, or with an `autoApprovers` rule for the machine's tag.
3. **Grant access** in the policy file, such as `{ "src": ["autogroup:member"], "dst": ["svc:bot"], "ip": ["443"] }`.

Then, on the machine:

```sh
sudo tailscale serve --service=svc:bot --https=443 http://127.0.0.1:8787
```

Check the address from a phone or laptop on the tailnet, not from the machine itself: a grant to people doesn't cover a tagged machine, so the name may not resolve there.

Anything else in front of fxbot, such as a reverse proxy or another VPN, works if it:
- **adds its own login or access control.** Whoever reaches fxbot can use all of it: every bot, chat, and provider.
- **serves HTTPS,** which installing the app needs, and which lets an MCP server's sign-in come back to fxbot by itself.
- **passes the `Host` header through unchanged.** fxbot refuses a write whose page origin doesn't match the host it was reached at.
- **doesn't buffer responses,** since each chat streams its replies.

Never open port 8787 to a network directly.

Open the address on each device and install the app from it: Install in Settings on Chrome or Edge, or Share and then Add to Home Screen on an iPhone. The app opens offline, and offers Reload when an update lands.

## Update

When a newer release is out, Settings shows its notes and an **Update** button. The app asks the machine, and the `fxbot` command there downloads the release, starts it, and waits until it answers. Running chats get 30 seconds to finish first, and one still running goes on in the new release. The database keeps running. From a shell:

```sh
sudo fxbot update            # the newest release, or name one: sudo fxbot update 0.3.1
```

- **Migrations.** Each release's database changes are numbered files in `packages/sdk/src/migrations/`. A starting server runs the ones the database hasn't, all or none. It first backs up the database and `FXBOT_DATA` into `FXBOT_BACKUPS`, and keeps the last five. The tables that hold the chats are Workflow's Postgres World's, in schemas of their own, and its own setup migrates them, after the same backup.
- **A release that doesn't start** is replaced by the one before, on the backup taken before its migrations if it ran any. Settings shows why.
- **Prereleases,** such as `0.3.0-rc.1`, install only by name.
- **Plugins that won't run on it.** Settings names any plugin you run that the new release would stop, above **Update**. After the update it shows as **Unsupported** until a version that fits.
- **Going back.** After a migration, the older release refuses the database. Restore the backup taken before it, then name the older version:

  ```sh
  sudo fxbot restore /var/lib/fxbot/backups/<date>-before-<migration>
  sudo sed -i 's/^FXBOT_VERSION=.*/FXBOT_VERSION=0.3.0/' /opt/fxbot/.env && sudo fxbot up
  ```

  With no migration in between, only the second line.

## Run from a checkout

Node 22.18 or newer, and podman or docker for the database. From the repository root:

```sh
npm install
npm run dev      # the page on 127.0.0.1:5173 and the API on 8788, reloading on any change
npm run prod     # build the page, then serve it and the API on 127.0.0.1, port FXBOT_PORT
npm run server   # only the API and the last build, on the same port
```

The server reads these from the environment, or from an uncommitted `.env` in the repository root; the environment wins. Only the server and the checkout's compose file read `.env`. `FXBOT_DATABASE_URL` holds the database's password, and the key that seals everything else stays in its own file.

| Variable | What it is |
| --- | --- |
| `FXBOT_DATABASE_URL` | Required. fxbot's Postgres, such as `postgres://fxbot:<password>@127.0.0.1:5433/fxbot_dev` from `deploy/compose.dev.yaml` |
| `FXBOT_PORT` | The API's port. Default 8787, a release install's; `npm run dev` uses 8788 unless this is set in the shell |
| `FXBOT_HOST` | The address the API listens on. Default 127.0.0.1. fxbot's image sets 0.0.0.0, and compose publishes the port on the machine's 127.0.0.1 |
| `FXBOT_SECRET_KEY_FILE` | Required. A file outside the repo with 32 random bytes in base64. It seals every key and token fxbot stores |
| `FXBOT_VERCEL_CLIENT_ID` | Optional. fxbot's own Vercel OAuth app, for signing in with a Vercel account, in place of the one fxbot's list of providers names |
| `FXBOT_HF_CLIENT_ID` | Optional. fxbot's own Hugging Face OAuth app, a public one with no secret, for signing in with Hugging Face, in place of the one fxbot's list of providers names |
| `FXBOT_DATA` | Plugins' files. Chats from before 0.4.0, in its `sessions/`, move into the database on the first start, which renames the folder `sessions.moved`. Default `./data` |
| `FXBOT_CLIENT_METADATA_URL` | Optional. The project's published OAuth client document, for MCP servers that sign in with one. Without it, fxbot registers itself with each server |
| `FXBOT_MCP_REGISTRY` | Optional. The MCP registry that fxbot mirrors hourly for search, and that registry entries come from. Default GitHub's, `https://api.mcp.github.com` |
| `FXBOT_MCP_EVERYTHING` | Optional. The registry that Search everything asks, once per search. Default the official one, `https://registry.modelcontextprotocol.io` |
| `FXBOT_LISTS_URL` | Optional. The site that publishes fxbot's own lists of the plugins it vets: MCP servers, skills, and packages. fxbot reads its `mcp-registry.json`, `skills-registry.json`, and `plugins-registry.json` hourly, its list of providers, `providers-registry.json`, and `plugin-breaks.json`, what each release broke, and keeps the lists the release shipped with until a read succeeds. Default fxbot's site, `https://fxbot.sh` |
| `FXBOT_BACKUPS` | Where the database and `FXBOT_DATA` are backed up before migrations run. Default `./backups`. The backup uses `pg_dump`, which must be Postgres 17's |
| `FXBOT_CONTROL` | Set by a release install's compose file: the folder where the app asks the machine for updates. Without it, Settings doesn't update |
| `FXBOT_EMBED_URL` | Optional. The local embedder for memory search, an OpenAI-style address such as `http://127.0.0.1:8081/v1` from `deploy/compose.dev.yaml`. A release install's compose file sets it. Without it, there is no local embedder |
| `FXBOT_PLUGIN_DIRS` | Optional, for writing a plugin in a checkout. Plugin folders, separated by `:`, that fxbot adds on first sight and loads at start, unpinned. It loads one again a moment after its files change |
| `FXBOT_UPDATE_CHECK` | `off` stops the daily check for a newer release, which asks GitHub about the repository in `package.json` |
| `FXBOT_RELEASES_URL` | Optional. Where that check reads the newest release, in the shape of GitHub's `releases/latest`, for a fork or a mirror |

One-time setup, for a checkout you run as yourself. Its database and local embedder run in containers of their own, on ports 5433 and 8081, and its names stay clear of a release install's (`fxbot`, `/etc/fxbot`, port 8787), so both can run on one machine. For everyday use, install a release instead.

```sh
sudo apt install podman docker-compose postgresql-client-17     # or Docker; the client is for backups. On Ubuntu: docker-compose-v2, not docker-compose, which is v1
sudo install -d -o "$USER" -m 700 /etc/fxbot-dev
openssl rand -base64 32 > /etc/fxbot-dev/secret.key && chmod 400 /etc/fxbot-dev/secret.key
pw=$(openssl rand -hex 16)
printf '%s\n' "FXBOT_DB_PASSWORD=$pw" "FXBOT_DATABASE_URL=postgres://fxbot:$pw@127.0.0.1:5433/fxbot_dev" FXBOT_EMBED_URL=http://127.0.0.1:8081/v1 FXBOT_SECRET_KEY_FILE=/etc/fxbot-dev/secret.key > .env
systemctl --user enable --now podman.socket                             # podman compose runs docker-compose through it
podman compose -f deploy/compose.dev.yaml --env-file .env up -d        # or docker compose
```

A checkout set up on the machine's own Postgres, before 0.3, moves its database across with:

```sh
pg_dump --format=custom fxbot_dev > fxbot_dev.dump
podman compose -f deploy/compose.dev.yaml --env-file .env exec -T db pg_restore -U fxbot -d fxbot_dev --no-owner < fxbot_dev.dump
```

Then add providers in Settings, from **Add provider**: an account you sign in to, a key, a cloud, or a local server such as Ollama. The page sends a key once and never gets it back. To seal everything under a new key, stop the server and run `npm run rotate-key -- <new key file>`, then point `FXBOT_SECRET_KEY_FILE` at that file.

`npm run prod` is the production build on its own: it builds the page into `packages/ui/dist/`, then serves it and `/api`. The API that `npm run dev` starts serves the last build there too. On a machine with a release install, give either another port than 8787 with `FXBOT_PORT`.

To reach the development page from your other devices, serve it on your tailnet, with HTTPS:

```sh
tailscale serve --bg 5173                 # npm run dev, at https://<machine>.<tailnet>.ts.net
```

An app installed from that address is the development page, so every change shows up as it lands, but it cannot open while `npm run dev` is down. fxbot has no login of its own, so do not expose its ports any other way.

## Releasing

`main` holds releases, and updates to the site between them. Work happens on `release/<next version>`, made from `main` after each release; `npm run dev` runs from that branch. When the branch is ready:

```sh
npm version 0.2.0 --no-git-tag-version     # package.json and the lockfile
# CHANGELOG.md: rename "## Unreleased" to "## 0.2.0 (<date>)", with a Before upgrading list if it adds migrations
# docs/releases/0.2.0.md: the release's notes, shaped like the last one's
git add docs/releases && git commit -am "Release 0.2.0"
git switch main && git merge --ff-only release/0.2.0 && git push
git switch -c release/0.3.0 && git push -u origin release/0.3.0
```

The [release workflow](.github/workflows/release.yml) runs only on `main`. Release branches are for work, and never publish.
- **It builds and publishes:** it typechecks and builds the new version, checks that no shipped migration changed, builds fxbot's image for amd64 and arm64 and pushes it to ghcr.io, then tags it and publishes a GitHub Release with `docs/releases/<version>.md` as its notes.
- **The notes** are a short post, to paste anywhere, and they're what Settings shows above **Update**, so a release with a **Before upgrading** says so above its list of changes.
- **The image's package:** GitHub makes a new package private. After the first release with an image, make it public once, in the package's settings (**Change visibility**).
- **A prerelease,** such as `0.3.0-rc.1`, is published only when you merge one into `main`.
- **A fix to a release** goes on `release/0.2.1` from `main`, and is merged into the open release branch after.
- **An update to the site alone** goes to `main` with no new version: the workflow finds that version tagged and does nothing, and the site deploys, so installs see no change.

## Status

The [Phases](#phases) list marks what's built, each linked to its phase doc in `docs/_completed/phases/`, which records what was planned, what was built, and what was checked. Each release's changes are in the [changelog](CHANGELOG.md).

Everything was checked against mock servers, stubbed sign-in services, and Chromium, not with real accounts, models, or phones. Each phase doc lists what only a person can check.

## License

[Apache License 2.0](LICENSE). The vendored `show-me` skill in `.agents/skills/` keeps its own MIT license. The Diátaxis pages in `.agents/skills/prep-release/references/diataxis/` are Daniele Procida's, under CC BY-SA 4.0 ([their notice](.agents/skills/prep-release/references/diataxis/README.md)).
