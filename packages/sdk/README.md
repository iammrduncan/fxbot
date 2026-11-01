# @fxbot/sdk

The agent system behind fxbot, for building another server or UI on it. It has two entries.

`@fxbot/sdk` runs on the server. It holds one [libfx](https://fx.sh/docs/lib) agent and fxbot's files: bot profiles, settings, uploads, and each bot's durable chat. Call it from your backend, which keeps the model key.

```ts
import { createFxbot } from "@fxbot/sdk";

const fxbot = createFxbot({ baseUrl: process.env.FXBOT_BASE_URL!, apiKey: process.env.FXBOT_API_KEY, dataDir: "data" });
const bot = fxbot.profiles.create({ name: "Scout", model: "the-model-id" });
await fxbot.send(bot.id, { text: "Hello", messageId: "m1" }); // resolves once libfx stores the prompt
const lines = fxbot.stream(bot.id); // NDJSON from the first line, then each new one
```

It also has `profiles.list/get/update/remove`, `settings.get/update`, `image(id, name)` for a sent image, and `close()`. Bad input throws an Error with `status` 400, and a missing bot one with 404. Turns that a stopped process left open run again when `createFxbot` is called.

`@fxbot/sdk/client` runs in a page or a script and talks to an fxbot server over HTTP. It carries no credentials.

```ts
import { applyLine, createClient, type Turn } from "@fxbot/sdk/client";

const client = createClient(); // the page's origin, or { baseUrl }
let turns: Turn[] = [];
for await (const line of client.stream(botId, { signal })) turns = applyLine(turns, line);
```

`client.stream` reconnects from the last cursor after a dropped connection. `applyLine` folds the lines into one entry per message, with its reply, reasoning, files, and any error.

The package ships TypeScript source and runs on Node 22.18 or newer without a build. It is private to this workspace. Publishing it would need a build step.
