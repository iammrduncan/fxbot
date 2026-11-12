# Reasoning

The owner sets how hard a bot thinks:
- **Thinking, on each bot.** Under its model, on the bot's edit screen: **Model's default**, then the levels that model offers, such as Off, Low, Medium, High, Extra high, and Max. A model that offers none shows no setting.
- **Subagents' thinking.** The subagents plugin gets a setting of its own, "Same as the bot" by default, or a level. A bot can do its own work at Medium and hand deep digging to subagents at High.
- **Only what the model takes.** fxbot reads each model's levels from where its provider lists them. A level the model doesn't offer is never sent. A bot moved to another model keeps its level when the new model offers it, and goes to the nearest lower one when it doesn't.
- **On every route, in two steps.**
  - **Now:** AI Gateway and Vercel, ChatGPT, and Grok, which libfx 0.0.16 already takes an effort for.
  - **With the next libfx release:** every other provider, by key or on the machine. Its custom models gain levels in [fx #1803](https://github.com/vercel-labs/fx/pull/1803), merged on 2026-11-12, and not yet released.

Status: the first step built on 2026-11-12, for 0.10.0, as planned the same day at the owner's word, with the open questions' recommendations: **Thinking** on each bot, every model's levels, the level to libfx on AI Gateway, Vercel, ChatGPT, and Grok, and a subagent's own level. The second step, levels for every other provider, waits for a libfx release with fx #1803, as [Claude's own API](../../phases/claude-messages.md#when-to-revisit) does. Where the build differs from the plan, [What the build changed](#what-the-build-changed) says so. Researched the same day:
- against libfx 0.0.16 as installed, fx's source at `8352e0c`, and fx's `main` at `a6e4a946`, where #1803 merged
- against models.dev, AI Gateway's catalog, and 21 providers' own docs
- against Claude Code, Codex, OpenCode, OpenClaw, Hermes Agent, Pi, Gemini CLI, and the AI SDK

It takes over **A bot's effort** from the on-hold [Claude's own API](../../phases/claude-messages.md#a-bots-effort) plan, which stays about Anthropic's own API.

## What the owner asked

"Reasoning. Allow setting reasoning level on the model chosen for a bot or its subagents." (2026-11-12)

## 0. Core or plugin

**Core, with one small widening of the plugin API for subagents.**
- **A bot's level is core.** "A model" is one of the things every bot needs ([Core or plugin](../../../CONVENTIONS.md#core-or-plugin)), and how hard it thinks is part of which model it runs. The level is passed where the model is, on each open of a chat (`packages/sdk/src/index.ts:323`), and lives with the bot's model in `profiles`.
- **Subagents' level is the subagents plugin's setting.** A subagent is a session of the plugin's own, and every turn there opens with the bot's own model (`index.ts:309-323`). The plugin can't give it another level without core's help.
  - **The smallest widening:** `fx.chats.newSession(bot, { label, effort })`, kept with the session, and used when it opens. It's added, so nothing breaks.
  - **Already foreseen:** the [subagents phase](subagents.md) named the same widening for a model: `newSession(bot, { model })`.

## 1. Research

### fxbot today

- **A bot is a provider and a model,** with no level (`packages/sdk/src/migrations/0001_baseline.sql:6-8`, `Fields` in `packages/sdk/src/types.ts:33`). The newest migration is `0015_session_labels`.
- **Each open passes the model as a plain id,** `agent.session(sessionId, { model, instructions, context })` (`index.ts:323`), never `{ id, effort }`. libfx is never given a level.
- **One libfx agent per provider record** (`packages/sdk/src/providers.ts:202-226`). Its options pick the route (`providers.ts:175-200`):
  - `codex` for ChatGPT
  - `grok` for Grok
  - AI Gateway's for an AI Gateway key and for Vercel
  - a custom provider, which speaks OpenAI's Chat Completions, for every other provider
- **A custom model's metadata** is filled in before a chat opens: `contextWindow`, `maxOutputTokens`, `supportsToolUse`, `supportsVision` (`providers.ts:333-347`).
- **fxbot drops every list of levels it reads** (`packages/sdk/src/models.ts`):
  - **models.dev:** fxbot keeps the id, name, limits, tools, and images, and drops `reasoning` and `reasoning_options` (`:40-47`).
  - **ChatGPT and Grok:** their lists come with each model's levels, and fxbot keeps neither (`:184-196`).
  - **AI Gateway and Vercel:** fxbot keeps only ids (`:197-205`).
  - **Ollama:** fxbot reads `/api/show` for tools and images, not `thinking` (`:206-222`).
- **A provider's catalog entry already carries request headers,** sent on every request (`types.ts:142-172`, `entryFetch`, `providers.ts:56-66`). The catalog is read hourly from fxbot.sh, so an entry can be corrected between releases (`catalog.ts:4-6`). An older fxbot ignores a field it doesn't know (`catalog.ts:23-41`).
- **The page calls reasoning "thinking":** a reply's reasoning is a step titled **Thinking**, then **Thought** (`packages/ui/src/steps.tsx:63`, `:113-120`). The bot's model is picked with `ModelField`, under **Provider** (`packages/ui/src/app.tsx:552`).
- **Subagents:** `fx.chats.newSession(bot, { label })` (`packages/sdk/src/plugin-api.ts:102-104`), saved in `plugin_sessions` (`migrations/0006_plugins.sql:6`, `0015_session_labels.sql:3`). The subagents plugin's settings are strings with a default (`plugins/subagents/plugin.json`).

### libfx

From the installed 0.0.16, and fx's source at `8352e0c` and `a6e4a946`.
- **A level is `model: { id, effort }`.** "`"default"` leaves the choice to the model; a named level requests that level" (`types/libfx.d.cts:38-46`). Any name of letters, digits, `.`, `-`, and `_` passes the format check. `default`, `auto`, and `adaptive` all mean the model's own default.
- **A level the model doesn't list fails the turn.** On a durable agent, as fxbot's are, the engine opens as the turn starts, and the turn ends with `LIBFX_MODEL_UNSUPPORTED_EFFORT`. "No model request was made" (`sdk/tests/test-durable.mjs:1665-1677`; the check is `src/acp/server.zig:3124-3193`). A model that lists none "rejects any named effort".
- **A level can change from one turn to the next.** "Each prompt runs with the context its caller gave and its session object's settings", and a change reopens the engine (`durable.js:2086-2093`). So a session of its own can have a level of its own.
- **Where the levels come from, and what's sent:**

  | Route | Levels from | On the wire |
  | --- | --- | --- |
  | AI Gateway, Vercel | `ai-gateway.vercel.sh/coding-agent/v1/models`, each model's `reasoning_options` (`src/builtins/gateway.zig:2927-2949`) | `"reasoning": "<level>"`. `max` goes as `xhigh`, since the route "rejects "max"" (`src/gateway/vercel_protocol.zig:318-324`) |
  | ChatGPT | `chatgpt.com/backend-api/codex/models`, `supported_reasoning_levels` (`src/gateway/openai_codex_models.zig:269-308`) | `"reasoning": {"effort", "summary": "auto"}`. `minimal` goes as `low` (`openai_codex.zig:108-113`) |
  | Grok | its catalog's `reasoning_efforts` (`src/gateway/xai_grok_models.zig:339-391`) | `"reasoning": {"effort", "summary": "auto"}` |
  | Custom, in 0.0.16 | none: a custom model has no levels (`custom-provider.js:13-20`) | nothing. A request that carried one is refused (`src/gateway/chat_completions_protocol.zig:167-171`) |

- **[#1803](https://github.com/vercel-labs/fx/pull/1803) gives custom models levels.** It merged into `main` on 2026-11-12, and isn't in a release yet: npm's newest is 0.0.16. A custom model gains `reasoningEfforts`: "The effort levels the model offers, in order, each with the request fields that choose it, such as `{ high: { reasoning_effort: "high" } }`. A level the model does not list is not sent" (`sdk/types/libfx.d.cts:667-694` at `a6e4a946`).
  - **The fields can be any JSON,** so `{ thinking: { type: "disabled" } }` and `{ chat_template_kwargs: { enable_thinking: false } }` fit.
  - **libfx's test** sends `reasoning_effort: "high"` for `high` (`sdk/tests/test-agent-custom.mjs:274-294`).
  - **The same merge counts cached and reasoning tokens** in a turn's usage, which [Claude's own API](../../phases/claude-messages.md#when-to-revisit) waits on too.
- **A host `fetch` could add the fields on 0.0.16.** The body reaches fxbot's `fetch` as bytes (`node.js:460-465`). But the request doesn't say whose it is: only `credentials({ sessionId })` sees the session, as `opencodeFetch` uses it (`providers.ts:193-199`). A server with no key has no `credentials()`, and the compactor's requests go through the same `fetch`.
- **fx's own subagents take a level:** "Reasoning effort for a new child", and "Model and effort default to the profile's, then the parent's" (`src/builtins/tools.zig:201`, `src/core/subagent/model_contract.zig:130-142`).

### Providers

From each provider's own docs, read 2026-11-12. Nearly all take `reasoning_effort` on Chat Completions, but the values belong to each model:

| Provider | The field | Off |
| --- | --- | --- |
| OpenAI | `reasoning_effort`: `none` … `max`, a subset per model | `none`, where the model lists it |
| OpenRouter | `reasoning: {effort}` (also `reasoning_effort`), levels per model in `/api/v1/models` | `effort: "none"`, refused where reasoning is mandatory |
| xAI | `reasoning_effort` | grok-4.3 only: "Reasoning cannot be disabled" from 4.5 on |
| DeepSeek | `reasoning_effort` (`low`, `high`, `max`), and `thinking: {type}` | `thinking: {type: "disabled"}` |
| Z.ai, Kimi K2.6, MiniMax | `thinking: {type}`, and `reasoning_effort` on newer models | `thinking: {type: "disabled"}`, where there is one |
| Qwen (DashScope) | `enable_thinking`, `thinking_budget`, `reasoning_effort` | `enable_thinking: false` |
| Gemini (compatible API) | `reasoning_effort` (`minimal` … `high`) | `none`, on 2.5 Flash only |
| Groq, Mistral, Together, Fireworks, DeepInfra, Cerebras, Hugging Face | `reasoning_effort`, per model | `none`, where listed |
| Ollama, vLLM, llama.cpp | `reasoning_effort`, passed to the model's template; vLLM and llama.cpp also `chat_template_kwargs` | `none`, "if the model permits it" |
| Anthropic's compatible API | `thinking: {type: "enabled", budget_tokens}`; `reasoning_effort` is "Ignored" | not documented |

- **A level a model doesn't take** gets a 400 (OpenAI, MiniMax, Qwen, Fireworks), is quietly changed (DeepSeek, xAI, Ollama, OpenRouter's "nearest supported level"), or is ignored (Anthropic's compatible API).
- **OpenAI by key, over Chat Completions:** "GPT-6 Sol and GPT-6 Luna support function calling in Chat Completions only with `reasoning_effort: "none"`." A bot with tools there gets little from a level until libfx speaks OpenAI's Responses API to a custom provider.
- **Some servers list a model's levels:**
  - OpenRouter's `/api/v1/models`: `supported_efforts` and `default_effort`
  - Ollama's `/api/show`: `thinking.values`
  - LM Studio's `/api/v1/models`: `capabilities.reasoning`
  - llama.cpp's `/props`

### models.dev

From `api.json` and the `sst/models.dev` source at `90d301ac`, read 2026-11-12.
- **Every model says `reasoning: true` or `false`.** A reasoning model has `reasoning_options`, a list of these (`packages/core/src/schema.ts:318-334`):
  - **`{ type: "effort", values }`:** "Graded levels (`none`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max`), sorted low to high"
  - **`{ type: "toggle" }`:** on or off
  - **`{ type: "budget_tokens" }`:** a budget of tokens
  - **an empty list:** "Always-on, no caller control" (`AGENTS.md:274-281`)
- **It says which levels, not which field.** The field is in a comment at the top of each source file, which `api.json` doesn't carry. "DeepSeek and Alibaba are first-party labs that use that package with **lab-specific** fields" (`AGENTS.md:290`, `:315-343`). So fxbot's catalog has to say the field, per provider.
- **AI Gateway's catalog uses the same shape,** `reasoning_options`, so one reader serves both.

### Other assistants

From Claude Code's changelog and docs, Codex at `c0cc9fc`, OpenCode at `1017760`, OpenClaw at `56eb6f3`, Hermes Agent at `e7212db`, Pi at `d78a75e`, Gemini CLI at `aeb6c04`, and the AI SDK at `11323f9`, read 2026-11-12.

| | The levels | Default | For subagents | A level the model lacks |
| --- | --- | --- | --- | --- |
| **Claude Code** | `low` … `max`, per model | per model | the agent file's `effort`, or the Agent tool's; with neither, the session's level, only on the same model | "falls back to the highest supported level at or below the one you set" |
| **Codex** | `none` … `max`, `ultra`; its apps say Light … Ultra | per model | `default_subagent_reasoning_effort`, the agent file's, the spawn tool's, else the parent's; a new model gets its own default | each model lists its levels |
| **OpenClaw** | `off` … `max`, `ultra` | the provider's, else `medium` | `subagents.thinking`, or the spawn tool's `thinking`; the caller's only when the caller chose one | typed: refused; inherited: lowered, with a notice |
| **Hermes Agent** | `none` … `max` | `medium` | `delegation.reasoning_effort`, "empty = inherit" | lowered to the nearest weaker one, never to off |
| **Pi** | `off` … `max` | `medium` | its example inherits the parent's | lowered |
| **AI SDK** | `provider-default`, `none` … `max` | `provider-default`, which sends nothing | what the app passes | rounded down, with a warning |

Where they agree:
- **One ladder,** `none`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max`, with each model offering a part of it.
- **"Default" is a choice of its own,** that sends nothing.
- **Levels belong to a model.** Claude Code and Codex don't carry a bot's level to another model.
- **A missing level goes down,** so it never costs more.
- **Subagents get a setting of their own,** then the parent's level.
- **Showing the thinking is a separate matter** from how hard the model thinks.

## 2. Key takeaways

1. **Offer only the model's own levels.** On the routes that take a level, libfx fails the turn for one the model doesn't list, before any request. Providers 400, remap, or ignore. So the setting lists the model's levels, read from where its provider says, and fxbot never sends another.
2. **"Model's default" sends nothing,** and it's where every bot starts. A bot's chat behaves as it does today until the owner picks a level.
3. **Levels come from five places, and fxbot reads three of them already:**
   - models.dev's `reasoning_options`, for keyed providers
   - AI Gateway's catalog, for AI Gateway and Vercel
   - ChatGPT's and Grok's lists, which fxbot already fetches
   - local servers' own lists: Ollama, LM Studio, llama.cpp, and OpenRouter

   fxbot keeps them as `efforts` on each model, low to high.
4. **Which field to send is the catalog's,** since models.dev doesn't say. Most providers take `reasoning_effort: <level>`. An entry says otherwise where it must: DeepSeek's and Z.ai's off, OpenRouter's `reasoning`, DashScope's `enable_thinking`. The catalog is read hourly, so a wrong mapping is fixed without a release.
5. **Now, then next.** Three routes take a level today. Every other provider needs #1803's `reasoningEfforts`, merged today. A `fetch` wrapper on 0.0.16 would have to sneak the session into the key, invent one for servers with none, and would catch libfx's own summary requests. Waiting for the release is cleaner, and the release brings cache counts too.
6. **A missing level goes down.** A bot whose saved level isn't the new model's runs at the nearest lower one the model has, else at its default. The saved level stays, and comes back on a model that has it. Hermes and OpenClaw lower, and keep what was asked.
7. **Subagents: a setting, then the bot's.** The plugin's **Thinking** setting is "Same as the bot" by default, or a level. A level the bot's model lacks goes down as above. A spawn-time choice by the bot is a question ([Question 3](#5-open-questions)).
8. **A level is a setting, not a per-message switch.** Changing it mid-chat costs Claude's cache, and every harness keeps it a setting. libfx can change it from turn to turn, which is what lets a subagent's session run at its own level.
9. **The thinking already shows.** Replies' reasoning is drawn as **Thinking** today. A setting to hide it is apart from this ([Not in this phase](#not-in-this-phase)).

## 3. Implementation

### A bot's level

**The table.** A migration, at the next free number:

```sql
-- How hard a bot's model thinks: '' is the model's default, else a level its model offers, such as 'high'. A
-- plugin's session may have its own, such as a subagent's.
alter table profiles add column effort text not null default '' check (effort ~ '^[A-Za-z0-9._-]{0,64}$');
alter table plugin_sessions add column effort text;
```

- **The SDK:** `Fields` gains `effort`, checked like the others, and `fxbot.profiles` sets and clears it. `Profile` carries it to the page and the client.

**What fxbot keeps of a model.** `Model` gains `efforts?: string[]`, the levels it offers, low to high, without `default`:
- **models.dev:** the `effort` entry of `reasoning_options`. A `toggle` with no effort list gives `["none", "high"]`: off, and on.
- **ChatGPT:** `supported_reasoning_levels[].effort`.
- **Grok:** `reasoning_efforts[].value`.
- **AI Gateway and Vercel:** each model's `reasoning_options` from `https://ai-gateway.vercel.sh/coding-agent/v1/models`, the catalog libfx reads. fxbot reads it hourly, as it does models.dev, since libfx's `listModels` gives ids only.
- **Ollama:** `thinking.values` from `/api/show`, which fxbot already calls. **LM Studio:** `capabilities.reasoning.allowed_options`, with `off` as `none` and `on` dropped. **OpenRouter:** `supported_efforts`.
- **A model with no list** has no `efforts`, and the page offers no setting for it.

**Choosing what's sent.** `open()` turns the bot's level into the model's, with `effortFor(level, efforts)`:
- **The level, when the model lists it.**
- **Otherwise the nearest lower level it lists,** on the ladder `none`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max`. A level the ladder doesn't know is used only as listed.
- **Otherwise none,** and the model's default runs.

A lowered level writes one line to fxbot's log per chat open, such as "Scout's Max runs at High on gpt-5". `open()` then passes `model: { id, effort }` when there's a level, and the id alone when there isn't.

**On the routes that take a level now:** AI Gateway and Vercel, ChatGPT, and Grok. libfx sends it, as the table above says. The docs note AI Gateway's `max` going as `xhigh`, and ChatGPT's `minimal` as `low`.

**On custom providers, with the libfx release that has #1803:**
- **fxbot moves to that release.**
- **`agentFor`, which fills a custom model's metadata before a chat opens** (`providers.ts:333-347`), adds `reasoningEfforts`: each of the model's levels, mapped to its request fields.
- **The fields come from the catalog entry's `efforts`:**

  ```json
  "efforts": { "*": { "reasoning_effort": "$level" }, "none": { "thinking": { "type": "disabled" } } }
  ```

  - **`*`** is every level, and `$level` becomes the level's name.
  - **A level's own key** overrides `*` for that level.
  - **An entry with no `efforts`** sends `reasoning_effort`, the common case.
  - **`"efforts": null`** sends nothing. That's for Anthropic's compatible API, which ignores it, until [Claude's own API](../../phases/claude-messages.md).
- **Until that release,** a custom provider's models show the setting, marked "Takes effect with a coming update", and `effortFor` sends nothing for them, so no turn fails.

### The page

On the bot's edit screen, under **Model**:

```text
Model      [ gpt-5.6-mini                 ▾ ]
Thinking   [ Model's default ▾ ]   Off · Low · Medium · High · Extra high · Max
           How hard it thinks before it answers. Higher is slower, and costs more.
```

- **The choices are the model's levels,** in its order, with plain names: Off (`none`), Minimal, Low, Medium, High, Extra high (`xhigh`), and Max. Any other level shows as it's named.
- **Hidden** when the model lists none.
- **A model change** keeps the level when the new model has it. When it doesn't, the select shows what will run, such as "High (Max isn't offered)", as `effortFor` does.
- **The model picker** (`ModelField`) passes up the chosen model's levels, so the edit screen knows them without another call.

### Subagents

- **The plugin API:** `fx.chats.newSession(bot, { label, effort })`, "Since 0.10.0". `effort` is a level name, or none for the bot's own. It's kept in `plugin_sessions.effort`, and `open()` uses it in place of the bot's level for that session, through `effortFor`. Since it's added, `plugin-breaks.json` gets no line.
- **The subagents plugin** gets a setting, `thinking`: "How hard subagents think: same (the bot's own level), or a level such as low, medium, high, xhigh, or max". Its default is `same`. It passes the level to `newSession` for each subagent. A level the bot's model lacks goes down, as the bot's own does.
  - **It goes to 0.2.0,** and its `minFxbot` to the release this ships in.

### Docs

- **`explanation/bots-and-chats.md`:** **Thinking**, its levels, why they differ by model, and what happens on a model change.
- **`reference/providers.md`:** which providers take a level now and which with the coming update, and the `max` and `minimal` notes.
- **The plugin API reference** for `newSession`'s `effort`, the subagents README for its setting, and `## Unreleased`, with the migration.
- **[Claude's own API](../../phases/claude-messages.md):** its **A bot's effort** points here.

### Not in this phase

- **Another model for subagents,** `newSession(bot, { model })`. It's the same widening, and the subagents phase left it until owners ask.
- **A level per message,** such as OpenClaw's `/think` or Claude Code's `ultrathink`. It costs Claude's cache.
- **Hiding the thinking.** Its steps already fold, and showing it is a setting apart from this.
- **A cap on levels,** such as Claude Code's `maxEffortLevel`.
- **Anthropic by key,** which waits for [Claude's own API](../../phases/claude-messages.md).

### Size

| Where | Lines, about |
| --- | --- |
| Migration, `Fields`, `effortFor`, and `open()` | 50 |
| Reading the levels: models.dev, AI Gateway, ChatGPT, Grok, Ollama, LM Studio, OpenRouter | 90 |
| The page: the Thinking select | 50 |
| `newSession`'s `effort`, and the subagents setting | 30 |
| With the libfx release: `reasoningEfforts` from the catalog, and the entries | 40, and the catalog's JSON |
| Docs | 70 |

## 4. Checklist

Now, against a disposable fxbot and a copy of a 0.9.0 database:
- [x] The migration runs on the copy. Every bot reads **Model's default**, and its chat sends what it did before.
- [x] `efforts` reads as models.dev, ChatGPT, Grok, AI Gateway, Ollama, LM Studio, and OpenRouter list them, from saved copies of each list. A model with none has no `efforts`.
- [x] `effortFor` keeps a listed level, lowers an unlisted one to the nearest lower listed one, and gives none when nothing is lower or the model lists none.
- [x] The edit screen shows **Thinking** with the model's levels, and none for a model with no list. Saving a level and clearing it both stick. A model change shows the level that will run.
- [x] A bot on AI Gateway at **High** opens its chat with `model: { id, effort: "high" }`, read from libfx's session options in a check. A bot at **Model's default** opens with the id alone.
- [x] A custom provider's bot at a level sends no level on 0.0.16, and its turn runs.
- [x] `newSession(bot, { effort: "high" })` saves the level with the session, and its turns open at it. The subagents setting at `high` makes each subagent's session `high`, and at `same`, the bot's.

With the libfx release that has #1803, against a mock Chat Completions server that logs each request:
- [ ] A bot at **High** on a keyed provider sends `reasoning_effort: "high"`. DeepSeek at **Off** sends `thinking: {type: "disabled"}`, as its entry says. An entry with `"efforts": null` sends nothing.
- [ ] A level the model doesn't list is never sent, and the turn runs.

The rest:
- [x] Docs as above, `npm run typecheck`, `npm run build`, `npm run build-site`, and `git diff --check`.

Only a person can check, with real accounts:
- [ ] A ChatGPT sign-in, an AI Gateway key, and a Grok sign-in each run a bot at **High**, and the reply's thinking shows. A level change takes effect on the next message.
- [ ] With the libfx release: OpenAI, OpenRouter, and an Ollama model with thinking, each at a level.

## 5. Open questions

Taken as recommended at the build, on 2026-11-12: wait for the libfx release for keyed and local providers, show the setting for them meanwhile with a note, no level chosen by the bot when it starts a subagent, and the name **Thinking**.

1. **Wait for the libfx release for keyed and local providers?** Recommended: yes. #1803 merged today, and the same release brings cache counts. A `fetch` wrapper on 0.0.16 needs a fake key on servers with none, and changes libfx's own summary requests too.
2. **Show the setting on custom providers before the release?** Recommended: yes, marked "Takes effect with a coming update", so an owner can set it once. The other way is to hide it until the release.
3. **Should a bot choose a level when it starts a subagent?** Claude Code, Codex, and OpenClaw let the spawning call name one. Recommended: not now. The owner's setting decides, and a bot raising its own subagents' level costs money the owner didn't choose.
4. **What to call it.** The page already says **Thinking** for a reply's reasoning. Recommended: **Thinking**, with Off, Low, Medium, High, Extra high, and Max. Codex's apps say Light to Ultra, and the providers say "reasoning effort".

## What the build changed

- **A toggle isn't a level.** The plan had a model with only an on-off switch offer Off and High. libfx skips such a switch on AI Gateway, and what it means elsewhere waits for the libfx release, so a model offers only its `effort` values. One with a switch alone, or a token budget, offers none.
- **Never lowered to Off.** `effortFor` lowers a level to the nearest lower one the model offers, as planned, but stops above Off, as Hermes and OpenClaw do: a bot asked to think a little never ends up not thinking. With nothing lower, the model's own default runs.
- **The edit screen reads the model's levels itself.** The plan had `ModelField` pass them up. **Thinking** asks the provider's model list, which the server keeps, once per model change. `ModelField` and the plugins that use it are unchanged. Its hint says what the level does on the four providers that take one now, and that it takes effect with a coming update on the rest.
- **A level the model lacks shows what runs,** in the select: "Max: runs as High on this model", or "High: not offered on this model" when nothing lower is offered, so the owner can see it and clear it.
- **The log says it once,** for each bot, model, and level, not at each chat open: "Gwen's thinking level xhigh runs as high on openai/gpt-5, which offers minimal, low, medium, high."
- **AI Gateway's levels come from its coding-agent catalog,** read at most once a day. libfx checks a level against the same catalog. If it can't be read, the models offer none.
- **models.dev's copy is version 3.** It keeps each model's levels. A version 2 copy, from 0.9.0, still serves while models.dev can't be reached, without levels, until the next fetch.
- **The docs are a how-to,** [Choose how hard a bot thinks](../../../packages/website/src/content/docs/docs/how-to/choose-how-hard-a-bot-thinks.md), which the explanation's bot section links to, and a **Thinking levels** section in the providers reference. That page is generated from `packages/website/src/providers-reference.md`, which is where it's written.
- **Subagents 0.2.0 needs fxbot 0.10.0,** for `newSession`'s `effort`. Its `thinking` setting is `same` by default. A value that isn't a level's name is the bot's level, with one line in the plugin's log.
- **The checks:**
  - **The model readers, 18:** with a stand-in `fetch` for ChatGPT, Grok, AI Gateway, and an OpenRouter-shaped list, real models.dev data, and Ollama and LM Studio lists on a local stand-in.
  - **The server, 22, through a libfx probe:** a check-only loader logs each session's model option, and answers a fixed AI Gateway list for a fake key.
    - **The upgrade:** a database made by 0.9.0's code, at `8c81170`, with a bot that had chatted, migrated with a backup first, and the bot reads **Model's default**.
    - **What libfx got:** `{ id, effort }` for AI Gateway at High, High for Extra high on gpt-5, with its log line, and the id alone at the default. A custom provider got the id alone, and its turn ran.
    - **A plugin session's own level:** through a throwaway plugin, it took the bot's place, and a session without one followed the bot's.
    - **The subagents setting:** at `high`, and at `same`.
  - **The page, 8, in Chromium:** **Thinking** on Ollama, AI Gateway, a model with none, and a level a model lacks.
- **The second step, still to build, with the libfx release:** the catalog's `efforts` mapping and `reasoningEfforts` in `agentFor`, and the checks against a mock that need them. Writing them now would be code nothing can run.

### PDFs, at the owner's word

"Also fix uploads to bots to allow pdfs... thats absolutely needed." (2026-11-12) It was built beside this phase, as a fix to what a message can carry, so it's recorded in the [library's](library.md#what-the-build-changed) build notes.
