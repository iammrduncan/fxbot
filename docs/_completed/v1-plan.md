# v1 plan

v1 is bot profiles and the PWA. One person creates a few bots and keeps a long-running chat with each. The page is the product. A single Node process stores the profiles and runs [libfx 0.0.16](https://fx.sh/docs/lib). The model is an OpenAI-compatible endpoint: a cheap API, or a local server.

v1 is built. This page describes what exists and records how each part was checked. [Checked during the build](#checked-during-the-build) lists what was tested and what was not.

## Scope

- A profile list, a create/edit form, and a chat view.
- One persistent conversation per profile, resumed after a reload or a server restart.
- Replies stream into the page as tokens arrive.
- A message can carry images and text files.
- The app installs as a PWA. The shell opens offline and says when the server is unreachable.

## Non-goals

Everything stubbed in [docs/phases/](phases/), such as memories, cross-bot messaging, skills, herdr, permissions, tools, and MCP.

Also out of v1: accounts, Next.js, the Vercel AI SDK, tools, MCP, a transcript database, and Hermes Agent.

## Repo layout

A TypeScript monorepo: three npm workspaces under `packages/`, laid out after [eve](https://eve.dev), which ships its runtime as one package with a `client` subpath for UIs. Node 22.18 or newer. libfx needs `^20.19.0 || >=22.12.0`, and 22.18 is the first 22.x release that runs TypeScript without a flag. Checked here with Node 22.23.4.

```
package.json           workspaces and the root scripts
tsconfig.base.json     compiler options every package extends
packages/
  sdk/                 @fxbot/sdk: the agent system
    src/index.ts         createFxbot(): the one libfx agent, input checks, send, stream, images
    src/store.ts         JSON files under the data directory
    src/types.ts         types the server side and the client share; no imports
    src/client.ts        @fxbot/sdk/client: HTTP client, stream reader, and turn reducer, safe in a browser
  server/              @fxbot/server: node:http routes over the SDK
    src/index.ts
  ui/                  @fxbot/ui: the PWA
    index.html, vite.config.ts, components.json (shadcn), public/ (the two app icons)
    src/main.tsx
    src/app.tsx          path switch, the sidebar, and the screens
    src/client.ts        the page's @fxbot/sdk/client instance
    src/use-turn-stream.ts  React state over client.stream
    src/attachments.ts   reads attached files, and scales big images down
    src/index.css        Tailwind and the shadcn theme
    src/lib/, src/hooks/, src/components/ui/  shadcn's helpers and components
data/                  gitignored
  settings.json        the default model
  profiles/<id>.json
  uploads/<id>/        what a bot was sent with files: a record per message, and images by hash
  sessions/            libfx local() directory
```

The SDK holds everything about bots: libfx, storage, and every check on input. The server reads the environment, adds HTTP (routes, body limits, status codes), and serves the UI's build. The UI imports only `@fxbot/sdk/client`, so no Node code or secret reaches the browser bundle. Each package has its own `tsconfig.json` (Node types for the SDK and server, the DOM and Vite for the UI), and `npm run typecheck` runs each. The packages run as TypeScript source: Node strips types from a workspace package because npm links it into `node_modules` and Node follows the link to `packages/`. The SDK is private to the workspace; publishing it would need a build step.

`npm run dev` starts Vite in `packages/ui`. `npm run server` starts the API on port 8787 from the repository root, so `.env` and `data/` stay at the root; it loads `.env` when the file exists. Only the server reads `.env`; Vite reads none. Vite proxies `/api` to the server. In production, `npm run build` writes `packages/ui/dist/`, and the same Node process serves it and `/api` on port 8787. No second port, and no process manager package.

Vite listens on `127.0.0.1` and accepts `*.ts.net` host names, so `tailscale serve --bg 5173` gives the tailnet the dev server over HTTPS. `tailscale serve --bg 8787` does the same for the built app.

Vite's dev proxy keeps the page's stream open after the API server stops. `packages/ui/vite.config.ts` closes it when the server's response ends early, so the chat sees the drop in development as it does in production.

## Server API

`node:http` and a path switch. No web framework. Each route calls one SDK method and answers with the `status` its error carries.

| Method | Path | Body / response |
| --- | --- | --- |
| `GET` | `/api/health` | `{ "ok": true }` |
| `GET` | `/api/profiles` | array of profiles, sorted by name |
| `POST` | `/api/profiles` | `{ "name" }`, and optionally instructions and model → 201 and the profile |
| `GET` | `/api/profiles/:id` | one profile |
| `PATCH` | `/api/profiles/:id` | any of name, instructions, or model → the profile |
| `DELETE` | `/api/profiles/:id` | removes the JSON file → `{ "ok": true }` |
| `POST` | `/api/profiles/:id/messages` | `{ "text", "messageId", "files"? }` → `{ "messageId", "sessionId" }` after libfx accepts the prompt |
| `GET` | `/api/profiles/:id/stream?cursor=` | `application/x-ndjson`, replay then follow |
| `GET` | `/api/profiles/:id/uploads/:sha256.:ext` | an image a message sent |
| `GET` | `/api/settings` | `{ "defaultModel" }`, empty until set |
| `PATCH` | `/api/settings` | `{ "defaultModel" }` → the settings |

`messageId` is 1 to 128 letters, digits, `.`, `_`, or `-`. The same id again returns the same ids, follows the original turn, and runs no second model call. libfx marks that turn's result `repeated: true`. The HTTP response does not carry it, because it answers at `accepted`, before the result exists. The page needs no flag: it keys turns by `messageId`.

A profile with no session yet streams an empty body. Name and model are trimmed and at most 200 characters, and the default model too. A message to a bot with no model of its own, while no default is set, is 400 and runs nothing. A request body is at most 1 MiB, or 12 MiB for a message.

`files` is up to 8 `{ "name", "type", "data" }`, with base64 `data`. A PNG, JPEG, GIF, or WebP goes to the model as an image. Any other file must be UTF-8 text without NUL bytes, and goes as text headed `File: <name>`. Anything else is 400. A message with files may have empty text. libfx takes at most 8 images, 3.75 MiB each and 6 MiB together, and refuses an image whose bytes are not its type; the server answers its refusal with 400.

The server listens on `127.0.0.1` only and has no login. Other devices reach it through `tailscale serve`, which admits only the tailnet. The key for the model stays in the server environment, and the server passes it to the SDK. The page never receives a secret of any kind.

Errors are a JSON `{ "error": "..." }` and a 4xx/5xx status. Unknown profiles are 404. A bad id, a bad body, or an empty message is 400. A body over its limit is 413.

## Data model

A directory of JSON files. v1 is one person and a handful of profiles. libfx already stores the conversation, so a database would be a second copy of the transcript plus a driver. SQLite can wait until a query needs it.

```json
{
  "id": "a1b2c3d4e5f6",
  "name": "Assistant",
  "instructions": "You are a concise personal assistant.",
  "model": "the-model-id",
  "sessionId": null,
  "preview": "The start of the latest reply."
}
```

`id` is 12 hex characters from `node:crypto`, assigned on create, and never changes. `sessionId` stays `null` until the first message. The server then calls `agent.newSessionId()`, saves that id, and prompts the session. Name, instructions, and model are editable. A new bot is just a name: instructions and model start empty. An empty model follows `defaultModel` in `data/settings.json` at each turn, so changing the default changes every bot without a model of its own. `preview` is absent until a reply finishes; the server then saves its first 160 characters for the sidebar. A reply that runs again after a restart does not update it. Instructions are capped at 64 KiB, which is libfx's limit.

Profile reads and writes use sync `fs` calls, so a read-modify-write never interleaves with another request. A write goes to a temporary file and is renamed into place. Concurrent first messages to a new profile share one session.

The model base URL and API key are process environment, shared by every profile. `npm run server` also reads them from an uncommitted `.env` in the repository root; a variable already set in the environment wins.

| Variable | Role |
| --- | --- |
| `FXBOT_BASE_URL` | OpenAI-compatible origin, including the `/v1` prefix the server expects. Required. |
| `FXBOT_API_KEY` | sent as the provider key; omit when the endpoint needs none |
| `FXBOT_DATA` | data directory, default `./data` |

A message with files saves `uploads/<id>/<messageId>.json`, holding its text and each file's name, type, and image URL, and each image once as `<sha256>.<ext>`. Text files are not kept; the model got their text.

Deleting a profile deletes its JSON file and its uploads, and leaves the libfx session files on disk. The agent API has no method that deletes a durable session. `SessionStore.remove` belongs to the terminal API, which v1 does not use.

## libfx

Checked on 31 Oct 2026 against the [overview](https://fx.sh/docs/lib), [providers](https://fx.sh/docs/lib/providers), [prompts and streaming](https://fx.sh/docs/lib/prompts), [durability](https://fx.sh/docs/lib/durability), and [API reference](https://fx.sh/docs/lib/api) for libfx 0.0.16. The installed package's `types/libfx.d.cts` matches the calls below.

One agent per `createFxbot()` call, in `packages/sdk/src/index.ts`; the server makes one at startup:

```ts
const options = {
  name: "fxbot",
  provider: { name: "openai", baseUrl, models: {} },
  durability: local({ dir: join(dataDir, "sessions") }),
};
const agent = createFxAgent(apiKey ? { ...options, credentials: async () => ({ apiKey }) } : options);
```

`createFxAgent` returns without doing I/O. The engine starts on the first turn. Requests go to `{baseUrl}/chat/completions`, over HTTPS, or over HTTP when the host is localhost. The provider `name` starts with a letter, then letters, digits, `_`, or `-`, at most 64 characters, and is not `gateway`, `codex`, or `grok`. The `models` map tells libfx each model's context window, max output, tools, and vision. libfx refuses an image for a model the map does not list with `supportsVision: true` ("Image prompts are unavailable for the selected model"), and a `"*"` entry does not match every model. The bots' models change at run time, so `open()` adds each model to the map before its first prompt. That works because libfx 0.0.16 reads the map when a turn opens its engine, which was checked by hand against the mock, including a bot that switches models mid-session. The docs do not promise it; a later libfx that copies the map at startup would refuse images for a model set after startup. A model that cannot see images now fails at the provider instead.

Each profile is a session on that agent. Every open passes the saved model and instructions, including after a restart. libfx does not keep the agent's instructions in the agent object; session options apply to the turns that object starts. A session opened without a model fails its turn with "a custom provider needs a model".

```ts
const session = agent.session(sessionId, { model: profile.model, instructions: profile.instructions });
await session.prompt(input, { messageId }).accepted; // a string, or text and image blocks
```

`sessionId` is written into the profile file before `prompt`, so a restart still opens that session. On `local()`, that id is `wrun_` plus letters and digits, and `newSessionId()` returns one without a provider request. Keep the agent name `fxbot`: a session's turns run only on an agent with the name that created it.

`fxbot.stream(id, cursor)` returns `session.stream(cursor)` through a line filter that puts a saved message back into its `turn_start` (below), and `GET .../stream` pipes it to the response with `Readable.fromWeb`. `cursor` defaults to `0`, which replays from the first stored line and then stays open for new lines. A closed response cancels the libfx stream.

`createFxbot()` calls `session.resume()` for every profile with a session. Without it, a turn cut off by a crash waits until that session's next prompt. With it, the turn runs again on its own. On `SIGINT` or `SIGTERM` the server stops taking requests and `fxbot.close()` waits for the turns this process started.

`client.stream()` in `@fxbot/sdk/client` is a `fetch` reader, and `applyLine()` folds its lines into turns; the UI's `use-turn-stream.ts` only holds them in React state. It splits the body on newlines, parses each line as JSON, remembers the last `cursor`, and after a dropped connection calls the same URL again with that cursor. It hides a line whose `epoch` is lower than one before it, as libfx's own reader does.

Lines the chat uses:

| `type` | Use |
| --- | --- |
| `turn_start`, `turn_resume` | start a turn, or start it again after a crash; `input` is the user text, and `files` the message's files. The turn moves to the end of the thread and its reply restarts, because the new run sends the reply again from the beginning. |
| `text_delta` | append `delta` to the turn's reply |
| `reasoning_delta` | append `delta` to the turn's reasoning, shown with the Reasoning pattern |
| `turn_end` | the turn finished; any `stopReason` but `end_turn` shows a note, with `error.message` when present |
| `idle` | written by `resume()` when nothing was open; ignored |
| `tool_start`, `tool_end` | ignored in v1, which has no tools |

A session runs one turn at a time. A second prompt waits behind it. The turn keeps running if the browser disconnects.

The page shows the user's line in the thread as soon as it is sent. On reload, it rebuilds the thread from the stream. `turn_start.input` carried the user text in every session checked, including after a restart, so a plain text message has no second file. libfx leaves `input` off a prompt that is not a plain string, so the server saves each message with files before it prompts, and the stream filter adds that record's `input` and `files` to a `turn_start` that has no `input`.

What the stream shows on failure:

- A provider that answers with an HTTP error: a `text_delta` holding the status and body, then `turn_end` with `stopReason: "refused"`.
- A provider that cannot be reached: `turn_end` with `stopReason: "error"` and `error.message` `HostStreamFailed`.
- A turn that fails before it starts: only a `turn_end`, with no `turn_start`.

## UI

`app.tsx` matches the path with a few string checks.

A sidebar lists the bots, each with an avatar (its initial, in a color picked from its id) and a preview of its latest reply, under a New bot button. It reloads as replies finish. On a phone it opens from the menu button.

| Path | Screen |
| --- | --- |
| `/` | Pick a bot, or make one. Empty state offers create. |
| `/profiles/new` | Create form: just a name. |
| `/profiles/:id/edit` | Name, model, and instructions, plus delete. An empty model shows the default it follows. |
| `/settings` | The default model. Linked at the foot of the sidebar. |
| `/profiles/:id` | Chat. History, a composer, the streaming reply, and a visible error when the server or the model fails. |

The chat follows shadcn's [AI Elements](https://ui.shadcn.com/docs/ai-elements) patterns, Chat, Message, and Prompt Input, built from the shadcn components `message-scroller`, `message`, `bubble`, and `input-group`. Those patterns are code copied into the project, with no AI SDK; the docs' demos use the AI SDK only to script fake turns, and fxbot feeds them from its own stream hook. Your message is a bubble and the scroll anchor, so a new question settles near the top and the reply streams under it. The reply is markdown, rendered with [Streamdown](https://streamdown.ai), which sanitizes HTML, and a finished reply has Copy. When the model sends reasoning, the Reasoning pattern shows it above the reply: open under "Thinking" while it streams, folded to "Thought" once the reply starts. libfx turns both `reasoning_content` and `reasoning` deltas into `reasoning_delta` lines; both were checked against the mock. An empty chat centers its composer under the bot's name. The composer keeps its place in the tree, so it keeps focus when the first turn arrives.

The composer starts one line tall and grows with its text up to 12rem, then scrolls. The paperclip on its left opens a file picker; pasting files into it or dropping them anywhere on the chat attaches them too. Attached files show as shadcn `attachment` chips across the top of the box, each with a remove button. A file that is neither an image nor UTF-8 text is refused there with a note. An image over 1 MiB or 1600 pixels, or of another type the browser can draw, such as HEIC on Safari, is scaled to fit 1600 pixels and sent as JPEG. A sent message shows its images first, up to 12rem, then its other files as chips. Clicking an image opens it in a shadcn `dialog`, as large as the screen allows up to its own size, titled with its file name; the X, Escape, or a click outside closes it. The AI Elements Prompt Input pattern puts its buttons on a row under the text; fxbot keeps them on the text's row so an empty composer is one line.

Enter sends and Shift+Enter adds a line. A message that could not be sent shows Retry, which sends the same `messageId` again, files included. The theme follows the system's light or dark setting. The layout fits a phone width, and the composer stays on screen.

The project uses shadcn's Radix base (`radix-nova` in `components.json`) and keeps the packages its install adds: `radix-ui`, `lucide-react`, `tw-animate-css`, the `shadcn` package for its `shadcn/tailwind.css`, and the Geist font. The components import them; fxbot's own code imports only `@/components/ui`. Add a component with `npx shadcn@latest add <name>` when a screen needs it. Code highlighting in replies (Streamdown's Shiki plugin, or shadcn's Code Block) is not added. Of the other AI Elements patterns, Context has no context window to measure against, Suggestion has no prompts to suggest, and Chain of Thought, Tool, Task, Plan, Queue, Subagent, Confirmation, Stack Trace, Sources, and Inline Citation show tool calls, plans, and web sources, which v1 does not have.

The page holds no secrets: no model key and no token. Vite reads no `.env`, and `@fxbot/sdk/client` carries no credentials. Secrets stay in the server's environment and reach libfx through the SDK.

## PWA

`vite-plugin-pwa` writes the manifest and service worker. Name `fxbot`, `display: standalone`, `start_url: /`, and 192 and 512 pixel icons. The worker precaches the shell, the icons, and the font. Navigations fall back to `index.html` except under `/api`. The worker has no route for `/api`, so those requests always go to the network and a cached chat is never shown as live. Offline, the shell loads and the chat says the server is unreachable. It keeps retrying and recovers on its own when the server returns.

A service worker needs a secure context: `localhost`, or HTTPS. A page opened over plain HTTP on a LAN address works as a website but does not install.

## Milestones

Each one was checked in headless Chromium or with `curl` on 31 Oct 2026, against a mock OpenAI-compatible server.

1. **Boot.** Done. Vite shows a page, and `GET /api/health` returns ok, directly and through the dev proxy. `data/` is gitignored.
2. **Profiles.** Done. `curl` created, listed, read, updated, and deleted a profile, and got 400, 404, 405, and 413 for bad requests. After a restart the JSON file was still there. With `FXBOT_API_KEY` set, no file under the data directory contains the key.
3. **Profile screens.** Done. The sidebar, create, edit, and delete work in the browser, including the empty list, at 1280, 390, and 320 pixels wide. On a phone the sidebar opens from the menu, and every action is on screen.
4. **Streaming chat.** Done. A message appears at once and the reply grows as `text_delta` lines arrive. A repeated `messageId` made no second provider request.
5. **Resume.** Done. After a restart and a reload, the previous user and assistant text are back, and the follow-up request to the model carried the whole conversation. `turn_start.input` carried the user text. A server killed mid-reply finishes that reply after it restarts, shown once.
6. **Install and offline.** Done. Chromium reports no installability errors for the production build. With the server stopped, the cached shell opens and the chat and the list say they cannot reach the server.
7. **Attachments.** Done. Through the API, a message with an image and a text file reached the mock as an `image_url` part and `File: <name>` text, and its `turn_start` came back with the text and files and no image data. The image URL served the same bytes. A file with no text, eight files, and a plain message worked; a binary file, nine files, a fake PNG, a file without data, an empty message, and a 13 MiB body were refused. Deleting the bot deleted its uploads, and forty dropped streams left no open files behind. In the browser, at 390 and 1280 pixels: the empty composer is one line, grows to its cap and shrinks back, and attaches by picker, paste, and drop; a binary file shows a note; remove works; a 3200 by 2400 PNG went as a 1600 by 1200 JPEG and a small PNG went as is; after a reload the images load from the server; a file-only message sends; Retry after a stopped server sent the file again; and a sent image opens larger at both widths and closes by X, Escape, and a click outside.
8. **Packages.** Done. Each package typechecks with its own config. The UI's bundle holds no libfx, Node, or auth code. `@fxbot/sdk` and `@fxbot/sdk/client` ran from Node by package name against the mock, and their errors carried the right status and message. Then every check above ran again on the new layout: the API and route status codes, attachments, the image dialog, Retry with files, restart and resume, a server killed mid-reply, the chat at three widths, and install and offline. Reasoning passed on fresh data with the mock at 150 ms per word; at 30 ms the reasoning ends before the check looks, so that check can miss.

## Line budget

Hand-written TypeScript and the small config files. Generated `packages/ui/src/components/ui/`, `lib/`, `hooks/`, and the `package.json` files do not count.

| Area | Budget | Lines |
| --- | --- | --- |
| `packages/sdk/src/` agent, storage, checks, and the client | 300 | 427 |
| `packages/server/src/` HTTP | 100 | 130 |
| `packages/ui/src/` screens, the stream hook, and attachments | 450 | 707 |
| Vite, TypeScript, and HTML config | 80 | 81 |
| **Core** | **about 800** | **1345** |

`src/` passed its budget when the chat moved to the sidebar layout and the AI Elements patterns, with Reasoning, reply previews, and Settings. The core reached 1000 there. Attachments and the image dialog, asked for after that, added about 250 lines. The split into packages added about 90: the SDK's typed client and options, and a `tsconfig.json` per package, less the token mode it removed. Nothing was deleted to make room.

Stop and delete something if the core passes about 1000 lines.

## Dependencies

| Package | Why it is here |
| --- | --- |
| `libfx@0.0.16` | `@fxbot/sdk`: the only agent runtime |
| `vite`, `@vitejs/plugin-react`, `react`, `react-dom` | `@fxbot/ui` |
| `typescript`, `@types/node` | the root: the language of every package, checked by `npm run typecheck` |
| `@types/react`, `@types/react-dom` | `@fxbot/ui` |
| `tailwindcss`, `@tailwindcss/vite`, `class-variance-authority`, `cn`, `radix-ui`, `lucide-react`, `tw-animate-css`, `shadcn`, `@fontsource-variable/geist` | Tailwind and what the shadcn components and theme import |
| `@shadcn/react` | the scrolling behind Message Scroller |
| `streamdown` | markdown replies |
| `vite-plugin-pwa` | manifest and offline shell |

Everything not marked otherwise belongs to `@fxbot/ui`. `@fxbot/server` depends only on `@fxbot/sdk`. npm hoists every package to the root `node_modules`.

The page's JavaScript is about 280 kB gzipped, most of it React, Streamdown's markdown parser, and Radix.

Node's `http`, `fs`, `crypto`, and `stream` cover the server. No Express, database driver, router, state library, or AI SDK.

`npm audit` reports moderate advisories in `workbox-build`, which `vite-plugin-pwa` uses at build time. `npm audit --omit=dev` reports none.

## Checked during the build

- The `libfx@0.0.16` package was installed and its declarations read. The native addon loaded on Linux x64 with glibc 2.41.
- Every model request went to a mock OpenAI-compatible server on `http://localhost`. No hosted API or real local model server was tried.
- `newSessionId()` ran before any provider request.
- `turn_start.input` carried the user text for plain text prompts, including after a restart. A prompt of blocks gets no `input`.
- libfx refuses images for a custom-provider model not listed with `supportsVision`, ignores a `"*"` entry, and reads a model added to `provider.models` after the agent was created. It sends images as `image_url` data URLs and a resource block as `File: <uri>` text, and counts a prompt of resources alone as empty.
- A repeated `messageId` returned the original turn and made no provider request.
- `local()` does not continue a crashed turn by itself. The next `prompt()` runs it again from the start before the new prompt. `resume()` at startup does the same without waiting for a prompt.
- After a crash, the re-run turn writes a second `turn_start` with a higher epoch and sends the whole reply again.
- `local({ dir })` writes `runs/`, `steps/`, `events/`, `streams/`, `.locks/`, and `version.txt`. That layout is not documented, so nothing reads it directly.
- Not checked: what a restart does if `FXBOT_BASE_URL` changes under the agent name `fxbot`. The README says saved sessions follow the agent's provider.
- Not checked: a real vision model, and a model that cannot see images. Only the mock received images.
- Not checked: Safari, iOS, Firefox, HEIC photos, pasting from a phone's clipboard, a real install prompt, a browser on another device over a LAN address (only `curl` was), and the WebAssembly backend.
