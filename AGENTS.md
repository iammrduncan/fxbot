# fxbot

Read [CONVENTIONS.md](CONVENTIONS.md) before changing code. `CLAUDE.md` points here. This file is the instruction source for coding agents.

## Where things are

- **[docs/_completed/](docs/_completed/):** what's built. [v1-plan.md](docs/_completed/v1-plan.md), then a phase doc for each feature in `phases/`, with what the owner asked, the research, the plan, its checklist, and "What the build changed". Read a feature's phase doc before changing it. The README's [Phases](README.md#phases) list links each one.
- **[docs/phases/](docs/phases/):** later ideas, as one-page stubs. Build one only when asked, and never report one as running behavior.
- **[docs/research-directive.md](docs/research-directive.md):** how a phase is planned.
- **[docs/releases/](docs/releases/):** each release's short post.
- **[archive/](archive/README.md):** the old drovr design, including the sample `AGENTS.md` files in its spike. They are not instructions.

## What this repo is

fxbot is AI assistants that do real work, built your way: bots that chat, remember, work on a computer of their own, and run tasks on a schedule, on any model, hosted or local, for one person on a machine of their own. It's a small core plus plugins, like [Pi](https://github.com/earendil-works/pi). The core is what every bot needs, what plugins plug into, and what fxbot needs to run. Everything else is a plugin an owner adds only if they want it.

