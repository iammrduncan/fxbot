# fxbot

fxbot is a small installable web app for long-running chats with bot profiles. The browser is the UI on desktop and mobile. One Node server runs [libfx](https://fx.sh/docs/lib) and sends each conversation to an OpenAI-compatible model API, either a cheap hosted API or a local model server.

Simplicity is the rule: a small core, few dependencies, and no abstraction until a second real use. See [CONVENTIONS.md](CONVENTIONS.md).

## Stack

A TypeScript monorepo with three npm workspaces under `packages/`, laid out after [eve](https://eve.dev): a core package with a client subpath, a thin server, and a UI on the client.

| Package | What it is |
| --- | --- |
| [`@fxbot/sdk`](packages/sdk/README.md) | The agent system: one libfx agent, bot profiles, settings, uploads, and each bot's durable chat. `@fxbot/sdk/client` is a typed client for the server's HTTP API, with the stream reader and the turn reducer a UI needs. |
| `@fxbot/server` | The backend: `node:http` routes over the SDK, and the built UI. It holds the only secret, the model key. |
| `@fxbot/ui` | The PWA: Vite, React, and shadcn/ui, with the chat built from shadcn's AI Elements patterns, on `@fxbot/sdk/client`. |

No Next.js, and no Vercel AI SDK. The packages run as TypeScript source on Node 22.18 or newer, with no build step but the UI's.

## Order

1. **v1.** The PWA and bot profiles. [docs/v1-plan.md](docs/v1-plan.md).
2. Persistent memories for each profile.
3. Cross-bot messaging.
4. A knowledge base.

Later, and not scheduled: everything else stubbed in [docs/phases/](docs/phases/), such as tools, MCP, routines, a vault, voice, and remote control through [herdr](https://herdr.dev).

The previous design and spike are in [archive/](archive/README.md). The git host may still use the old repository name until the owner renames it.

## Run

Node 22.18 or newer. From the repository root:

```sh
npm install
npm run server   # @fxbot/server: API on 127.0.0.1:8787
npm run dev      # @fxbot/ui: page on 127.0.0.1:5173, proxies /api
```

The server needs `FXBOT_BASE_URL`: an OpenAI-compatible endpoint, including its `/v1` prefix, such as a hosted API or a local model server at `http://localhost:11434/v1`. Set `FXBOT_API_KEY` when the endpoint needs a key. Put them in an uncommitted `.env` in the repository root, or in the environment, which wins. Only the server reads `.env`. The key stays on the server, and the page holds no secrets. Profiles and conversations are stored in `./data`, or in `FXBOT_DATA`.

For one process, run `npm run build`, then `npm run server` serves the built page from `packages/ui/dist/` and `/api` on port 8787.

Both servers listen on loopback only. To reach them from another device, run `tailscale serve --bg 5173` once, or `8787` for the built app. Your tailnet then opens it at `https://<machine>.<tailnet>.ts.net`, with HTTPS, so the PWA can install. fxbot has no login of its own, so do not expose port 8787 any other way.

## Status

v1 is built: bot profiles, a streaming chat that survives reloads and server restarts, image and text file attachments, and an installable shell that opens offline. It was checked against a mock OpenAI-compatible server, not a hosted model. [docs/v1-plan.md](docs/v1-plan.md) records what was checked.
