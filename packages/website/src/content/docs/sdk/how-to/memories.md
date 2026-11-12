---
title: "Work with memories"
description: "A bot keeps what it learns as memories: one fact each, in a sentence that stands on its own, of at most 1,000 characters. Bots save their own during turns. Your app can list them, add its own, change them, and remove them, through fxbot.profiles.memories, and keep the team's, which every bot reads, through fxbot.memories. How bots use them: Memories."
---

A bot keeps what it learns as memories: one fact each, in a sentence that stands on its own, of at most 1,000 characters. Bots save their own during turns. Your app can list them, add its own, change them, and remove them, through `fxbot.profiles.memories`, and keep the team's, which every bot reads, through `fxbot.memories`. How bots use them: [Memories](/docs/explanation/bots-and-chats/#memories).

## See what a bot remembers

```ts
const newest = await fxbot.profiles.memories.list(bot.id);
for (const m of newest) console.log(`mem:${m.id} ${m.savedBy} ${m.updatedAt.slice(0, 10)} ${m.text}`);
```

The list is newest first, 200 by default, and `limit` takes up to 500. Each memory has its `id`, `text`, `savedBy` (`bot` or `owner`), and when it was made and last changed. A memory the bot saved also has `messageId`: the stored message of the turn it was saved in, which `chat_history` reads as `msg:<id>`. It isn't the `messageId` your app sent.

To search, give a `query`. The best matches come first, by words and, with vectors on, by meaning:

```ts
const found = await fxbot.profiles.memories.list(bot.id, { query: "coffee or tea" });
```

## Add, change, or remove one

```ts
const memory = await fxbot.profiles.memories.add(bot.id, "The owner drinks tea, not coffee.");
await fxbot.profiles.memories.update(bot.id, memory.id, "The owner drinks green tea, not coffee.");
await fxbot.profiles.memories.remove(bot.id, memory.id);
```

- Adding text the bot already has, in other case or spacing, answers with the memory already there.
- A change that says what another memory says merges the two: that other memory stays, and comes back.
- An id works as `12` or as `mem:12`.
- The bot sees the change on its next turn. Its newest memories are in its instructions on every turn, and `memory_search` finds the rest.

Text that is empty or over 1,000 characters fails with status 400, and a memory the bot doesn't have with 404.

## Keep team memories

Team memories are notes every bot reads, after its own, such as who the owner is, or what the household is. Since 0.10.0, `fxbot.memories` keeps them, with the same calls and checks as a bot's:

```ts
const cats = await fxbot.memories.add("The household has two cats, Miso and Tofu.");
const team = await fxbot.memories.list(); // newest first; { query } searches
await fxbot.memories.update(cats.id, "The household has two cats: Miso and Tofu.");
await fxbot.memories.remove(cats.id);
```

- **Each has `team: true`,** and `savedByBot`: the bot that saved it, when one did, or null for one you added or one whose bot is deleted.
- **A bot saves one** with `memory_save` and `team: true`, when the owner asks it to remember something for every bot.
- **One of a bot's own becomes the team's** with `fxbot.profiles.memories.share(bot.id, memory.id)`. It leaves the bot's list. If the team already says the same, the bot's copy goes, and the team's comes back.
- **The same text** can be both a bot's own and the team's. A duplicate is the same text in the same set.

## Watch a bot save its own

During a turn, a bot calls `memory_save`, `memory_search`, and `memory_forget`. They show on the chat's stream as tool calls, with what the bot passed in `input`, such as the `text` that `memory_save` saves:

```ts
if (line.type === "tool_start" && line.name?.startsWith("memory_")) console.log(line.name, line.input);
```

Reading the stream: [Stream replies](/sdk/how-to/stream-replies/).

## Choose where vectors come from

Search by meaning needs vectors from an embedding model. Pick where they come from in the settings:

```ts
await fxbot.settings.update({ embedder: "local" }); // the default: the embedder at embedUrl
await fxbot.settings.update({ embedder: "remote", embeddingProvider: openai.id, embeddingModel: "text-embedding-3-small" });
await fxbot.settings.update({ embedder: "off" }); // words only
```

- `local` uses the embedder you gave `createFxbot` as `embedUrl`, such as the one that fxbot's compose file runs.
- `remote` uses a provider's embedding model. The provider must serve embeddings: OpenAI, OpenRouter, AI Gateway, a Vercel account, Ollama, LM Studio, or another OpenAI-style server. The SDK embeds a test string first. If that fails, `update` fails with status 400, and the old setting stays.
- `messageVectors` is how many characters of each chat message get a vector, 8,000 by default. `0` gives vectors to memories only.

A new model means new vectors for everything. They fill in behind your app, memories first, then messages, newest first. Search keeps working meanwhile, with the vectors the model has made, and with words.

## Check how far vectors have got

```ts
const status = await fxbot.settings.embedding();
console.log(`${status.model ?? "Off"}: ${status.memoriesWithVectors} of ${status.memories} memories, ${status.withVectors} of ${status.messages} messages`);
if (status.error) console.error(status.error);
```

`model` is null when vectors are off, or when the local embedder isn't answering. `error` is the last thing that went wrong, until vectors fill in again.

## From a page

The client has the same calls over fxbot's HTTP API: `client.profiles.memories.list(id, query)`, `add`, `update`, `remove`, and `share`, `client.memories.list(query)`, `add`, `update`, and `remove` for the team's, then `client.settings.update(...)` and `client.settings.embedding()`. See [Build a page on the client](/sdk/how-to/web-page/).

## If it doesn't work

- **The status says this fxbot has no local embedder.** `createFxbot` got no `embedUrl`. Pass it, or pick `remote` or `off`.
- **The status says the local embedder isn't answering yet.** On its first start, it downloads its model, 310 MB. Until it answers, search uses words alone, and the vectors wait.
- **`update` says the embedding model didn't answer.** The test string failed. Check the model's id, and that the provider serves it. Ollama must have pulled it first, as with `ollama pull nomic-embed-text`.
- **`update` says that provider serves no embeddings.** ChatGPT and Grok plans, and OpenCode keys, serve none. Pick another provider.
- **`update` asks for a provider and an embedding model.** `remote` needs both.
