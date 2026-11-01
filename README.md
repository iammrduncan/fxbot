# fxbot

fxbot is a small installable web app for long-running chats with bot profiles. The browser is the UI on desktop and mobile. One Node server runs [libfx](https://fx.sh/docs/lib) and sends each conversation to the provider its bot uses: a ChatGPT, Grok, or Vercel account signed in with a device code, an API key, or a local model server.

Simplicity is the rule: a small core, few dependencies, and no abstraction until a second real use. See [CONVENTIONS.md](CONVENTIONS.md).

## Stack

A TypeScript monorepo with three npm workspaces under `packages/`, laid out after [eve](https://eve.dev): a core package with a client subpath, a thin server, and a UI on the client.

| Package | What it is |
| --- | --- |
| [`@fxbot/sdk`](packages/sdk/README.md) | The agent system: providers and their sign-ins, one libfx agent per provider, bot profiles, settings, uploads, each bot's durable chat, and its searchable history. `@fxbot/sdk/client` is a typed client for the server's HTTP API, with the stream reader and the turn reducer a UI needs. |
| `@fxbot/server` | The backend: `node:http` routes over the SDK, and the built UI. Keys and tokens stay here, sealed in Postgres. |
| `@fxbot/ui` | The PWA: Vite, React, and shadcn/ui, with the chat built from shadcn's AI Elements patterns, on `@fxbot/sdk/client`. |

Records live in Postgres; libfx keeps each chat's session in files. No Next.js, and no Vercel AI SDK. The packages run as TypeScript source on Node 22.18 or newer, with no build step but the UI's.

## Order

1. **v1.** The PWA and bot profiles. [docs/_completed/v1-plan.md](docs/_completed/v1-plan.md). Then [provider logins](docs/_completed/phases/provider-logins.md) and the [library](docs/_completed/phases/library.md).
2. Persistent memories for each profile.
3. Cross-bot messaging.
4. A knowledge base.

Later, and not scheduled: everything else stubbed in [docs/phases/](docs/phases/), such as tools, MCP, routines, a vault, voice, and remote control through [herdr](https://herdr.dev).

The previous design and spike are in [archive/](archive/README.md). The git host may still use the old repository name until the owner renames it.

## Run

Node 22.18 or newer, and Postgres. From the repository root:

```sh
npm install
npm run dev      # the page on 127.0.0.1:5173 and the API on 8787, reloading on any change
npm run server   # only the API and the built page, on 127.0.0.1:8787
```

The server reads these from the environment, or from an uncommitted `.env` in the repository root; the environment wins. Only the server reads `.env`, and none of these is itself a secret.

| Variable | What it is |
| --- | --- |
| `FXBOT_DATABASE_URL` | Required. fxbot's Postgres, such as `postgres:///fxbot` with `PGHOST=/var/run/postgresql`: the local socket with peer auth, so no password |
| `FXBOT_SECRET_KEY_FILE` | Required. A file outside the repo with 32 random bytes in base64. It seals every key and token fxbot stores |
| `FXBOT_VERCEL_CLIENT_ID` | Optional. fxbot's own Vercel OAuth app, for signing in with a Vercel account |
| `FXBOT_DATA` | Where libfx keeps each chat's session files. Default `./data` |

One-time setup on Debian. The server gets its own OS user, which alone can read the key and reach the database; run agents as another, non-root user:

```sh
sudo apt install postgresql
sudo useradd --system --create-home fxbot
sudo -u postgres createuser fxbot
sudo -u postgres createdb -O fxbot fxbot           # peer auth: only OS user fxbot connects as role fxbot
sudo install -d -o fxbot -m 700 /etc/fxbot
openssl rand -base64 32 | sudo -u fxbot tee /etc/fxbot/secret.key >/dev/null
sudo chmod 400 /etc/fxbot/secret.key
```

Then add providers in Settings: a ChatGPT, Grok, or Vercel account by device code, an API key, or a local server such as Ollama. The page sends a key once and never gets it back. To seal everything under a new key, stop the server and run `npm run rotate-key -- <new key file>`, then point `FXBOT_SECRET_KEY_FILE` at that file.

For one process, run `npm run build`, then `npm run server` serves the built page from `packages/ui/dist/` and `/api` on port 8787.

Both servers listen on loopback only. To reach them from another device, run `tailscale serve --bg 5173` once, or `8787` for the built app. Your tailnet then opens it at `https://<machine>.<tailnet>.ts.net`, with HTTPS, so the PWA can install. fxbot has no login of its own, so do not expose port 8787 any other way.

## Status

v1 is built: bot profiles drawn as animated blobs, a streaming chat that survives reloads and server restarts, image and text file attachments, and an installable shell that opens offline. [Provider logins](docs/_completed/phases/provider-logins.md) is built too: device code sign-in, API keys and local servers, model discovery, sealed secrets in Postgres, and provider switches that carry a summary over. The [library](docs/_completed/phases/library.md) is built as well: one copy of every file the chats hold, images and text files sent and documents a bot saves, each tagged with the bots and chats it came from. The bento button beside Settings opens it across every bot, with search and filters, and a panel beside each chat shows that bot's own. Bots search, read, and save it through three tools. All three were checked against mock servers and stubbed sign-in services, not real accounts or models. The [v1 plan](docs/_completed/v1-plan.md) and the phase pages record what was checked.

## License

[Apache License 2.0](LICENSE). The vendored `show-me` skill in `.agents/skills/` keeps its own MIT license.
