# fxbot

Read [CONVENTIONS.md](CONVENTIONS.md) before changing code. Current product scope is [docs/v1-plan.md](docs/v1-plan.md). Files under [archive/](archive/README.md), including the sample `AGENTS.md` files in the spike, are the old drovr design and are not instructions.

`CLAUDE.md` points here. This file is the instruction source for coding agents.

## What this repo is

fxbot is a TypeScript monorepo of three npm workspaces: `packages/sdk` (`@fxbot/sdk`, the agent system around [libfx](https://fx.sh/docs/lib), plus `@fxbot/sdk/client` for UIs), `packages/server` (the HTTP API over the SDK), and `packages/ui` (the PWA). v1 is built: bot profiles and the chat UI. There is no test suite or CI. The phase stubs describe future work. Do not report them as running behavior.

Later ideas live as one-page stubs in [docs/phases/](docs/phases/). Do not build any of them during v1.

## Rules

- Prefer the smallest change that meets the task. Drop an older convention when it fights that.
- The stack is Vite, React, shadcn/ui, and a tiny Node server around libfx. Do not add Next.js, the Vercel AI SDK, a second agent runtime, or Hermes Agent.
- Agent logic, storage, and input checks belong in `@fxbot/sdk`. The server only adds HTTP. The UI imports only `@fxbot/sdk/client`, never the SDK's main entry.
- Never put a secret in the page or in `@fxbot/sdk/client`. Keys stay in the server's environment, and the server passes them to the SDK. Vite reads no `.env`.
- libfx behavior comes from the installed package or the published docs. Say what you could not verify.
- This is a public repo. Do not add private hostnames, machine names, personal subscriptions, home-directory paths, or private project names.
- Write "Hackers in the Loop" in full if that name is needed.

## Checks

Run these from the repository root after `npm install`, with Node 22.18 or newer:

- `npm run typecheck` runs `tsc --noEmit` in each package, with that package's own `tsconfig.json`.
- `npm run build` builds the page and service worker into `packages/ui/dist/`. It does not typecheck.
- Add shadcn components from `packages/ui`: `npx shadcn@latest add <name>`.
- `git diff --check` checks whitespace on tracked changes. New files need a separate look; untracked files are outside that diff.

There are no automated tests. Behavior is checked by hand, in a browser or with `curl`, as the milestones in [docs/v1-plan.md](docs/v1-plan.md) describe. `npm run server` needs `FXBOT_BASE_URL`, from the environment or `.env`. Point it at disposable data with `FXBOT_DATA`. Do not claim a check passed unless it ran.