The code:
- **`packages/sdk`:** `@fxbot/sdk`, the agent system around [libfx](https://fx.sh/docs/lib): providers and their catalog (`providers-registry.json`), bots, chats, memories, the library, skills, MCP servers, migrations, sealed secrets, and the plugin API. `@fxbot/sdk/client` is the typed client a UI uses.
- **`packages/server`:** the HTTP API over the SDK.
- **`packages/ui`:** the app, a PWA.
- **`packages/website`:** fxbot.sh and its docs, static pages that import none of the other three.
- **`packages/web-app`:** outside the workspaces, what fxbot.sh hosts for web pairing: the app at web.fxbot.sh, a frame for each fxbot's own page, and a Cloudflare Worker that passes the sealed handshake and stores nothing.
- **`plugins/`:** fxbot's own plugins, outside the workspaces, added from GitHub like anyone's: the computer, with a room's computer when chat rooms is added, chat rooms, dreams, routines, messages, subagents, permissions, pages, mermaid, soul, and web pairing.
- **`setup.sh` and `deploy/`:** a release install, as containers under podman or docker (fxbot, pgvector's Postgres, and a local embedder), with a host `fxbot` command for updates, backups, and uninstall.
- **`scripts/`:** what writes generated files (provider logos, blob data, screenshots, the link card), and the plugins' `minFxbot` check.

How it fits together:
- Records live in Postgres, and so do the chats: libfx's sessions, through Workflow's Postgres World.
- A plugin carries any mix of code, MCP servers, and skills. Its code changes the app through the plugin API: hooks into turns and tool calls, tools, routes, tables in a schema of its own, settings, sessions of its own, and places in the page. Plugins use one another through `fx.provide` and `fx.need`.
- A plugin says the oldest fxbot it runs on, and `plugin-breaks.json` lists what each release broke, so one that can't run shows **Unsupported**.
- There is no test suite or CI.

## Rules

- Prefer the smallest change that meets the task. Drop an older convention when it fights that.
- Before building a feature, ask: is it core, or a plugin? The default is plugin. Follow [Core or plugin](CONVENTIONS.md#core-or-plugin), and say which in the phase doc. When a plugin can't do what it needs, widen the plugin API with the smallest hook it needs, not the feature.
- `main` holds releases, and updates to the site between them. Commit to the open `release/<next version>` branch, never to `main`; the owner merges and releases ([README: Releasing](README.md#releasing)).
- Commit as you go. When a piece of work is done and its checks pass, commit it on the open release branch, with a message that says what changed, so the owner only has to push. Keep unrelated changes in separate commits. Don't push, merge, or tag unless the owner asks.
- A change that removes or breaks something in the plugin API adds a line to `packages/sdk/src/plugin-breaks.json`, and a note under `## Unreleased` ([plugin compatibility](docs/_completed/phases/plugin-compatibility.md)). A plugin in `plugins/` that starts using something newer raises its `minFxbot`.
- A schema change is a new numbered file in `packages/sdk/src/migrations/`. Never edit or remove one that has shipped in a release. Note it under `## Unreleased` in `CHANGELOG.md`, for the release's Before upgrading list.
- The stack is Vite, React, shadcn/ui, and a tiny Node server around libfx. Do not add Next.js, the Vercel AI SDK, a second agent runtime, or Hermes Agent.
- Agent logic, storage, and input checks belong in `@fxbot/sdk`. The server only adds HTTP. The UI imports only `@fxbot/sdk/client`, never the SDK's main entry.
- A bot's tools never act on the owner's machine: no file outside fxbot's own data, and no command there. Files and commands go through the computer plugin, and the machine's own folders only through the local access plugin, off by default ([Bots and the owner's machine](CONVENTIONS.md#bots-and-the-owners-machine)).
- Never put a secret in the page or in `@fxbot/sdk/client`. Keys and tokens live only on the server, sealed in Postgres by the SDK. The page sends a key once and never receives one. Vite reads no `.env`.
- libfx behavior comes from the installed package or the published docs. Say what you could not verify.
- This is a public repo. Do not add private hostnames, machine names, personal subscriptions, home-directory paths, or private project names.
- Write "Hackers in the Loop" in full if that name is needed.

## Checks

Run these from the repository root after `npm install`, with Node 22.18 or newer:

- `npm run typecheck` runs `tsc --noEmit` in each package, with that package's own `tsconfig.json`, then over the server code in `plugins/`, then `scripts/check-plugins.mjs`, which checks each plugin's `minFxbot` against the next release.
- `npm run build` builds the page and service worker into `packages/ui/dist/`. It does not typecheck.
- `npm run build-site` builds the website into `out/` with Astro and Starlight, and checks its links. It needs Node 22.22 or newer. `npm run dev -w @fxbot/website` serves it as you edit.
  - The docs are Markdown in `packages/website/src/content/docs/docs/`, and the SDK's pages, for people who build their own apps on `@fxbot/sdk`, in `packages/website/src/content/docs/sdk/`: one [Diátaxis](https://diataxis.fr) kind per page, each listed in `src/sidebar.ts`.
  - The home page is React, in `src/home.tsx`. The changelog page and the variables table come from `CHANGELOG.md` and the README.
- Add shadcn components from `packages/ui`: `npx shadcn@latest add <name>`.
- `podman build .` (or `docker build .`) builds fxbot's image from the `Dockerfile`. `bash -n setup.sh deploy/fxbot` checks the shell scripts' syntax.
- A plugin's `page.js` is built from its `page.jsx` with rolldown, by the command in its README. Commit both.
- `node scripts/provider-logos.mjs` writes `packages/ui/src/provider-logos.ts`, the Add provider page's logos, from models.dev and the sources it names. Run it after adding a provider to `packages/sdk/src/providers-registry.json`.
- `node scripts/blob-data.mjs` writes `packages/ui/src/blob-data.ts`, and copies it and `blob-draw.ts` to the site. Run it after changing a shape, a color, or `blob-draw.ts`.
- `npm run shots` remakes the screenshots in `packages/website/public/shots/`, for the site, the docs, and the README, from a throwaway fxbot with the made-up bots in `scripts/screenshots/world.mjs`. It rewrites only the shots that look different. Look at each one it rewrote before committing it.
  - It needs podman or docker, a built page (`npm run build`), and Playwright's Chromium: `npm ci --prefix scripts/screenshots`, then `npx --prefix scripts/screenshots playwright-core install --with-deps chromium` once.
- `npm run card` redraws `packages/website/public/card.png`, the image a link to fxbot.sh shows in chats and social posts, from the home page's crowd (`packages/website/src/crowd.ts`) and headline. It uses the screenshots' Playwright. Run it after changing either, and look at the card before committing it.
- Web pairing has checks of its own, since its packages stay out of the workspaces. After `npm ci` in `packages/web-app` and in `plugins/web-pairing`:
  - `node packages/web-app/protocol/check.mjs` runs the protocol against Noise's and CPace's test vectors.
  - `npm run typecheck --prefix packages/web-app` checks the app, its workers, and the Worker, and `npx tsc -p plugins/web-pairing` the plugin's server.
  - `npm run dev --prefix packages/web-app` builds the app and runs the Worker at `http://localhost:8771`, with frames at `http://<frame>.localhost:8771`. Point a disposable fxbot's **Settings** › **Web pairing** › relay at `ws://localhost:8771/signal`.
  - The plugin's `server.js` and `page.js` are built by the commands in its README. Commit them.
- `git diff --check` checks whitespace on tracked changes. New files need a separate look; untracked files are outside that diff.

There are no automated tests. Behavior is checked by hand, in a browser or with `curl`, as each phase doc's checklist describes. `npm run server` needs Postgres (a checkout's comes from `deploy/compose.dev.yaml`), `FXBOT_DATABASE_URL`, and `FXBOT_SECRET_KEY_FILE`, from the environment or `.env` (see the README). Point checks at a disposable database and `FXBOT_DATA`, and at another port with `FXBOT_PORT`. Check the release compose file with another `COMPOSE_PROJECT_NAME`, `FXBOT_PORT`, and `FXBOT_ROOT`, so it stays clear of a real install on the same machine. Do not claim a check passed unless it ran.
