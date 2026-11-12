# Claude's own API

A bot on Claude by key talks to Anthropic's own Messages API, so prompt caching and thinking work:
- **Prompt caching.** The tools and the system prompt are cached once per chat, and the conversation so far on every call, so a long chat or an agent's long trial pays about a tenth for what it has sent before.
- **Thinking.** Claude thinks at the effort its bot asks for, and what it thinks shows in the reply's steps.
- **Cache counts in a turn's usage.** A caller on the SDK, such as Thermite, sees cache reads and writes on the turn, as libfx already defines them.
- **What each provider caches.** A table in the docs says which of fxbot's providers cache by themselves, and what fxbot does to keep the cache warm.

Status: planned on 2026-11-11, from [issue #18](https://github.com/iammrduncan/fxbot/issues/18), and on hold. It isn't for 0.10.0: the owner wants it documented, and libfx checked again later for its own fix ([When to revisit](#when-to-revisit)). The stopgap the owner chose is in place meanwhile. The stopgap is done: the catalog's note on Anthropic and the Anthropic and Vercel provider pages send Claude by key through AI Gateway with the owner's own Anthropic key (`857bccc`). Researched the same day:
- fxbot's providers and libfx 0.0.16, from fxbot's code and from libfx's source at `vercel-labs/fx` `8352e0c`
- Anthropic's Messages API, from the Claude API reference skill (cached 2026-10-06)
- how Pi, Hermes Agent, OpenClaw, and the Vercel AI SDK cache Claude and carry its thinking, from their source on 2026-11-11, and libfx's issues and pull requests on it
- how 22 of fxbot's providers cache, from each one's own docs

## What the owner asked

Issue #18, "Claude by key: speak Anthropic's Messages API, so prompt caching and thinking work":
- "Claude by API key should use Anthropic's own Messages API, so that prompt caching and thinking work."
- Why now: "Thermite is planning to use fxbot's agent core as its main harness, in place of Pi, OpenCode and Codex." "In one real hill-climb run on Thermite, 87% of the input tokens came from the cache. With no caching, the same work by key costs several times more, and thinking is lost as well."
- Asked: the Messages API with prompt caching, thinking and the effort a caller sets, tool calls and streaming; "cached tokens in what a turn reports"; and "the same look at the other providers' caching", with "a short table in the docs".
- Done when: "A bot on Claude by key shows cache reads on its second and later model calls of a turn", "Thinking shows in the reply's steps for a model that thinks", and "The provider list's note on Anthropic no longer warns about caching and thinking."
- Not part of it: "A sign-in with a Claude plan."

On the gap and the options: "yeah do that your recommendation". That was AI Gateway now, then a translator in fxbot, small asks of libfx, and the table, as one phase.

On the plan: "its not something for v0.10.0 that we build right now we just want it documented atm, and for us to revisit libfx to see if it gets fixed in the future."

## 0. Core or plugin

Core. A model is "what every bot needs" ([Core or plugin](../../CONVENTIONS.md#core-or-plugin)), and each provider's way in is the SDK's (`packages/sdk/src/providers.ts`), as ChatGPT's and OpenCode's are. Nothing changes in the plugin API, the server, or the page. The catalog entry says which protocol a provider speaks, so the translator is chosen by data, as each entry's headers are.

## 1. Research

### fxbot today

- **Four routes into libfx** (`providers.ts`, `options()`): ChatGPT goes to libfx's Codex route, Grok to its Grok route, Vercel and an AI Gateway key to its gateway route, and every other provider to its custom route, which speaks OpenAI Chat Completions. fxbot can wrap a custom provider's `fetch`, and does for an entry's own headers (`entryFetch`) and for OpenCode's session header (`opencodeFetch`, which smuggles libfx's session id through `credentials()` into the request).
- **Anthropic is a custom provider:** `https://api.anthropic.com/v1/chat/completions`, Anthropic's OpenAI-compatible API, with `x-api-key` added. Anthropic calls it "not considered a long-term or production-ready solution", with no prompt caching, and no thinking in the answer.
- **No reasoning effort.** fxbot never passes one to libfx. libfx takes one only as `model: { id, effort }`, checked against its catalog, and a custom provider's models can't say they take one (`custom-provider.js` knows `contextWindow`, `maxOutputTokens`, `supportsToolUse`, and `supportsVision`).
- **Usage reaches the stream but nobody reads it.** A turn's `turn_end` carries libfx's `FxUsage` (`inputTokens`, `outputTokens`, `cacheReadTokens`, `cacheWriteTokens`, `reasoningTokens`), and fxbot passes it through. Reasoning already shows: `reasoning_delta` lines become the reply's reasoning parts (`client.ts`).
- **The prompt prefix is mostly stable.** A session's instructions are the bot's own, then its memories, its skills' catalog, and plugins' lines (`index.ts`, `open()`). Plugins' lines change only when a room, a role, or a setting does. Memories and skills change the system prompt when one is saved, which a bot can do mid-chat, and dreams does each night.

### libfx (0.0.16, the newest release; source at `8352e0c`)

- **A custom provider speaks one protocol,** `"openai-chat-completions"` (`custom-provider.js`). There's no route for the Messages API in a release yet. Its open pull requests would add one ([below](#libfx-upstream)).
- **Its Chat Completions route** (`src/gateway/chat_completions_protocol.zig`):
  - **No cache breakpoints, and no effort.** The body is model, messages, tools, `tool_choice`, `parallel_tool_calls`, and `max_tokens` when the model's limit is known, with `stream_options.include_usage`.
  - **Usage is `prompt_tokens` and `completion_tokens` only** (`accept_usage`). `prompt_tokens_details.cached_tokens` isn't read, so `cacheReadTokens` is never set for any custom provider.
  - **It keeps reasoning.** `reasoning`, `reasoning_content`, and `reasoning_details` in the stream are saved as the session's provider replay, signatures included (its tests use `"format":"anthropic-claude-v1"`), and sent back on the assistant message of the next call to the same provider and model.
- **Its gateway route already does what #18 asks, for AI Gateway** (`vercel_protocol.zig`, `client.zig`): cache breakpoints in each provider's own syntax (Anthropic's `cacheControl: ephemeral`, OpenAI's `promptCacheBreakpoint`, Bedrock's `cachePoint`), the effort when given, and cache reads back into usage.
- **Its compactor keeps the newest turns word for word** (`src/core/compactor`: "the newest turns stay unchanged"), and folds the older ones into a checkpoint.

### Anthropic's Messages API

From the Claude API reference, for the current models: Claude Opus 5.5, Sonnet 5.5, Haiku 5.5, and Fable 5.1.
- **Caching is a prefix match.** The order is tools, then system, then messages. Changing a byte invalidates everything after it.
  - **Up to 4 breakpoints,** each `cache_control: {type: "ephemeral"}`. The default TTL is 5 minutes, refreshed free by each read, or `ttl: "1h"` at twice the write price.
  - **A breakpoint on the last system block caches the tools and system together.** A top-level `cache_control` moves an automatic breakpoint to the last block as the conversation grows. "The robust combination for agent loops" is both.
  - **The minimum prefix is 512 tokens** on the current models. Each breakpoint looks back at most 20 positions.
  - **Reads cost about a tenth** (0.05× on Opus 5.5, 0.025× on Fable 5.1). A 5-minute write costs 1.25×.
  - **Usage** gives `input_tokens` (the uncached rest only), `cache_read_input_tokens`, and `cache_creation_input_tokens`.
- **Thinking is adaptive,** and effort is `output_config.effort`: `low`, `medium`, `high`, `xhigh`, or `max`.
  - **Opus 5.5 and Fable 5.1 always think.** `{type: "disabled"}` and `budget_tokens` are 400s. Opus 5.5's default effort is `medium`.
  - **Sonnet 5.5 defaults to `high`.** It turns thinking off only with `{type: "between_tools"}`.
  - **Haiku 5.5 defaults to `medium`.**
  - **Older models,** Haiku 4.5 and the 4.5 family, still take `budget_tokens`.
  - **`display` defaults to `"omitted"`,** which streams thinking blocks with empty text. `"summarized"` returns a readable summary.
  - **Changing thinking or effort mid-chat** invalidates the messages cache.
- **Preserved thinking.** A thinking block's signature binds it to its model and to the conversation before it: the system prompt, the set of tools, and every earlier message.
  - **Rebuilding the system prompt, or keeping the newest turns after a compaction,** invalidates every later block.
  - **On accounts made on or after 2026-08-31,** Opus 5.5 and Fable 5.1 reject such a request with a 400. With the beta header `thinking-binding-controls-2026-08-01` and `thinking.block_binding.prefix_mismatch_behavior: "drop_block"`, the API drops those blocks instead, and lists each one in `input_transformations`.
  - **Pass blocks back unchanged.** Stripping them yourself can cause 400s.
- **The stream** is server-sent events:
  - `message_start` carries the input usage.
  - `content_block_start` opens a text, `tool_use`, `thinking`, or `redacted_thinking` block.
  - `content_block_delta` carries `text_delta`, `input_json_delta`, `thinking_delta`, or `signature_delta`.
  - Then `content_block_stop`, then `message_delta` with the `stop_reason` and the output usage, then `message_stop`. `ping` and `error` events can come in between.
- **Requests:**
  - `max_tokens` is required. The current models allow up to 128K, streamed.
  - Forced `tool_choice` (`any` or `tool`) is a 400 on Opus 5.5, Sonnet 5.5, and Fable 5.1.
  - Assistant prefill is a 400 on the current models.
  - Tool results go in a user message as `tool_result` blocks, all of one turn's in one message.
  - Images are `image` blocks, from base64 or a URL.
- **Refusals:** `stop_reason: "refusal"`, with `stop_details`. The reference advises opting into server-side fallbacks (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`) on Opus 5.5 and Sonnet 5.5.
- **The official TypeScript SDK** (`@anthropic-ai/sdk`) is how the reference says to call it: typed events and errors, its own `fetch` option, and `maxRetries`.

### Other harnesses

Read from their source on 2026-11-11: Pi at `d78a75ec` (`packages/ai/src/api/anthropic-messages.ts`), Hermes Agent at `e7212db2` (`agent/prompt_caching.py` and its neighbors), OpenClaw at `56eb6f3f` (`packages/ai/src/transports/anthropic-messages.ts`), and the AI SDK's Anthropic provider at `11323f98`.

| | Breakpoints | TTL | Thinking | Thinking replay |
| --- | --- | --- | --- | --- |
| **Pi** | The system prompt, the last tool, and the last block of the final message when it's a user or system message: 3 | 5 minutes, or an hour when asked | Adaptive, `display: "summarized"`, effort in `output_config`. On the 5.5 models, `block_binding: drop_block`, and each turn's effort in an empty mid-conversation system message, so the top-level effort stays fixed for the cache | Signed `thinking` and `redacted_thinking` go back as they came. Unsigned thinking, from an aborted stream, becomes text, and another model's thinking is dropped. |
| **Hermes Agent** | Direct to Anthropic: the static system prefix, the last tool, and the ends of the last 2 completed turns. Elsewhere, "system and 3" | 5 minutes. `auto` picks an hour for a session a person types into | Adaptive, `display: "summarized"`, effort. `budget_tokens` on older models | Kept through the tool loop in progress, and on every turn where the model keeps earlier thinking. After a signature 400 it remembers the rejected signatures and leaves them out. |
| **OpenClaw** | The system prompt, split into a stable prefix and the rest, the last tool, and up to 2 recent user messages, "to keep a prior write reachable beyond the 20-block lookback" | 5 minutes | Adaptive with effort. `budget_tokens` on older models | All thinking goes back when thinking is on. Unsigned thinking becomes text. |
| **AI SDK** | None by itself: the caller marks blocks, and a request-level option becomes the top-level `cache_control` | The caller's | `reasoning` maps to adaptive with `display: "summarized"` and effort | The signature rides in the reasoning part's metadata, and goes back as `thinking` or `redacted_thinking`. |

All four report cache reads and writes apart from other input, from `cache_read_input_tokens` and `cache_creation_input_tokens`. Pi also counts the hour-long writes on their own.

### libfx upstream

From libfx's issues and pull requests on 2026-11-11, read from their descriptions:
- **[#1043](https://github.com/vercel-labs/fx/pull/1043), open since 2026-09-24:** "Report prompt cache reads from Chat Completions providers". It's 78 lines in the reducer, with tests. It reads `prompt_tokens_details.cached_tokens`, and DeepSeek's `prompt_cache_hit_tokens`. It's the change [Cache hits in a turn's usage](#cache-hits-in-a-turns-usage) needs, already written.
- **[#1803](https://github.com/vercel-labs/fx/pull/1803), a draft since 2026-11-09:** "Add effort levels, request fields, headers, and two protocols to custom connections". It covers `anthropic-messages` and `openai-responses`, a custom model's `reasoning_efforts`, and cached and reasoning tokens. It's 9,450 lines over 114 files, for fx's settings. Whether libfx's `customProviderDefinition`, which takes only `name`, `baseUrl`, and `models`, would expose it isn't said.
- **[#1176](https://github.com/vercel-labs/fx/pull/1176), open since 2026-10-06:** an `anthropic-messages` protocol for configured providers, with signed thinking bound to its tool calls.
- **[#1577](https://github.com/vercel-labs/fx/pull/1577), open:** a custom connection asks for prompt caching with a `cache_control` field. On OpenRouter it measured 18,691 of 18,694 tokens cached with it, and none without.
- **Merged since 0.0.16, so not in the release fxbot runs:** [#1799](https://github.com/vercel-labs/fx/pull/1799), "Send earlier turns unchanged on later requests", which fixes a thinking-signature 400 on Fable 5.1 and later, and [#1575](https://github.com/vercel-labs/fx/pull/1575), which keeps Claude's cache warm through AI Gateway while a session waits.

### Other providers' caching

From each provider's own docs, fetched 2026-11-11. Most cache by themselves. What fxbot can do is keep the prefix stable, send a cache key or a session id where one helps, mark Claude where a router needs it, and read the counts back.

| Provider | Caches by itself? | What helps | A hit in `usage` |
| --- | --- | --- | --- |
| OpenAI | Yes. GPT-5.6 and later: 30 minutes, 1,024 tokens at least | `prompt_cache_key` before GPT-5.6 | `prompt_tokens_details.cached_tokens`, and `cache_write_tokens` |
| Gemini | Yes, implicitly on 2.5 and later (2,048 or 4,096 tokens at least) | Nothing | Not documented for the OpenAI-compatible API |
| xAI | Yes | `x-grok-conv-id`, one per conversation | `prompt_tokens_details.cached_tokens` |
| DeepSeek | Yes, for hours to days | Nothing | `prompt_cache_hit_tokens`, top level |
| OpenRouter | As the provider behind it does, with sticky routing | `session_id` or `x-session-id`. Claude and Qwen need `cache_control`, top level or on content parts | `prompt_tokens_details.cached_tokens`, and `cache_write_tokens` |
| Groq | Yes, for 2 hours, on a few models | Nothing | `prompt_tokens_details.cached_tokens` |
| Mistral | Docs don't say it does without a key | `prompt_cache_key` | `prompt_tokens_details.cached_tokens` |
| Together, Cerebras, DeepInfra | Yes | `prompt_cache_key` | `prompt_tokens_details.cached_tokens` (Together sometimes `usage.cached_tokens`) |
| Fireworks | Yes | `user` or `x-session-affinity` | `prompt_tokens_details.cached_tokens` |
| Kimi, MiniMax, Z.ai, Qwen | Yes (Qwen also takes `cache_control`) | Nothing | `prompt_tokens_details.cached_tokens` |
| NVIDIA, Hugging Face | Docs don't say | | |
| Ollama, llama.cpp, vLLM, LM Studio | Yes, on the machine, as a prefix cache | Nothing | `prompt_tokens_details.cached_tokens` (vLLM only with a flag; LM Studio not on Chat Completions) |

Sources: [OpenAI](https://developers.openai.com/api/docs/guides/prompt-caching), [Gemini](https://aistudio.google.com/docs/caching), [xAI](https://docs.x.ai/developers/advanced-api-usage/prompt-caching), [DeepSeek](https://api-docs.deepseek.com/guides/kv_cache), [OpenRouter](https://openrouter.ai/docs/guides/best-practices/prompt-caching), [Groq](https://console.groq.com/docs/prompt-caching), [Mistral](https://docs.mistral.ai/studio/conversations/advanced/prompt-caching), [Together](https://docs.together.ai/docs/inference/chat/prompt-caching), [Fireworks](https://docs.fireworks.ai/guides/prompt-caching), [DeepInfra](https://docs.deepinfra.com/chat/prompt-caching), [Cerebras](https://inference-docs.cerebras.ai/capabilities/prompt-caching), [Kimi](https://platform.kimi.ai/docs/guide/context-caching), [Qwen](https://www.alibabacloud.com/help/en/model-studio/context-cache), [Z.ai](https://docs.z.ai/guides/capabilities/cache), [MiniMax](https://platform.minimax.io/docs/api-reference/text-prompt-caching), [Vercel](https://vercel.com/docs/ai-gateway/models-and-providers/automatic-caching), [llama.cpp](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md), and [vLLM](https://docs.vllm.ai/en/latest/design/prefix_caching/).

Two things this means for fxbot:
- **No custom provider's cache hits reach a turn's usage today,** since libfx reads only `prompt_tokens` and `completion_tokens`. The providers mostly cache already. What's missing is the count.
- **Each conversation is a libfx session,** so its id is the natural cache key or session id, sent the way each provider wants it. fxbot already does this for OpenCode, whose `x-opencode-session` header routes a conversation.

## 2. Key takeaways

1. **The stopgap's route is the shape to copy.** libfx's gateway route marks Claude for caching, sends the effort, and reads cache hits back, by its source. Nobody has run it here with a real key. The custom route does none of that, so a translator in fxbot has to do the first two itself, and the third needs libfx.
2. **A translator in fxbot is enough for caching and thinking.** libfx sends Chat Completions to a `fetch` fxbot gives it. fxbot can rewrite that into a Messages call and stream the answer back as Chat Completions. libfx already keeps `reasoning_details` with their signatures and sends them back, so thinking crosses calls, and restarts, without loss.
3. **Cache hits in a turn's usage need libfx.** Its Chat Completions route never reads `cached_tokens`, for any provider. One small change there fixes it for Claude through the translator and for every other provider at once. Until it ships, fxbot can count them itself.
4. **Preserved thinking makes `drop_block` a must.** A memory saved mid-chat rebuilds the system prompt, and libfx's compactor keeps the newest turns. Both invalidate earlier thinking. Opus 5.5 and Fable 5.1 reject that with a 400 on accounts made after 2026-08-31, which includes any new owner. With `drop_block`, Claude answers without that reasoning, and fxbot says so in its log.
5. **Effort belongs to the bot.** Changing it mid-chat costs the cache, so it's a setting that stays put. libfx won't take one for a custom provider, but fxbot can carry it to the translator, as it carries OpenCode's session. It also goes to libfx where libfx takes one, such as AI Gateway, ChatGPT, and Grok.
6. **Two breakpoints do it.** One goes on the last system block, which caches the tools and the system prompt. A top-level `cache_control` moves with the conversation. That's Anthropic's own advice for agent loops, and it leaves two of the four free.
7. **Show the thinking.** On the current models the default `display` streams empty thinking. `"summarized"` is what makes it show in the reply's steps, as #18 asks.
8. **libfx is heading the same way, slowly.** A Messages protocol and cache counts are both open pull requests, one for seven weeks. fxbot's translator is a bridge: when a libfx release lets a custom provider name `anthropic-messages`, the catalog's `protocol` goes to libfx and the translator goes away. The cache counts are already written as #1043. What fxbot asks of libfx is to merge it, not to write it again.
9. **The harnesses agree on the shape:** adaptive thinking with `display: "summarized"`, 5-minute caches, signed thinking sent back as it came, and reads and writes counted apart. They differ in where the breakpoints go. Pi, Hermes, and OpenClaw all mark the last tool and one or two recent messages. fxbot follows Anthropic's own pairing, the system block plus the moving top-level one, and adds a breakpoint on the previous user message if the checks show the lookback missing.
10. **The other providers mostly need nothing, and a few need a key.** A session id or `prompt_cache_key` from the catalog keeps a conversation on its cache: xAI, OpenRouter, Fireworks, Mistral, Together, Cerebras, DeepInfra, and OpenAI. OpenRouter's Claude needs `cache_control`.

## 3. Implementation

### Where it goes

- **The catalog** (`providers-registry.json`): Anthropic's entry gets `"protocol": "anthropic-messages"`. Its `about` changes to "Claude models, through Anthropic's own Messages API", and its `note` goes. An entry may also get `"session"`, naming where the conversation's id goes (a header, or a body field such as `prompt_cache_key`), and `"cacheControl"`, the model prefixes that need a top-level `cache_control`.
- **`packages/sdk/src/anthropic.ts`,** new: `messagesFetch(fetch, key, sessionOf)`. It's the `fetch` libfx calls with a Chat Completions request. It calls Anthropic with `@anthropic-ai/sdk`, built with fxbot's `fetch` and `maxRetries: 0`, since libfx retries a provider itself. It answers with a `Response` whose body streams Chat Completions chunks.
- **`providers.ts`:** an entry with that protocol gets `messagesFetch` in place of `entryFetch`. Its key carries libfx's session id, as OpenCode's does (`credentials({ sessionId })`), so the translator knows the conversation, and through it the bot and its effort. `opencodeFetch` becomes the general case: `entryFetch` puts the session id where an entry's `session` says, OpenCode's header included.
- **A new dependency:** `@anthropic-ai/sdk` in `@fxbot/sdk`, pinned to a release at least two weeks old.
- **libfx, when a release has [#1799](https://github.com/vercel-labs/fx/pull/1799):** fxbot moves to it. That's the signature 400 on Fable 5.1 and later, which `drop_block` only softens until then.

### Request: Chat Completions to Messages

| Chat Completions, from libfx | Messages |
| --- | --- |
| `system` messages, the instructions first | `system`, as text blocks. The last one gets `cache_control: {type: "ephemeral"}`, which caches the tools with it. |
| A `user` message's text and `image_url` parts | A `user` message: `text` blocks, and `image` blocks, from base64 for a `data:` URL or by URL otherwise |
| An `assistant` message's `reasoning_details`, `content`, and `tool_calls` | An `assistant` message, in order: `thinking` (`text` and `signature`) and `redacted_thinking` (`data`) from `reasoning_details`, then `text`, then `tool_use` (`id`, `name`, and the parsed `arguments` as `input`) |
| A run of `tool` messages | One `user` message of `tool_result` blocks, by `tool_call_id` |
| `tools` | `tools`: `name`, `description`, and `parameters` as `input_schema`, with `eager_input_streaming: true` |
| `tool_choice` | `auto` and `none` as they are. `required` is `any`, except on models where forcing a tool is a 400 (Opus 5.5, Sonnet 5.5, Fable 5.1), where it's `auto` |
| `parallel_tool_calls: false` | `disable_parallel_tool_use: true` |
| `max_tokens` | `max_tokens`, or the model's output limit from fxbot's models.dev data, or 64,000 when that's unknown. The Messages API requires it. |
| `temperature`, `top_p` | Left out: the current models refuse them. |
| (none) | `cache_control: {type: "ephemeral"}` at the top, for the conversation's tail |
| (none) | `thinking: {type: "adaptive", display: "summarized", block_binding: {prefix_mismatch_behavior: "drop_block"}}` on models that think adaptively, with beta `thinking-binding-controls-2026-08-01`. Older models (Haiku 4.5 and before) run without thinking, as now. |
| (none) | `output_config.effort`: the bot's effort, when it has one. Left out, the model's own default holds. |

### Response: Messages to Chat Completions

| Messages event | Chat Completions chunk |
| --- | --- |
| `message_start` | A first chunk with `role: "assistant"`. Its input usage is kept for the end. |
| `text_delta` | `delta.content` |
| `thinking_delta`, `signature_delta` | `delta.reasoning_details`, as `{type: "reasoning.text", text, signature, format: "anthropic-claude-v1", index}`, and the text again as `delta.reasoning`, which libfx shows as reasoning |
| A `redacted_thinking` block | `delta.reasoning_details`, as `{type: "reasoning.encrypted", data, format, index}` |
| A `tool_use` block, then `input_json_delta` | `delta.tool_calls`, with `id` and `name` first, then `function.arguments` as it streams |
| `message_delta` | `finish_reason`: `end_turn` is `stop`, `tool_use` is `tool_calls`, `max_tokens` is `length`, and `refusal` is `content_filter` |
| The end | A usage chunk. `prompt_tokens` is `input_tokens + cache_read_input_tokens + cache_creation_input_tokens`. `completion_tokens` is `output_tokens`. `prompt_tokens_details` carries `cached_tokens` (the reads) and `cache_write_tokens` (the writes). Then `[DONE]`. |
| `input_transformations` with dropped thinking | A line in fxbot's log, such as "Claude answered without its earlier thinking, since the chat changed before it." |
| An error before the stream | The same status, with Anthropic's message in the body, so fxbot's errors for a bad key, a 429, or a 529 read as they do now |
| An `error` event in the stream | An error chunk, and the stream ends |

**Stop** aborts libfx's request, and the translator aborts Anthropic's with the same signal.

To settle in the build: whether libfx joins a `reasoning_details` entry's pieces by `index`, its signature included, as its continuation test suggests. If it doesn't, the translator holds each thinking block until its `content_block_stop`, and sends it whole, with its signature.

### Cache hits in a turn's usage

- **Upstream, in libfx:** [#1043](https://github.com/vercel-labs/fx/pull/1043) already reads `prompt_tokens_details.cached_tokens` and DeepSeek's `prompt_cache_hit_tokens` on the Chat Completions route. The owner asks for it to be merged, adding writes from `prompt_tokens_details.cache_write_tokens`, and asks that libfx's `customProviderDefinition` take a `protocol` and a model's efforts once [#1803](https://github.com/vercel-labs/fx/pull/1803) lands. This shell can't post to GitHub, so the plan hands the owner the comments to post.
- **Until a libfx release has it:** the translator counts each call's cache reads and writes by session. fxbot adds them to that turn's `turn_end` usage when libfx's are absent. The same counts become libfx's own once it reads them.

### A bot's effort

The [reasoning](../_completed/phases/reasoning.md) plan (2026-11-12) owns this now: **Thinking** on each bot, stored in `profiles.effort`, with only the levels its model offers. When this plan is built, the translator reads the bot's level from there, and sends it as `output_config.effort`.

### Other providers

- **A session id where it helps,** from each entry's `session`:
  - as `x-grok-conv-id` for xAI, `x-session-id` for OpenRouter, and `x-session-affinity` for Fireworks
  - as `prompt_cache_key` for OpenAI, Mistral, Together, Cerebras, and DeepInfra
  - and as `x-opencode-session` for OpenCode, as now
- **OpenRouter's Claude and Qwen models** get a top-level `cache_control: {type: "ephemeral"}`, from the entry's `cacheControl`.
- **Nothing for the rest,** which cache by themselves.

### Docs

- **`reference/providers.md`** gets a **Prompt caching** section: the table from the research, what fxbot sends to each provider, and where a hit shows.
- **`providers/anthropic.md`**: its own Messages API, caching, thinking and effort, and what a dropped thinking block means. The quirks about the OpenAI-compatible API go.
- **The bot's Thinking setting** is the [reasoning](../_completed/phases/reasoning.md) plan's docs. This plan adds what it does on Claude.
- **`providers/vercel.md`** keeps its BYOK section, as one way among two.

### Not in this phase

- **Claude through Vertex AI, Bedrock, or Azure.** Each has a Messages endpoint of its own, and the translator could serve them later.
- **Anthropic's server-side compaction and context editing.** libfx compacts by itself.
- **The 1-hour TTL, and keep-alive pings** between an owner's messages.
- **Fast mode, batches, and a Claude plan sign-in,** which Anthropic doesn't allow.

### Size

| Where | Lines, about |
| --- | --- |
| `anthropic.ts`: the translator, both ways | 350 |
| `providers.ts` and the catalog fields | 50 |
| A bot's effort: the translator reads it ([reasoning](../_completed/phases/reasoning.md) builds the setting) | 10 |
| Counting cache hits until libfx does | 40 |
| Docs | 150 |
| libfx, upstream: comments on #1043 and #1803, for the owner to post | none here |

## 4. Checklist

The translator, against a mock Anthropic server that records each request and streams scripted events, under a disposable fxbot:
- [ ] A turn with a tool call and an answer makes two calls. Each has `cache_control` on the last system block and at the top. The second call's tools, system, and messages repeat the first's byte for byte, before what the turn added.
- [ ] Tools, a `tool_result` for each call in one user message, an image from a `data:` URL, `max_tokens`, and `tool_choice` read as the tables say.
- [ ] Thinking streamed with a signature shows in the reply's steps. The next call carries the same `thinking` block, signature and all, before its `tool_use`. A `redacted_thinking` block goes back unchanged too.
- [ ] Every call sends the `thinking-binding-controls-2026-08-01` beta and `drop_block`. A scripted `input_transformations` entry puts its line in fxbot's log.
- [ ] A bot with an effort sends it as `output_config.effort`. A bot without one sends none.
- [ ] Each finish reason maps as the table says. A refusal ends the turn with fxbot's message for it.
- [ ] A 401, a 429, and a 529 reach fxbot's existing handling with their status. An error mid-stream ends the turn with its message.
- [ ] **Stop** aborts the call to Anthropic.
- [ ] The usage chunk carries the reads and writes, and the turn's `turn_end` usage shows `cacheReadTokens` and `cacheWriteTokens`: fxbot's count, or libfx's once it reads them.

The rest:
- [ ] A bot's **Thinking** level, from the [reasoning](../_completed/phases/reasoning.md) plan, reaches the translator as `output_config.effort`.
- [ ] xAI, OpenRouter, Fireworks, and a `prompt_cache_key` provider get the session id where their entry says, against a mock. OpenRouter's Claude gets `cache_control`.
- [ ] The comments for libfx are written up for the owner to post: merge #1043 with cache writes, and a `protocol` and efforts on `customProviderDefinition` with #1803.
- [ ] Docs as above, `npm run typecheck`, `npm run build`, `npm run build-site`, and `git diff --check`.

Only a person can check, with a real key:
- [ ] A bot on Claude by key shows cache reads on the second and later calls of a turn, and on the next turn.
- [ ] A bot on a thinking model shows its thinking in the reply's steps.
- [ ] A memory saved mid-chat, then a next turn, goes on without an error, and the log says the thinking was dropped.

## 5. Open questions

1. **Build the translator now, or wait for libfx?** Answered on 2026-11-12: wait, and check libfx again ([When to revisit](#when-to-revisit)). The rest stay open until then.
2. **Refusal fallbacks.** When Claude declines a request, Anthropic can run it again on another Claude model at that model's prices: `fallbacks: "default"`, which the Claude API reference advises turning on by default for Opus 5.5 and Sonnet 5.5. Turn it on, or let a refusal end the turn as now? Recommended: on, with a line in the log when it happens.
3. **Cache counts before libfx reads them.** Fill a turn's usage from fxbot's own count until a libfx release does it? Recommended: yes, so #18's first "done when" holds without waiting.
4. **The cache's TTL.** Five minutes is the default, and each read renews it. An owner who replies after 20 minutes pays a fresh write. An hour costs twice as much to write. Recommended: five minutes, as Pi, Hermes, and OpenClaw default to. Agent loops, like Thermite's, keep it warm. Hermes's `auto` is a third choice: an hour for a bot's own chat, where a person types, and five minutes for routines and subagents.
5. **Effort for the SDK:** per bot only, as planned, or also per message? Recommended: per bot. Changing effort mid-chat costs the cache.

## When to revisit

Check libfx's releases after 0.0.16 (`npm view libfx versions`, its [changelog](https://github.com/vercel-labs/fx/blob/main/CHANGELOG.md), and the pull requests above). What each one would change here:

| If a libfx release has... | Then fxbot... |
| --- | --- |
| A custom provider that takes `protocol: "anthropic-messages"` in `customProviderDefinition` ([#1803](https://github.com/vercel-labs/fx/pull/1803), [#1176](https://github.com/vercel-labs/fx/pull/1176)) | needs no translator. Anthropic's catalog entry names the protocol and fxbot passes it to libfx. Check that libfx sends cache breakpoints and adaptive thinking on it, as its gateway route does. If it doesn't, the request half of the translator is still needed. |
| Cache reads from Chat Completions' `usage` ([#1043](https://github.com/vercel-labs/fx/pull/1043)) | gets cache counts for every custom provider, with no counting of its own. |
| Efforts for a custom model ([#1803](https://github.com/vercel-labs/fx/pull/1803), merged into fx's `main` on 2026-11-12, not yet in a release) | passes a bot's effort to libfx on every route, with no session trick, as the [reasoning](../_completed/phases/reasoning.md) plan does. |
| [#1799](https://github.com/vercel-labs/fx/pull/1799), earlier turns sent unchanged | moves to it, for the thinking-signature 400 on Fable 5.1 and later through AI Gateway. |
| None of these, and Claude by key still matters | builds this plan as written, or asks the owner whether AI Gateway is enough. |

Whatever libfx does, two parts of the plan stand on their own and could come first: each provider's cache key or session id, and the docs' caching table. Neither waits on libfx.
