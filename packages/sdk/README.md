# @fxbot/sdk

The agent system behind fxbot, for building another server or UI on it. It has two entries.

`@fxbot/sdk` runs on the server. It keeps fxbot's records in Postgres: providers, bot profiles, settings, the library of files, and every message, with keys and tokens only sealed. It runs one [libfx](https://fx.sh/docs/lib) agent per provider, and a durable chat with each bot. Call it from your backend, which holds the key that seals the secrets.

```ts
import { createFxbot } from "@fxbot/sdk";

const fxbot = await createFxbot({ databaseUrl: "postgres:///fxbot", secretKey: readFileSync(keyFile, "utf8") });
const local = await fxbot.providers.add({ kind: "ollama", model: "qwen3:8b" });
const bot = await fxbot.profiles.create({ name: "Scout", provider: local.id });
await fxbot.send(bot.id, { text: "Hello", messageId: "m1" }); // resolves once libfx stores the prompt
const lines = await fxbot.stream(bot.id); // NDJSON from the first line, then each new one
```

- `providers` adds key and server providers, after checking the key, and lists, updates, and removes them. A listed provider says whether it holds a key or a sign-in, never what it is. `providers.models(id)` lists a provider's models and what fxbot knows of each.
- `signIns.start({ kind })` begins a device code sign-in for a ChatGPT, Grok, or Vercel account. It returns only the code, the link, and the expiry; `signIns.get(id)` reports `waiting`, `done`, or `failed`.
- `profiles` and `settings` work as before. A bot also has a `provider`, and moving a bot with a chat to another provider summarizes the chat into the new one; `profiles.earlier(id)` returns the chats before the current one, for showing above the summary. Its look is a `shape` from `shapes` and a `color` from `colors`, and `busy` says whether a turn runs. `pinned` puts a bot at the top of the list: the first bot starts pinned, and at most `maxPinned` (3) are.
- `library` holds one copy of each file the chats hold, by the SHA-256 of its bytes: images and text files sent with a message, and documents bots save. Each item is tagged with every bot and chat that saved it, and outlives a deleted bot. `library.list({ q, profileId, kind, before, limit })` pages through items newest saved first, searching names and document text; `get(id)`, `file(id)` (the bytes, or none for a matching ETag), and `remove(id)` work on one.
- `close()` lets go of the agents and Postgres.
- `rotateSecrets({ databaseUrl, from, to })` seals every stored secret again under a new key.

Bad input throws an Error with `status` 400, and a missing bot one with 404. Turns that a stopped process left open run again when `createFxbot` is called. Every bot gets a `chat_history` tool that searches its own earlier messages, and `library_search`, `library_read`, and `library_save`, which reach only the items tagged for that bot.

`@fxbot/sdk/client` runs in a page or a script and talks to an fxbot server over HTTP. It carries no credentials: a key goes to the server once and never comes back.

```ts
import { applyLine, createClient, type Turn } from "@fxbot/sdk/client";

const client = createClient(); // the page's origin, or { baseUrl }
let turns: Turn[] = [];
for await (const line of client.stream(botId, { signal })) turns = applyLine(turns, line);
```

`client.stream` reconnects from the last cursor after a dropped connection. `applyLine` folds the lines into one entry per message, with its reply, reasoning, files, and any error. The client also has `providers`, `signIns`, `library` (list, get, remove; a file is read through its item's `url`), and the `kinds` and `itemKinds` tables.

The package ships TypeScript source and runs on Node 22.18 or newer without a build. It is private to this workspace. Publishing it would need a build step.
