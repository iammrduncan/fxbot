---
title: "Providers"
description: "Every provider on Add provider, in Settings › Providers: how each connects, its address, where its models come from, and where its key is checked. Each bot runs on one provider."
---

Every provider on **Add provider**, in **Settings** › **Providers**, and in first-run setup. Each bot runs on one provider. To add one, see [Add a provider](/docs/how-to/add-a-provider/), and each provider's own page.

<!-- providers -->

**Search** also finds about 175 more hosts from [models.dev](https://models.dev): those that speak OpenAI's Chat Completions at a fixed HTTPS address. Each takes a key, at models.dev's address for it, and its models come from its own list, or models.dev's when it has none. They haven't been tried with fxbot.

## The list of providers

- fxbot ships its list of providers, `providers-registry.json`, with each release, and reads it again every hour from fxbot.sh, as it does the plugin list ([`FXBOT_LISTS_URL`](/docs/reference/configuration/)). A new provider, or a key page that moved, needs no release.
- An entry that needs something this fxbot can't do, such as a way to sign in it doesn't know, is left out.
- A provider keeps what it needs to run when it's added: its address, its fields, and the model ids typed for it. One whose entry later leaves the list carries on.

## Keys and sign-ins

- A key is checked with the provider when it is added: where the table says, or at its model list. It is refused when the provider answers 401 or 403, or a status the entry names, such as xAI's and Gemini's 400. A 404 passes, which a server with no list at `/models` gives.
- A provider whose list answers any key, such as NVIDIA's, can't be checked before a chat. Its card says so, and a wrong key shows at the first message.
- A chat whose provider refuses its key with 401 says which provider, and to replace the key in **Settings** › **Providers**. A 403 says the key may lack a permission, or the account may need credit or be over its quota, since providers use it for all of those.
- A field, such as a region or an account, fills in the provider's address. A field with options takes one of them, and any other field takes a name, with nothing that could change the address's shape.
- A key goes to the server once and is never sent back. A provider in the list says only whether it holds a key or a sign-in.
- A sign-in runs on the server. The page gets the link and the code, or the page to open, and when it expires.
  - **Device code:** ChatGPT, Grok, Hugging Face, and OrcaRouter, and Vercel where its sign-in shows. Open the link on any device, and enter the code.
  - **OpenRouter** comes back to fxbot's own page when the page's address is HTTPS or on localhost. On a plain-HTTP address, or when asked, it shows a code to paste instead.
  - **Vercel and Hugging Face** need fxbot's own app at each, which fxbot's list of providers names, or [`FXBOT_VERCEL_CLIENT_ID` and `FXBOT_HF_CLIENT_ID`](/docs/reference/configuration/) in its place. A sign-in whose app isn't set doesn't show. Vercel's isn't, since Vercel doesn't let fxbot's app use a device code yet.
- **Vertex AI** takes a service account's JSON key. fxbot makes its own hour-long tokens from it, and a new one 5 minutes before each ends.
- Keys and tokens are stored sealed. See the [security model](/docs/explanation/security/).

A new key works from the next request, even for a turn already running. **Remove** ends whatever is still running on a provider first, in any chat, and its key stops working at once.

When a provider keeps refusing, such as with a rate limit, libfx tries again by itself. After 5 minutes of nothing but refusals, fxbot stops the turn, and the chat says why. A model that's only slow is left alone.

## Model lists

- A provider's models come from its own list, with [models.dev](https://models.dev)'s context window, tool use, images, and [thinking levels](#thinking-levels) for each model it knows: by its id, then by its id without a vendor, then by models.dev's canonical id. A model models.dev doesn't know lists without them.
- Where the provider has no list, its models are models.dev's, as the table says. Where you typed model ids, such as Azure's deployments, those are the list.
- fxbot keeps each provider's model list in Postgres and answers with it at once. A list older than 5 minutes is fetched again behind that answer, and a failed fetch keeps the old list.
- A list is dropped when its source changes: a new key, address, team, sign-in, or model ids.
- models.dev is read at most once a day.
- The model picker takes a model id that the list lacks.
- A provider's **Context window**, on a server on your machine or **Custom**, overrides what the server reports, for every model it serves.

## Thinking levels

A model's thinking levels, which **Thinking** on a bot's edit screen offers, come from where its provider lists them:

| Provider | Where its models' levels come from | A bot's level reaches the model |
| --- | --- | --- |
| AI Gateway, Vercel | AI Gateway's catalog, the one the agent checks a level against | Now. Max goes as Extra high, the most the gateway's route takes |
| ChatGPT | ChatGPT's model list | Now. Minimal goes as Low |
| Grok | Grok's model list | Now |
| OpenRouter, and servers with OpenRouter's list | Each model's `supported_efforts` | With a coming update |
| Ollama | Each model's `thinking` values | With a coming update |
| LM Studio | Each model's reasoning options: its off is Off | With a coming update |
| Every other provider by key | [models.dev](https://models.dev)'s reasoning options for each model | With a coming update |

- **Model's default** sends no level, on every provider.
- **A level the model doesn't offer** runs as the nearest lower one it offers, never as Off, and the server's log says so once. With no lower level, the model's own default runs.
- **"With a coming update"** is libfx's: version 0.0.16 sends a level only for AI Gateway, ChatGPT, and Grok. Its next release lets a custom provider's models offer levels. Until then, fxbot sends none for them, so no turn fails for one.

## Embeddings

Memory search can take its vectors from a provider's embedding model, picked in **Settings** › **Memory** ([Choose where memory search's vectors come from](/docs/how-to/memory-search/)).

| Provider | Embeddings from |
| --- | --- |
| OpenAI, OpenRouter, Ollama, LM Studio, Custom | `/embeddings` under its address |
| AI Gateway, Vercel | `https://ai-gateway.vercel.sh/v1/embeddings`. A Vercel account is untested. |
| Any other | None |

- The model's id is typed in, as the provider names it.
- Picking one embeds a test string first. If that fails, the old setting stays.
- Removing the provider turns search by meaning off, until another is picked.
