# Providers v2

Adding a provider becomes one page that walks the owner through it, in Settings and in first-run setup:
- **Sign in with nothing to paste.** One button each, for:
  - **Vercel, ChatGPT and Codex, and Grok,** by device code, as today. Vercel was to work out of the box with fxbot's own app, but Vercel doesn't let it use a device code yet, so its sign-in is off unless a server names an app of its own (**Built**, below).
  - **OpenRouter,** by a redirect back to fxbot's own page.
  - **Hugging Face and OrcaRouter,** by device code.

  Each gives fxbot a key or a token it keeps sealed, and the owner copies nothing.
- **A key, walked through.** Each popular gateway and lab has a card:
  - a link straight to the page where its keys are made
  - what to pick there, and what it costs to start
  - a field for the key, checked for real, then a model to pick
- **Clouds with their own sign-in:**
  - **Vertex AI:** a service-account file, from which fxbot makes its own short-lived tokens.
  - **Bedrock:** an API key and a region.
  - **Azure:** a resource, a key, and its deployments.
  - **Cloudflare:** a token and an account.
- **Your own machine,** and **Custom:**
  - **Local servers:** Ollama, LM Studio, llama.cpp, vLLM, Jan, and LiteLLM, each with its usual address filled in.
  - **Search all providers:** about 190 more from models.dev.
  - **Custom:** any server that speaks OpenAI's Chat Completions.
- **Every provider's models, with what they can do.** The list comes from the provider itself, with models.dev's context window, tool use, and vision attached.
- **The list of providers is data:** `providers-registry.json`, shipped with each release and refreshed from fxbot.sh hourly, as the plugin list is. A new gateway, or a key page that moved, needs no release.
- **First-run setup leads with it.** Its provider step is the same page, sign-ins first.
- **The docs get a page for each popular provider:** how to sign in or make a key, the fields, free tiers, and quirks.
- **A fix comes first.** OpenRouter's model list is public, so the key check fxbot runs there today passes any key.

Status: built on 2026-11-09, for 0.8.0, and checked against stub providers: 69 checks of the SDK and 36 in a browser, all passing (section 4). Real accounts and keys are still to be tried by hand. Where the build differs from the plan, section 3 says so under **Built**. Planned and researched the same day:
- the research directive's references
- the logins of fx and libfx, and of other agent apps
- the docs, sign-in endpoints, and model lists of about 60 gateways, labs, clouds, and local servers
- models.dev

Checked with requests here: each host's model list, with no key and with a fake one; the sign-in endpoints that answer without an account; and models.dev's numbers. Nothing was tried with a real key or account. Where this plan says *likely*, it wasn't checked.

## What the owner asked

"the other phase to be don ein v0.8.0 is provider logins improvement."

"I want an "add provider" wizard ish thing thats better... I want to support login via Vercel, Grok, ChatGPT/Codex or a walk through on different popular gateway providers to generate keys and add them to fxbot (Gateway providers that support login via and auto generate keys to add and access via openai api should support that method) ... When adding a provider it should show buttons for Login via [Vercel, ChatGPT/Codex, Grok, Custom] and other login providers that fx supports like that."

"First time setup includes part of the setup experience to walk them through setting up a provider. We should include docs on using all the most popular gateways (for example but not limited to openrouter, nous research portal, orcarouter, cloudflare, vertexai, aws bedrock, etc...)."

"Plan this out in phases/providers-v2.md. This is a core bit and core server/ui bit."

## 0. Core or plugin

**Core, by the owner's call and by CONVENTIONS** ([Core or plugin](../../../CONVENTIONS.md#core-or-plugin)). A model is the first thing every bot needs, and providers have been core since [provider logins](provider-logins.md).

| Package | What it gets |
| --- | --- |
| `packages/sdk` | the catalog, the sign-ins, the key checks, the model lists, and the clouds' tokens |
| `packages/server` | the routes |
| `packages/ui` | the page |
| `packages/website` | the docs, and the catalog's copy that installs read |

Nothing here touches the plugin API.

## 1. Research

### fxbot today

Built in [provider logins](provider-logins.md) (0.2.0) and shown in first-run setup since [onboarding](onboarding.md) (0.7.0):

- **Eleven kinds,** one `kinds` table in the SDK that the page reads (`packages/sdk/src/types.ts:114-126`). Each is a label, a way to connect, and sometimes a base URL:
  - **Sign in by device code:** ChatGPT plan, Grok plan, Vercel account.
  - **Paste a key:** AI Gateway, OpenAI, OpenCode Zen, OpenCode Go, OpenRouter.
  - **Give a base URL:** Ollama, LM Studio, and Other server, which is any Chat Completions server.
- **Adding is one select,** **Add provider…**, grouped by how it connects (`packages/ui/src/providers.tsx:165-177`). It opens the sign-in dialog, with its link and code, or the key form.
- **The key form** asks for a name, a key, and, for a URL kind, a base URL and a context window. It doesn't say where to get a key.
- **Every sign-in is a device code,** run on the server as an attempt the page polls (`providers.ts:357-390`), because the page is often a phone over Tailscale, where a loopback redirect lands on the wrong machine.
- **Vercel needs `FXBOT_VERCEL_CLIENT_ID`,** an OAuth app the owner registers. A release install sets none, so **Vercel account** fails with "Set FXBOT_VERCEL_CLIENT_ID to sign in with a Vercel account" (`providers.ts:360`), and the docs send the owner to register one (`how-to/add-a-provider.md`).
- **Model lists come from one source per kind** (`packages/sdk/src/models.ts`): the plans' own lists, AI Gateway's, models.dev for the hosted key kinds (`catalogOf`, `models.ts:11`), and the local servers' probes. Other server reads only `/models`, with ids and no metadata.
- **A key is checked when it's added,** at its model list: 401 or 403 refuses it, 404 is kept.
- **First-run setup's provider step** is the same `Providers` component, as it is in Settings, and **Continue** waits for a provider with a default model (`packages/ui/src/onboarding.tsx:153-175`).
- **What's missing:** any gateway other than these. Groq, Together, Hugging Face, Mistral, Gemini, Bedrock, Vertex, Cloudflare, and the rest each go in as **Other server**, with a base URL the owner looks up, a key, and models that are ids alone, so fxbot knows no context window, tools, or vision for them.

### Logins in fx and libfx

**libfx 0.0.16 is still the newest** (`npm view libfx`: latest 0.0.16, 2026-10-29). **fx logs in to exactly three things,** in `src/core/auth/provider_catalog.zig` at its head (2026-11-08). Its auth commits since 0.0.16 are about refreshes and locks, not new logins.

| Login | fx | libfx | In fxbot today |
| --- | --- | --- | --- |
| Vercel account, then a team | `fx login vercel`, device code with fx's own client | no helper; an `apiKey`, or a Vercel token | device code, with an app the owner must register (`FXBOT_VERCEL_CLIENT_ID`) |
| ChatGPT plan (Codex): "ChatGPT Plus, Pro, Business, Enterprise, or Edu subscription" | `fx login codex`, a browser to localhost:1455 | `libfx/chatgpt`: device code, or a pasted localhost address | device code |
| Grok plan: "SuperGrok or X Premium subscription" | `fx login grok` | `libfx/grok`: device code ("the simplest"), or a pasted address | device code |
| AI Gateway key | `fx login vercel --api-key` | `apiKey` | key |
| Custom | `~/.fx/settings.json` | `{ name, baseUrl, models }`, Chat Completions only, https or loopback | base URL and key |

fx and libfx have nothing for Anthropic, Copilot, Gemini, or OpenRouter. Any other sign-in is fxbot's own: a custom provider, with the key or token fxbot gets, as Vercel's is today.

### Logins in other agent apps

| App | Its sign-ins | Worth noting |
| --- | --- | --- |
| eve (1.0.0-rc.6) | Vercel account, by device code; ChatGPT, by browser, or device code under SSH | Its error copy: "Enable device code authorization in ChatGPT Settings > Security". |
| Pi (1.5.0) | Claude Pro/Max; "Sign in with ChatGPT"; Codex (now "legacy"); GitHub Copilot; **OpenRouter, by PKCE with a loopback or a pasted code**; Kimi Code; Meta Muse; xAI; its own Radius | Removed Gemini CLI and Antigravity on 2026-04-30. Warns on Anthropic: "Third-party harness usage draws from extra usage and is billed per token". |
| opencode (v2.2.5) | Sign in with ChatGPT; Codex ("legacy"); GitHub Copilot, by device code; xAI's SuperGrok, by device code; its own console; GitLab, DigitalOcean, Poe, Snowflake | Copilot is official for OpenCode alone (GitHub, 2026-01-16), and xAI endorsed it (2026-05-21). |
| Hermes Agent | **Nous Portal by device code, "recommended"**; ChatGPT/Codex; Anthropic, with a pasted code; xAI; Qwen and MiniMax by PKCE; **OpenRouter by PKCE, which stores a key** | Its setup imports logins from Claude Code, Codex, OpenClaw, or Cursor. |
| Codex CLI (0.167.0) | browser, `--device-auth`, `--with-api-key` | Onboarding adds Bedrock, Vertex, and a custom gateway. |
| Crush (v0.100.0) | Charm's own, Copilot, ChatGPT, and Grok | First run: "To start, let's choose a provider and model." |
| Goose (1.58.0) | ChatGPT, Copilot, xAI, Kimi, Muse; **Hugging Face by OAuth** | It also wraps other CLIs. |
| Aider | **OpenRouter by PKCE** on localhost, offered when no key is set | |
| Cline, Kilo Code | **OpenRouter's** key by its sign-in (Cline); Kilo's own account by device code with a QR; ChatGPT; Copilot | |
| Cherry Studio (v2.1.10) | logins that make a key for SiliconFlow, 302.AI, AiHubMix, AIOnly, PPIO, and TokenDance; ChatGPT; Grok; Copilot | 67 presets. |
| openbot | OpenAI plan; Anthropic plan; Gemini's API through its own registered client; xAI; Unbiased AI, which makes a key (2026-11-08); "Any OpenAI-compatible endpoint" | |
| Zed | ChatGPT, SuperGrok, Copilot, its own account | Groups: Zed-hosted, API Access, Existing Subscription, Gateway, Local Model. |
| Continue, LibreChat, Open WebUI, Jan, LM Studio, TypingMind, Msty | keys and addresses only | |

**What the plans allow in other apps, in 2026:**
- **Anthropic: forbidden.** "Anthropic does not permit third-party developers to offer Claude.ai login into their own applications" ([legal](https://code.claude.com/docs/en/legal-and-compliance)). Only Claude Code itself may use it.
- **Google: forbidden.** "Directly accessing the services powering Gemini CLI… using third-party software… is a violation… may be grounds for suspension or termination" (gemini-cli's terms). The allowed way is the Gemini API, with an AI Studio key.
- **GitHub Copilot:** official for OpenCode only. The other apps use VS Code's client and an undocumented token exchange.
- **OpenAI: two ways.**
  - **libfx's Codex sign-in:** "the user's ChatGPT plan and OpenAI's terms apply".
  - **The new "Sign in with ChatGPT"** (developers.openai.com/siwc):
    - It registers each agent dynamically.
    - Its redirect must be `http://127.0.0.1:<port>/auth/callback`, with no device code.
    - It serves only the **Responses API**, which libfx's custom providers don't speak.
    - Pi and opencode now call the Codex sign-in "legacy".
- **xAI** endorses its device code for open-source agents ("More open-source agents and integrations are coming soon").

### Gateways that can sign in

A gateway that can sign the owner in and hand fxbot a key is the owner's "login via, and auto-generate keys". These were found, and each was checked with requests that need no account:

| Gateway | Flow | Needs an app registered? | What fxbot gets | Notes |
| --- | --- | --- | --- | --- |
| **OpenRouter** | PKCE: `https://openrouter.ai/auth?callback_url=…&code_challenge=…`, then `POST /api/v1/auth/keys` with the code and verifier ([docs](https://openrouter.ai/docs/use-cases/oauth-pkce)) | no | a normal `sk-or-v1-` key on the owner's account, which doesn't expire | Localhost callbacks work "on any port". Other callbacks just need to be a URL; the docs state no https rule. Leaving out `callback_url` shows a code to paste instead. Codes expire in 10 minutes. The exchange answered a fake code with 400 "Invalid code". |
| **Hugging Face** | Device code: `POST https://huggingface.co/oauth/device`, then `/oauth/token`, scope `inference-api` (checked in its OpenID configuration) | yes, once: a public app with no secret | an access token and a refresh token | It's for its router, `https://router.huggingface.co/v1`, whose public model list carries `context_length` and `supports_tools` for each provider behind a model. `pi-huggingface-oauth` (npm, Oct 2026) does exactly this. A fake client got "Client not found". |
| **OrcaRouter** | Device code: `POST https://www.orcarouter.ai/api/v1/auth/device/code`, then `/api/v1/auth/device/token`. Also PKCE, with a callback that must be https, or http on loopback ([docs](https://docs.orcarouter.ai/getting-started/sign-in-with-orcarouter.md)) | **no**: anonymous | a permanent `sk-orca-` key | 10 keys for each user a day, and the owner gets an email for each. Its discovery document names `http://` endpoints, so the address is fixed in code. A fake device code got `400 invalid_grant`. |
| **Nous Portal** | Device code at `portal.nousresearch.com/api/oauth/device/code`, scope `inference:invoke`, as Hermes Agent signs in (`hermes_cli/auth_nous.py`) | **only Hermes's own**: a fake client id got "Unsupported OAuth client_id" | — | Until Nous gives fxbot a client id, a Portal key, pasted. Its API is `https://inference-api.nousresearch.com/v1`, with a public model list in OpenRouter's shape. |
| NanoGPT | PKCE, no registration | no | `sk-nano-` key | in the long tail |
| Poe | OAuth, scope `apikey:create` | yes | `api_key` | in the long tail |
| Chutes | OIDC, scope `chutes:invoke`; hour-long tokens, with refresh | yes | a token | in the long tail |

**Two don't fit:**
- **Cloudflare's OAuth for other apps** (since 2026-06-03) is authorization code with PKCE only, to registered redirects, after verifying a domain. Its docs: "Cloudflare does not support … Device Authorization … for third-party clients." An fxbot on a tailnet has no address Cloudflare could register.
- **Google's device flow** allows only a few scopes (`openid`, `email`, Drive's and YouTube's), and not `cloud-platform`. So no sign-in reaches Vertex or the Gemini API.

**Three are off the list:**
- **GitHub Models** was retired on 2026-07-30: "The playground, model catalog, inference API, and BYOK are no longer available to any customer."
- **GitHub Copilot:** tools reach it with VS Code's own OAuth client id, an undocumented token exchange, and editor headers. GitHub's official route for other apps is its Copilot SDK, which isn't Chat Completions.
- **Claude plans:** "Anthropic does not permit third-party developers to offer Claude.ai login into their own applications, or to route requests through Free, Pro, Max, or Ultra plan credentials" ([legal](https://code.claude.com/docs/en/legal-and-compliance)), enforced since early 2026.

### Clouds with their own sign-in

| Cloud | Chat Completions at | What it takes | Models | Catch |
| --- | --- | --- | --- | --- |
| **Vertex AI** | `https://aiplatform.googleapis.com/v1/projects/{project}/locations/{location}/endpoints/openapi`, location `global` or a region | an OAuth access token, an hour long. API keys are refused: "API keys are not supported by this API. Expected OAuth2 access token" (checked) | no list there (404, checked); models.dev's `google-vertex`, whose ids need a `google/` prefix | fxbot makes the token from a service-account JSON: an RS256 JWT, signed with Node's `crypto`, traded at `https://oauth2.googleapis.com/token` ([Google](https://developers.google.com/identity/protocols/oauth2/service-account)). Claude isn't on this endpoint. |
| **Gemini API** | `https://generativelanguage.googleapis.com/v1beta/openai` | an AI Studio key (`AQ.` since 2026), as a bearer | `/models`, with a key | Gemini 3 and newer fail a multi-turn tool call unless the client returns each call's thought signature. A bad key gets 400, not 401. |
| **Bedrock** | `https://bedrock-runtime.{region}.amazonaws.com/openai/v1`; the newer `https://bedrock-mantle.{region}.api.aws/v1` has the model list | a Bedrock API key as a bearer: long-term from the console ("for exploration only"), or short-term, up to 12 hours, minted with SigV4 | `GET /v1/models` on mantle, with a key | **Claude doesn't support Chat Completions on Bedrock**: Messages, Converse, and Invoke only. OpenAI's, Qwen, DeepSeek, Mistral, Kimi, GLM, and others do. Some need inference-profile ids, such as `us.…`. |
| **Azure OpenAI and Foundry** | `https://{resource}.openai.azure.com/openai/v1/` | a key: `api-key`, or a bearer as the OpenAI SDK sends it (*likely*); or an Entra token | the deployments | `model` is the deployment's name. The v1 API needs no `api-version`, which suits libfx's rule of no query. |
| **Cloudflare** (Workers AI, and AI Gateway's models through it) | `https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1` | an API token with Workers AI Read, and the account id | no `/v1/models` (405, checked); models.dev's `cloudflare-workers-ai` and `cloudflare-ai-gateway` | Third-party models need Unified Billing credits. The older `…/compat` endpoint is deprecated. |
| **Anthropic** | `https://api.anthropic.com/v1/` | a Console key, a bearer (checked: an OpenAI-shaped 401) | `/v1/models` | Anthropic calls it "not considered a long-term or production-ready solution": no prompt caching, and no thinking returned. A key outside a workspace needs a header. |

### Gateways and APIs that take a key

Checked here, at each host's model list, with no key and with a fake one:

| Provider | Base URL | Its key page | `/models`: no key / fake key | models.dev id | Notes |
| --- | --- | --- | --- | --- | --- |
| DeepSeek | `https://api.deepseek.com` | `platform.deepseek.com/api_keys` | 401 / 401 | `deepseek` | `reasoning_content` must go back with tools, or 400 |
| Z.ai (GLM) | `https://api.z.ai/api/paas/v4` | `z.ai/manage-apikey/apikey-list` | 401 / 401 | `zai` | `tool_choice` is `auto` only; Flash models free |
| Qwen (Alibaba Model Studio) | `https://dashscope-intl.aliyuncs.com/compatible-mode/v1`, or US or China | `modelstudio.console.alibabacloud.com/…/api-key` | 401 / 401 | `alibaba` | a key works only in its own region |
| Kimi (Moonshot) | `https://api.moonshot.ai/v1`, or `.cn` | `platform.kimi.ai/console/api-keys` | 401 / 401 | `moonshotai` | K3 needs `reasoning_content` back |
| MiniMax | `https://api.minimax.io/v1`, or `api.minimaxi.com` | `platform.minimax.io/…/interface-key` | 401 / 401 | `minimax`, whose `api` is its Anthropic path | the whole message, reasoning too, must go back in tool loops |
| xAI | `https://api.x.ai/v1` | `console.x.ai/…/api-keys` | 401 / 400 | `xai` | a bad key gets 400; Chat Completions is "legacy" there |
| Mistral | `https://api.mistral.ai/v1` | `console.mistral.ai/api-keys` | 401 / 401 | `mistral` | **any unknown field gets 422** |
| Groq | `https://api.groq.com/openai/v1` | `console.groq.com/keys` | 401 / 401 | `groq` | free, no card |
| Together | `https://api.together.ai/v1` | `api.together.ai/settings/…/api-keys` | 401 / 401 | `togetherai` | |
| Fireworks | `https://api.fireworks.ai/inference/v1` | `app.fireworks.ai/settings/users/api-keys` | 401 / 401 | `fireworks-ai` | |
| DeepInfra | `https://api.deepinfra.com/v1/openai` | `deepinfra.com/dash/api_keys` | 200 / 401 | `deepinfra` | |
| Baseten (added 2026-11-14) | `https://inference.baseten.co/v1` | `app.baseten.co/settings/api_keys` | 401 / 401 | `baseten` | a personal key ends within 90 days; a team key with Call Model APIs can be Never |
| Cerebras | `https://api.cerebras.ai/v1` | `cloud.cerebras.ai` › API Keys | 403 / 401 | `cerebras` | no developer role |
| NVIDIA | `https://integrate.api.nvidia.com/v1` | `build.nvidia.com/settings/api-keys` | **200 / 200** | `nvidia` | free for development |
| SambaNova, Novita, Venice, Inception, Helicone, Kilo, NanoGPT, ZenMux, Poe, Ollama Cloud, Hugging Face | — | — | **200 / 200** | each has one | a public list |

**Dropped:**
- **Lambda** shut down its inference API on 2025-09-25.
- **AI21** has no key to make: its studio redirects to its home page.
- **Perplexity** ended Sonar Chat Completions on 2026-09-27.

**On demand:** OpenRouter's providers page (2026-11-09) ranks OpenAI, Tencent, DeepSeek, Together, StepFun, DeepInfra, NVIDIA, and MiniMax highest by monthly tokens. By model maker, DeepSeek, OpenAI, Google, and Z.ai lead its weekly share. pi and OpenCode both build in DeepSeek, Fireworks, Groq, MiniMax, Mistral, Moonshot, Together, xAI, Z.ai, Cerebras, Baseten, Google, and Qwen.

### Checking a key

**A model list that's public checks nothing.** On 18 hosts above, `GET /models` answers 200 to a fake key. OpenRouter is one of them, and fxbot ships it:
- `https://openrouter.ai/api/v1/models` answered 200 with no key and with a fake one.
- `https://openrouter.ai/api/v1/key` answered 401 to both.

So today any OpenRouter key passes fxbot's check (`packages/sdk/src/models.ts:13, 208`), and fails only at the first message.

**Endpoints that answered a fake key with 401, and that a check can use:**

| Host | Endpoint |
| --- | --- |
| OpenRouter | `/api/v1/key` |
| Hugging Face | `https://huggingface.co/api/whoami-v2` |
| Venice | `/api/v1/api_keys/rate_limits` |
| NanoGPT | `/api/v1/usage` |
| Kilo | `https://api.kilo.ai/api/profile` |
| Novita | `/openapi/v1/billing/balance/detail` |
| Poe | `/usage/current_balance` |

SambaNova, NVIDIA, Inception, Helicone, and ZenMux have none, and only a real completion would tell.

### Model lists and metadata

**models.dev** (MIT, `anomalyco/models.dev`):
- **Size:** 5.97 MB, about 610 KB gzipped. Its repo took 100 commits in a day of automated catalog syncs, so a daily refresh, as fxbot does now, is right.
- **Providers:** 235 providers and 8,939 models. 210 providers have an `api` base URL, and 187 of them are OpenAI-compatible at a fixed HTTPS address fxbot could use as is.
- **What's missing:**
  - **Base URLs for the most popular,** whose entries have none: OpenAI, Anthropic, Google, Groq, Cerebras, Together, DeepInfra, Mistral, xAI, Venice, Cohere, Azure, Bedrock, Vertex.
  - **Key pages, steps, and order.**
  - **Hosts it leaves out:** Hyperbolic, Featherless, Portkey, LiteLLM, and the local servers.
- **Its model ids don't always match a host's own:**

  | Host | Live models found in models.dev |
  | --- | --- |
  | Requesty | 0 of 821 |
  | Poe | 0 of 301 |
  | OVHcloud | 2 of 21 |
  | NVIDIA | 25 of 84 |
  | DeepInfra | 55 of 177 |
  | OpenRouter and Vercel | all |

  So a host's own `/models` is the list, with models.dev's metadata attached by exact id. Where a host has no list (Vertex, Bedrock's runtime, Cloudflare), models.dev's is the list.
- **pi does this,** with a catalog file for each provider over models.dev, plus flags for each provider's quirks.

### What a provider can trip over in libfx

These are libfx's behavior, not fxbot's. Each needs a real key before its provider is featured:
- **Sending reasoning back.** DeepSeek returns 400 when `reasoning_content` isn't sent back with tools. Kimi K3, MiniMax, Z.ai's coding endpoint, and xAI need it too, and Venice needs `reasoning_details`. libfx's binary holds the field names `reasoning_content` and `reasoning_details`, but whether it sends them back wasn't checked.
- **Gemini's thought signatures** on tool calls.
- **Mistral's 422 on any unknown field.** libfx's binary holds `"stream_options":{"include_usage":true}`.
- **The developer role,** which Cerebras, Together, Z.ai, NVIDIA, and Qwen don't take (pi's flags).
- **Headers.** A custom provider sends only `Authorization: Bearer`. fxbot already adds headers through the agent's `fetch`, as its OpenCode and Vercel kinds do (`packages/sdk/src/providers.ts:35-45, 119`). So OpenRouter's attribution, Azure's `api-key`, Cloudflare's gateway id, or Anthropic's workspace header all fit there.
- **Fresh tokens.** A custom provider's key is read through `credentials()` on every request (`providers.ts:125`), so a token fxbot makes or refreshes, for Vertex or Hugging Face, needs no libfx change.

### How apps lay out adding a provider

- **Sign-ins first, then keys, then local.**
  - **openbot:** "Connect your AI — Choose the AI your Bots use. Sign in with a plan you already have, or use an API key." Its tiles are a logo, a name, and a line. A tile opens with "Sign in with my plan" or "Use an API key", the plan first. Each key provider has its own link, such as "Get an xAI API key".
  - **Hermes desktop's first run:** "Connect a model provider to start chatting. Most options take one click." A **Recommended** row, then sign-ins, each with how it works:
    - "Opens your browser to sign in, then continues here"
    - "Opens a verification page in your browser — Hermes connects automatically"

    Then "Other providers", "I have an API key", "Run models locally — No account needed", and "I'll choose a provider later". After a sign-in: "{provider} connected. Picking a default model...", then **Begin**.
  - **Codex's onboarding:** "Sign in with ChatGPT", then "Sign in with Device Code" ("Sign in from another device with a one-time code"), then "Sign in another way".
- **A search, groups, and a line on each.**
  - **opencode:** "Search providers", Popular and Services, a "Recommended" tag, and lines such as "Unified access to AI models with smart routing". Its Popular order: OpenCode Go, OpenCode, Anthropic, Copilot, OpenAI, Google, OpenRouter, Vercel.
  - **Zed:** groups by how the owner pays.
- **The device code screen.**
  - **Kilo:** "Step 1: Open this URL", with Copy URL, Open Browser, and a **QR**, then "Step 2: Enter this code".
  - **opencode:** "Confirm the code shown there matches the one below", "Browser didn't open? Copy sign-in link", and "This sign-in request has expired. Start again to get a new device code."
- **A key's card.**
  - **Continue:** "Click here to create a X API key".
  - **Cherry Studio and Open WebUI:** **Check**, and **Verify Connection**: "Server connection verified".
  - **Jan:** "Failed to fetch models from {provider}. Please check your API key and base URL."
- **After connecting.**
  - **opencode:** "Connected to {provider} — Choose a model to start with. You can switch models anytime." For ChatGPT: "Eligible requests in OpenCode can use your ChatGPT plan", with "Manage usage in ChatGPT settings".
  - **Cherry Studio:** its **Next** waits for a provider and a model, as fxbot's **Continue** does.
- **Custom.** openbot's row: "Any OpenAI-compatible endpoint — Azure, Bedrock, Mistral, DeepSeek, Ollama, vLLM or your own", with a plain cloud icon, not a vendor's.
- **What's already there.**
  - **eve:** "connects with credentials you already have".
  - **Zed:** "Start now using API keys from your environment".
  - **Hermes:** imports other apps' logins.

### The directive's references

- **[eve](https://eve.dev):** Vercel account by device code, ChatGPT, and keys for AI Gateway, OpenAI, and Anthropic. Its login options haven't changed since 2026-09-24.
- **[fx](https://fx.sh):** the three logins above, unchanged. Its docs say `fx setup`'s key saving "stops working in fx 0.0.18".
- **[Pi](https://github.com/earendil-works/pi):**
  - Since the last provider research, it gained Sign in with ChatGPT, Meta, Kimi, xAI by device code, and its own Radius.
  - Its OpenRouter sign-in is PKCE, with a loopback or a pasted code.
- **[Grok bot](https://docs.x.ai/grok-bot/overview):** no provider step at all. An account sign-in, a plan check, a first bot made and opened, then a first task.
- **[OpenBot](https://github.com/CopilotKit/openbot):** its "Connect your AI" tiles, plan before key, and a link for each key provider, as above. Added "Sign in with Unbiased AI" (2026-11-08) and logos on its sign-in rows (2026-11-07).
- **[OpenDuet](https://github.com/CopilotKit/OpenDuet):** an older copy of OpenBot's.
- **[openmuse](https://github.com/CopilotKit/openmuse), [OpenDots](https://github.com/CopilotKit/OpenDots):** keys from the environment.
- **[fx0](https://github.com/vercel-labs/fx0):**
  - **Its sign-in** redirects to `${origin}/api/auth/callback`, which works for one fixed origin. fxbot has a different origin in each install, which is why its sign-ins are device codes.
  - **Its copy:** "Sign in to generate — Your draft is kept."
- **[durable-harness](https://github.com/vercel-labs/durable-harness):** an AI Gateway token or key.
- **[agent-desktop](https://github.com/vercel-labs/agent-desktop), [agent-browser](https://github.com/vercel-labs/agent-browser):** nothing for model logins.

## 2. Key takeaways

1. **The login buttons are fx's three, plus three fxbot signs in to itself.**
   - **fx's:** libfx and fx log in to Vercel, ChatGPT/Codex, and Grok, all by device code, all in fxbot already. Vercel needs fxbot to ship its own app's client id, as fx does, to work out of the box.
   - **fxbot's own:** **OpenRouter** by PKCE, back to fxbot's own page. **Hugging Face** and **OrcaRouter** by device code. Each yields a key or token with nothing to copy.
   - **Nous Portal** joins when Nous gives fxbot a client id.
2. **No plan the provider forbids.**
   - **Claude and Gemini CLI:** off, by their terms.
   - **Copilot:** off; it's official for OpenCode alone.
   - **OpenAI's new Sign in with ChatGPT:** waits for libfx to speak the Responses API, and for a way in that isn't a loopback.
3. **Most of the rest is a key, walked through.**
   - **The card:** a link to the exact page where the key is made, what to pick there, and what it costs to start.
   - **The data:** the walkthrough is data in `providers-registry.json`, which refreshes from fxbot.sh as the plugin list does.
   - **The long tail:** models.dev's 187 hosts, under search.
4. **The clouds need fields, and Vertex needs tokens.**
   - **Bedrock, Azure, and Cloudflare** are a key and a field or two, in a base URL with blanks.
   - **Vertex** is a service-account file, from which fxbot signs its own hour-long tokens with Node's `crypto`.
5. **A model list from the provider, its metadata from models.dev.** models.dev's ids miss a host's own often: 0 of 821 at Requesty, 25 of 84 at NVIDIA. So the provider's list is the truth, where it has one.
6. **A key check must hit something that refuses a bad key.** 18 hosts' `/models` answer 200 to a fake key, OpenRouter's among them, so its check today passes anything. That fix ships first.
7. **A featured provider must pass a real key first:** streaming, a two-turn tool loop, and reasoning on. DeepSeek, Kimi, MiniMax, and xAI need reasoning sent back; Gemini needs its thought signatures back; Mistral refuses unknown fields. That's libfx's behavior, and the catalog marks what passed (`tested`).
8. **The layout others converged on:**
   - **The order:** sign-ins first, then keys, then the machine, then custom.
   - **A device code:** a QR and a copy link beside the code.
   - **After:** the model, with a good one filled in.
   - **Where:** one component, in Settings and in first-run setup.

## 3. Implementation

### The fix, first

`keyCheckAt` (`packages/sdk/src/models.ts:13`) gains `openrouter: "https://openrouter.ai/api/v1/key"`, which answers a bad key with 401 (checked). It's a fix to [provider logins](provider-logins.md), recorded in that doc's **Built**, and needs no wait for the rest.

### The catalog (`packages/sdk/src/providers-registry.json`)

**Every provider the page offers is an entry,** shipped with each release, and refreshed hourly from `https://fxbot.sh/providers-registry.json` through `listsUrl`, as `plugins-registry.json` is (`packages/sdk/src/index.ts:126-135`). Until a read succeeds, the release's copy serves. An entry that names a way to connect this release doesn't have is left out, so an older fxbot never shows a button it can't run.

```ts
type CatalogEntry = {
  id: string;             // its kind, such as "groq"; a provider's record keeps it
  name: string;           // "Groq"
  group: "sign-in" | "key" | "cloud" | "local";
  order?: number;         // its place in its group; an entry without one shows only in search
  connect: "device" | "redirect" | "key" | "url" | "service-account";
  signIn?: string;        // the SDK code that runs it: chatgpt, grok, vercel, openrouter, huggingface, orcarouter
  baseUrl?: string;       // may name fields, as https://bedrock-runtime.{region}.amazonaws.com/openai/v1
  fields?: { name: string; label: string; options?: { value: string; label: string }[]; default?: string }[];
  keyPage?: string;       // where its keys are made
  steps?: string[];       // what to do there, a line each
  start?: string;         // what it costs to begin, such as "Free, no card"
  keyCheck?: string;      // where a bad key is refused, when /models is public
  badKey?: number[];      // the statuses that mean a bad key; 401 and 403 unless it says, with 400 for xAI and Gemini
  modelsDev?: string;     // its id in models.dev
  models?: "own" | "catalog" | "typed";  // where its list comes from: "own" /models by default
  hide?: string[];        // model ids to leave out, as patterns: anthropic.* on Bedrock
  headers?: Record<string, string>;      // added to its requests, such as OpenRouter's attribution
  docs: string;           // its page in fxbot's docs
  recommended?: string;   // the model the page fills in after connecting
  tested?: string;        // the fxbot version whose release checks ran it with a real key
};
```

**The groups,** as the page shows them:

| Group | Entries, in order |
| --- | --- |
| Sign in | Vercel; ChatGPT and Codex; Grok; OpenRouter; Hugging Face; OrcaRouter. Nous Portal joins when Nous gives fxbot a client id. |
| Use a key | AI Gateway, OpenAI, Anthropic, Google Gemini, DeepSeek, OpenRouter, Z.ai, Qwen, Kimi, MiniMax, xAI, Mistral, Groq, Together, Fireworks, DeepInfra, Cerebras, NVIDIA, Nous Portal, OrcaRouter, OpenCode Zen, OpenCode Go |
| Clouds | Vertex AI, AWS Bedrock, Azure OpenAI, Cloudflare |
| On your machine | Ollama, LM Studio, llama.cpp, vLLM, Jan, LiteLLM |
| Search | models.dev's 187 OpenAI-compatible hosts with a fixed HTTPS address, by name, besides the above, with its `api`, `doc`, and `env[0]` |
| Custom | a base URL, an optional key, and optional model ids |

**What stays code,** since only these need behavior a list can't hold:
- the six sign-ins
- Vertex's tokens
- the local servers' probes, as today
- the OpenCode kinds' session header, as today

**Everything else is the one path that `openai` and `openrouter` take today:** a custom provider at the entry's base URL, its key through `credentials()`, its headers through the agent's `fetch`, and its models from its list with models.dev's metadata.

### Providers, from an entry

- **A provider's `kind` is its entry's `id`.** Today's eleven kinds keep their ids, so every provider already added carries on. The column is free text (`0001_baseline.sql:2`), so a new id needs no change to it.
- **A provider keeps what it needs to run without its entry:**
  - its base URL, with the fields filled in
  - the fields themselves
  - any model ids the owner typed

  An entry that later leaves the catalog, or moves, doesn't stop a provider that was added from it.
- **A new migration** (the next number in `packages/sdk/src/migrations/`) adds `fields jsonb not null default '{}'` and `model_ids text[]` to `providers`, with a note under `## Unreleased`.
- **`providers.add`** takes `{ kind, fields?, apiKey?, serviceAccount?, modelIds?, name?, model? }`. It checks the fields against the entry's options, and fills in the base URL. libfx's rule still applies: https, or http on loopback.

### Models

`models(provider)`, for an entry's kind:
1. **The list** is the provider's own `/models`, with its key and headers. Where it has none (`models: "catalog"`: Vertex, Bedrock's runtime, Cloudflare), or answers 404 or 405, the list is models.dev's for that `modelsDev` id. Where the owner typed ids (`"typed"`: Azure's deployments, or a Custom server with no list), those are the list.
2. **The metadata** for each id is models.dev's, by exact id, then by the id without a vendor prefix, then by `canonical_model_id`.
3. **`hide`** leaves out what the entry names. On Bedrock that's Claude, which doesn't serve Chat Completions there.
4. **The cache:** the list is cached, as today, and kept in `model_lists`.

The model picker shows each model's context window, and whether it takes tools and images, where they're known.

### Checking a key

- **The URL** is the entry's `keyCheck`, or `{baseUrl}/models` when it has none.
- **A bad key** is any status in `badKey`, 401 and 403 by default. It's refused with "The provider rejected this key". 404 is kept, as today.
- **An entry whose `/models` is public, with no `keyCheck`,** is checked at `/models` anyway, and marked as such. Its first chat then says plainly when the key is wrong. libfx's "host managed authentication failed · HTTP 401" becomes "Groq rejected this provider's key. Replace it in Settings › Providers."

### Sign-ins

Each runs on the server as an attempt the page polls, as today (`providers.ts:357-390`). `SignIn` gains a `way`:

| `way` | The page shows | Used by |
| --- | --- | --- |
| `device` | a link and a code, as today | ChatGPT, Grok, Vercel, Hugging Face, OrcaRouter |
| `redirect` | **Continue to OpenRouter**, which opens its page in the same browser | OpenRouter |
| `paste` | OpenRouter's page, then a field for the code it shows | OpenRouter, where a redirect can't come back |

**Vercel works out of the box.**
- **The id:** fxbot ships its own Vercel OAuth app's client id as the default. A client id isn't a secret, and fx does the same with its own. `FXBOT_VERCEL_CLIENT_ID` still overrides it.
- **The scope:** `openid offline_access`, then a team, as today.

**OpenRouter** (`packages/sdk/src/openrouter.ts`), PKCE ([docs](https://openrouter.ai/docs/use-cases/oauth-pkce)):
1. **The verifier.** The server makes a verifier, keeps it with the attempt, and builds `https://openrouter.ai/auth?callback_url=<origin>/api/sign-ins/<attempt>/callback&code_challenge=<S256>&code_challenge_method=S256&key_label=fxbot`.
   - `<origin>` is the page's own `Origin`, which the server checks as it does for MCP sign-ins (`packages/sdk/src/mcp.ts:514-516`).
   - The attempt's id in the path carries the state, since one review found OpenRouter's `state` isn't echoed.
2. **The callback.** OpenRouter sends the browser back to the callback with `code`. The server trades it at `POST https://openrouter.ai/api/v1/auth/keys` with `{ code, code_verifier, code_challenge_method: "S256" }`, seals the key, and adds the provider. The callback page says "Signed in to OpenRouter. You can close this tab", and the first tab's poll finishes.
3. **Where a redirect can't come back,** `way` is `paste`:
   - **When:** an origin that's neither https nor loopback, such as `http://192.168.1.20:8787`, or a callback that never arrives within its 10 minutes.
   - **How:** the URL leaves out `callback_url`, and OpenRouter shows a code to paste instead.
   - **Through web pairing:** the frame's origin is https, so its callback comes back through the tunnel (*likely*).

**Hugging Face** (`huggingface.ts`): a device code, as RFC 8628, at `https://huggingface.co/oauth/device`:
- **The app:** fxbot's own public app, with no secret, its client id shipped (`FXBOT_HF_CLIENT_ID` overrides), scope `inference-api`.
- **The tokens:** the access and refresh tokens are sealed. `credentials()` refreshes near expiry, under the provider's lock, as the plans do (`providers.ts:78-100`).
- **The provider:** it runs at `https://router.huggingface.co/v1`. Its list is the router's public `/models`, with each model's `context_length` and `supports_tools` from its providers.
- **Ids:** a model id without a suffix takes `:fastest`, as the router does.
- **The token's lifetime** isn't documented, so the refresh is checked by hand.

**OrcaRouter** (`orcarouter.ts`): a device code, anonymous, with `app_name: "fxbot"`:
- **Start and poll:** `POST https://www.orcarouter.ai/api/v1/auth/device/code`, then `/api/v1/auth/device/token`, every `interval` seconds.
- **What it gives:** a permanent key, sealed as any key is. The provider is then a key kind at `https://api.orcarouter.ai/v1`.
- **Addresses:** https, fixed in code, since its discovery document names `http://` endpoints.

**ChatGPT and Grok** stay as they are, through libfx. libfx 0.0.16 is still the newest, and fx logs in to these three only. So there's no other libfx login to give a button.

### The clouds

| Kind | The owner gives | fxbot does |
| --- | --- | --- |
| `vertex` | the service-account JSON, chosen as a file and sent once like a key, and a location (default `global`) | **Its own tokens** (`vertex.ts`, about 60 lines): <ol><li>signs an RS256 JWT with `crypto.sign` (`iss` the account's email, `scope` `cloud-platform`, an hour long)</li><li>trades it at `https://oauth2.googleapis.com/token`</li><li>keeps the token until 5 minutes before it ends</li><li>hands it over in `credentials()`</li></ol>**Its project** comes from the JSON's `project_id`. **Its models** are models.dev's `google-vertex`, each with its `google/` prefix. **Its check** is a token minted. |
| `bedrock` | a long-term Bedrock API key and a region | **Its address:** the runtime at `https://bedrock-runtime.{region}.amazonaws.com/openai/v1`. **Its models** are models.dev's `amazon-bedrock`, with `hide: ["anthropic.*"]` and inference-profile ids where the model needs one. **Its check** is mantle's `/v1/models`, which refuses a bad key with 401 (checked). The card says the console's own warning, "for exploration only", and when the key expires. |
| `azure` | a resource name, a key, and the deployments' names | **Its address:** `https://{resource}.openai.azure.com/openai/v1`. **Its key** goes both as `api-key`, through `fetch`, and as the bearer. **Its models** are the deployments (`"typed"`). |
| `cloudflare` | an API token with Workers AI Read, and the account id | **Its address:** `https://api.cloudflare.com/client/v4/accounts/{account}/ai/v1`. **Its models** are models.dev's `cloudflare-workers-ai` and `cloudflare-ai-gateway`. **Its check** is `GET https://api.cloudflare.com/client/v4/user/tokens/verify` (*likely* 401 for a bad token). |
| `anthropic` | a workspace's key | **Its address:** `https://api.anthropic.com/v1`. **Its models** come from its list. The card says what its compatibility layer leaves out, in Anthropic's words. |

### The page (`packages/ui/src/add-provider.tsx`)

**Add provider** in Settings › Providers opens a page, a sheet on a phone, in place of today's select:

```
┌ Add a provider ───────────────────────────────── [ Search providers ] ┐
│ Sign in                                                               │
│ [ Vercel ] [ ChatGPT · Codex ] [ Grok ] [ OpenRouter ]               │
│ [ Hugging Face ] [ OrcaRouter ] [ Custom… ]                           │
│ Use a key                                                             │
│ [ AI Gateway ] [ OpenAI ] [ Anthropic ] [ Gemini ] [ DeepSeek ] …     │
│ Clouds                                                                │
│ [ Vertex AI ] [ Bedrock ] [ Azure ] [ Cloudflare ]                    │
│ On your machine                                                       │
│ [ Ollama ] [ LM Studio ] [ llama.cpp ] [ vLLM ] [ Jan ] [ LiteLLM ]   │
└───────────────────────────────────────────────────────────────────────┘
```

- **Each button is its name with a mark,** drawn from the name as plugins' icons are ([plugin icons](plugin-icons.md)), so no logo is fetched or bundled.
- **A tap opens its card,** which is the whole of that provider:
  - **A sign-in:** **Continue to OpenRouter**, or a device code, with:
    - the code
    - **Copy link**
    - a QR of the link, for an account that lives on a phone while the page is on a desktop

    Then "Waiting for you to sign in…", and "This code expired. Start again" when it runs out. A ChatGPT sign-in that fails says how to allow device codes, in libfx's words. A successful one says the plan's own usage applies.
  - **A key:**
    1. Open the key page ↗, the entry's `keyPage`.
    2. The entry's `steps`, such as "Create a key, with no expiry".
    3. The entry's fields: a region select, an account id, or a file for Vertex.
    4. Paste the key, and **Add**. The check runs, and a refusal says which status, and what it means.
  - **A local server:**
    - **Its address,** filled in, with the hint for each, such as Ollama's `OLLAMA_CONTEXT_LENGTH`.
    - **Found on this machine:** when the page opens, the server tries Ollama's and LM Studio's usual addresses, with a half-second timeout, and marks a server it finds.
    - **Inside the release's containers,** `localhost` is the container, and the machine's own server is at `host.containers.internal`. That address is plain http, which libfx refuses, since it allows only https or loopback. So the card says so, and links to what works.
  - **Everywhere:** `start` ("Free, no card"), and **Help**, its page in the docs.
- **Then the model:**
  - the provider's list, with each model's context window, tools, and images
  - the entry's `recommended` model filled in, and "You can change it any time"
  - **Make default**, already on when it's the first provider
  - **Done**
- **Search** finds any entry, and models.dev's long tail by name. A long-tail result opens a key card with its base URL filled in, and its docs link. It says it hasn't been tried with fxbot, unless its entry has `tested`.
- **Custom** ends the first row, where the owner put it among the logins. It's today's **Other server**, plus model ids for a server with no list.

The page is one component, used in Settings and in first-run setup. Its card for an entry is its own component, so **Sign in again** and **Replace key** open the same card for a provider already there.

### First-run setup

The provider step (`packages/ui/src/onboarding.tsx:153-175`) shows the page in place, not in a dialog, under "Connect a model". Its words:
- "The quickest way: sign in with an account you already have."
- Under the keys: "Or use a key from a provider you pay."
- Under the machine: "Or run models on your own machine."

After a provider, it asks for the model, then **Continue**, as now. A sign-in or a key that fails says what to try next, and links the provider's docs page.

### API

| Route | What |
| --- | --- |
| `GET /api/providers/catalog` | the catalog's entries, and the long tail's names and base URLs (about 20 KB), for the page |
| `POST /api/sign-ins` | `{ kind }` for any sign-in. It answers `{ id, way, verificationUrl?, userCode?, url?, expiresAt }`. |
| `GET /api/sign-ins/:id/callback` | a redirect's way back: it finishes the attempt, and answers a small page |
| `POST /api/sign-ins/:id/code` | `{ code }`, for `paste` |
| `POST /api/providers` | takes `fields`, `serviceAccount`, and `modelIds` too |

`@fxbot/sdk/client` gains the same, and the `CatalogEntry` type. No route answers a key, a token, or a service account.

### The docs

**Pages:**
- **How-to: Add a provider,** rewritten for the page.
- **The tutorial "Your first fxbot",** for the new provider step.
- **A new sidebar group, Providers, with a how-to page for each provider in the catalog's groups,** linked from its card's **Help**:
  - **Sign in:** OpenRouter, Vercel and AI Gateway, ChatGPT and Codex plans, Grok plans, Hugging Face, OrcaRouter, and Nous Portal.
  - **Clouds:** Cloudflare, Vertex AI, the Gemini API, AWS Bedrock, Azure OpenAI, and Anthropic.
  - **Keys:** OpenAI, DeepSeek, Z.ai, Qwen, Kimi, MiniMax, xAI, Mistral, Groq, Together, Fireworks, DeepInfra, Cerebras, NVIDIA, and OpenCode Zen and Go.
  - **On your machine:** Ollama, LM Studio, llama.cpp, vLLM, Jan, and LiteLLM.

  Each says:
  - what the provider is, and what it costs to start
  - how to sign in, or exactly where and how to make a key, with its links
  - the fields in fxbot
  - its models, and what they can do
  - its quirks, from this research
  - what to do when it fails
- **Reference: Providers** is built from `providers-registry.json` when the site builds: every entry's name, way in, base URL, and docs page. It can't drift from what fxbot offers.

**Also:** the README's provider line, and `CHANGELOG.md`.

### Cost

- **For the owner:** nothing until they add a provider.
- **For the page:** a tap on **Add provider** reads the catalog once, about 20 KB.
- **For fxbot:** the catalog is read hourly from fxbot.sh, as the plugin list is. models.dev is still read daily, as now.
- **A sign-in** is the same polling it is today.

### Not in this phase

- **Nous Portal's sign-in,** until Nous gives fxbot a client id. Its key works meanwhile.
- **Cloudflare's OAuth,** which needs a registered redirect and a verified domain.
- **Bedrock with IAM credentials,** minting short-term keys with SigV4.
- **Azure with Entra ID.**
- **GitHub Copilot, GitHub Models, and Claude plans,** for the reasons in the research.
- **Logos** from each provider.
- **Spending caps for each bot,** with OpenRouter's provisioning keys.
- **Reaching the machine's own local server from the release's containers.** libfx allows only https or loopback, and the host's address from inside a container is neither. The app download (the distribution phase) runs on the machine itself, where `localhost` works.
- **Importing a login from another app,** as Hermes does from Claude Code or Codex.
- **A provider's balance or usage** shown in fxbot.

### What changes

| Where | Change |
| --- | --- |
| `packages/sdk/src/providers-registry.json`, `packages/website/public/providers-registry.json` | New: the catalog |
| `packages/sdk/src/types.ts` | `kinds` gives way to `CatalogEntry`; `SignIn` gains `way` and `url` |
| `packages/sdk/src/providers.ts` | adding from an entry; the generic key path; fields; the redirect and paste sign-ins |
| `packages/sdk/src/models.ts` | the merged list; `keyCheck`, `badKey`, `hide`; the OpenRouter fix |
| `packages/sdk/src/openrouter.ts`, `huggingface.ts`, `orcarouter.ts`, `vertex.ts` | New |
| `packages/sdk/src/vercel.ts` | fxbot's own client id, as the default |
| `packages/sdk/src/migrations/<next>.sql` | `fields` and `model_ids` on `providers` |
| `packages/server/src/index.ts` | the catalog, callback, and code routes |
| `packages/ui/src/add-provider.tsx` | New: the page and its cards |
| `packages/ui/package.json` | `qrcode-generator` (MIT, no dependencies), for the device code's QR |
| `packages/ui/src/providers.tsx`, `onboarding.tsx` | the page in place of the select, and in the provider step |
| `packages/website/…` | the pages above, the Providers group in `src/sidebar.ts`, and the reference built from the catalog |
| `README.md`, `CHANGELOG.md` | |

**Size:**

| Part | Lines | Built |
| --- | --- | --- |
| The catalog, about 45 entries | about 900 of JSON | 37 entries, 540 |
| SDK: entries, fields, models, checks | about 250 | about 620: `catalog.ts`, `models.ts`, `providers.ts`, types, store, and the chat's words for a refused key |
| SDK: OpenRouter, Hugging Face, OrcaRouter | about 220 | 120, with a device code module the two share |
| SDK: Vertex, Azure, Bedrock, Cloudflare | about 120 | 50: Vertex's tokens. The rest is the catalog. |
| Server routes | about 40 | 17 |
| The page and its cards | about 450 | 540, and `providers.tsx` shrank by 190 |
| First-run setup | about 30 | 17 |
| The migration | 3 | 3 |
| Docs: about 35 provider pages, and the rest | about 1,800 | about 1,900: 34 pages of 1,620 lines, and the rest |

### Built

What the build found or changed, against the plan:

- **An entry's way in.** `connect` is what its card asks for: `device`, `key`, `url`, or `service-account`. A `signIn` puts it in the Sign in row too, so OpenRouter, Hugging Face, and OrcaRouter are one card each, the sign-in first, then "Or use a key". There's no `redirect` connect: OpenRouter's way is chosen when it signs in. Entries gained `about`, the line on its button; `note` and `hint`, for its card; `unchecked`, for a list that answers any key; `modelPrefix`, Vertex's `google/`; and `clientId`. `modelsDev` can name more than one list, as Cloudflare's does.
- **fxbot's own apps come from the catalog, and Vercel's sign-in is off.** The owner registered fxbot's Hugging Face and Vercel apps on 2026-11-09, both public, with no secret. Hugging Face's client id ships in the catalog. Vercel's app, `cl_0VjhUFXdyXZ7v8NbaX4ug1CqBM1iPxuE`, asks for `openid` and `offline_access`, but its first real sign-in got 401, `unauthorized_client`: "This client is not authorized to use the Device Authorization flow." Vercel's dashboard shows **Device Code** among the app's grant types, grayed out and locked, also with a secret method on. So its id is out of the catalog, and the Vercel sign-in doesn't show; AI Gateway's key card stays. The owner turned down a way around it, the Authorization Code grant with a fixed page on fxbot.sh that passes the sign-in on to each fxbot, as a place to be intercepted. Once Vercel allows the grant, the id goes back in the catalog at fxbot.sh, and every install shows the button within the hour. A sign-in whose entry names no client id doesn't show, and `FXBOT_VERCEL_CLIENT_ID` and the new `FXBOT_HF_CLIENT_ID` override the catalog's. A refused device code now says the provider's own reason, for Vercel, Hugging Face, and OrcaRouter.
- **Hugging Face's sign-in** asks for `inference-api`, so fxbot's app there must be registered with that scope. Hugging Face's docs confirm a public app, with no secret, can use the device code; their example sends no scope, so the app's own scopes may decide. Its OpenID configuration also lists dynamic client registration, which might let each install register its own app; that wasn't tried, since it creates something at Hugging Face.
- **Cloudflare's key check moved.** `/user/tokens/verify` checks only a user's token, and Cloudflare's account tokens would fail it. The check asks the account's Workers AI model search instead, which answered a made-up, well-formed token with 401, and a malformed one with 400 (checked), so its `badKey` is 400, 401, and 403.
- **Vertex AI:** a location other than `global` uses that region's own host, `{location}-aiplatform.googleapis.com`. A service account that names a token endpoint other than Google's is refused, so the signed assertion goes nowhere else. Claude is hidden, as it isn't on that endpoint.
- **A refused key in a chat.** libfx ends a turn whose provider answers 401 as `refused`, with no words, so the chat said "Stopped: refused" (checked). fxbot now words it from the provider's last refusal: "Groq rejected this provider's key. Replace it in Settings › Providers." A 403 says what it may mean instead, since Alibaba and others answer an account out of quota or credit with 403 too: "…refused this provider's key (HTTP 403): it may lack a permission, or the account may need credit or be over its quota." The turn's last line can stream out before the turn's end is kept, so the stream asks the provider too.
- **A refusal on adding** says the status and what it most likely means: 401, "it's wrong, or it was deleted"; 403, "it may lack a permission, or the account may need credit"; 400, "it isn't a key it can read". A server that can't be reached says "The key check couldn't reach <host>.", where it said "Reaching The key check failed.".
- **The page doesn't wait for models.dev.** Its 6 MB took a second or more on a new install's first look. The catalog's route waits for it 1.5 seconds at most, and the page asks again the first time you search.
- **Found on this machine** is its own route, `GET /api/providers/local`, so the page shows at once. It asks all six local servers, not only Ollama and LM Studio, with half a second each.
- **models.dev's copy** in Postgres keeps every host now, trimmed to what fxbot uses: 0.7 MB. A copy an older fxbot kept serves until the first fetch.
- **A host's own list leaves out what models.dev knows isn't a chat model,** such as speech and embedding models.
- **OpenAI, OpenRouter, and OpenCode keep models.dev's list,** as before, rather than their own, so nothing they listed changes.
- **`kinds` stays** in `@fxbot/sdk/client`, as the eleven kinds since 0.2.0, so an app built on it keeps working. The page reads the catalog.
- **OpenRouter's way back opens fxbot.** Its page said "Signed in. You can close this tab", but the owner's first real sign-in came back in the very tab they started from, with no fxbot to go back to. A sign-in that's done now sends the tab on to fxbot: first-run setup's model step, or Settings › Providers. One that fails says why, with a link back.
- **The search box says "Search providers",** with no count, which changed whenever models.dev did.
- **Bedrock's key check is optional where it can't be reached.** AWS runs `bedrock-mantle`, where the check asks, in fewer regions than the runtime, such as not in `us-west-1`. There a key was refused as unreachable, however good. An entry's `optionalCheck` keeps the key unchecked when its `keyCheck` can't be reached, and a wrong one shows at the first message.
- **Vertex AI is now Gemini Enterprise Agent Platform,** in Google's docs: the **Agent Platform API** and the **Agent Platform User** role. The card's steps use the new names, and its address is unchanged.
- **A recommended model matches without a host's prefix,** as Gemini's list may name its models `models/gemini-…`.
- **The catalog's answer is about 50 KB,** not 20, with models.dev's hosts in it for search. The page reads it once, when it opens.
- **A search result from models.dev** shows the address fxbot will use, with "Not yet tried with fxbot".
- **A plan's usage note** shows on its card before the sign-in, "Your plan's own usage limits apply", rather than after it.
- **Real logos, in their own colors, at the owner's word,** where the plan said none. Each tile shows its provider's logo, from LobeHub's icons (MIT) in the brand's colors where it has them, models.dev (MIT), and llama.cpp's repository (MIT), each its owner's trademark, used only to name its provider. OpenRouter's is its LobeHub shape in the purple openrouter.ai uses now, since LobeHub's color one is its old lime. OrcaRouter's, which no set has as a shape, is its site's own picture, made 96 pixels in `scripts/provider-logos/`. `node scripts/provider-logos.mjs` writes them into `packages/ui/src/provider-logos.ts`: 183 logos, for the catalog and the models.dev hosts that search shows, in 267 KB the page loads only when it opens. Each shows as an image, which runs nothing, on a light tile in both themes, so a black logo, such as OpenAI's, and one in black and a color, such as Kimi's, read on the dark theme too. LiteLLM's has no license that says it can be used, so it shows its first letter, and Custom a plug.
- **Jan left the catalog,** at the owner's word, with its page.
- **Baseten joined the keys on 2026-11-14,** at the owner's word, with its page. Its card asks for a team key with **Call Model APIs**, since a personal key ends within 90 days and is revoked after 30 days unused. It has no sign-in fxbot can use: `truss` and the `baseten` CLI sign in by device code, as `baseten-cli` at `api.baseten.co/v1/users/auth/device/authorize`, but that answered another client id with `invalid_client`, and Baseten's docs offer no app registration. Not yet run with a real key.
- **Found by the provider pages' writing, not changed:** Anthropic's list comes 20 to a page, and fxbot reads the first. Anthropic wants a key scoped to a workspace, or a header fxbot doesn't send. A Gemini key refused in a chat shows Gemini's own 400, since a 400 there can be other things too. OpenCode Zen's free models work only in OpenCode's own app, so its card no longer says some are free.

## 4. Checklist

**M0. The fix, at once**
- [x] `keyCheckAt.openrouter` is `https://openrouter.ai/api/v1/key`. A fake key is refused against a stub that answers like OpenRouter: 200 at `/models`, 401 at `/key`. Recorded in provider logins' **Built**. *Checked: a fake key is refused with 401 at `/key`, and a good one passes, though `/models` answers anyone.*

**M1. The catalog, and providers from it**
- [x] `providers-registry.json`, with its type, and its copy on the site, read hourly through `listsUrl`. An entry with a way to connect this release lacks is left out.
- [x] The migration, with `fields` and `model_ids`, and its note.
- [x] `providers.add` from an entry: fields filled into the base URL, checked; headers through `fetch`. Today's providers of every kind carry on unchanged.
- [x] Models: the provider's own list with models.dev's metadata, the catalog list where there's none, typed ids, and `hide`.
- [x] Key checks with `keyCheck` and `badKey`, and the clearer message at a chat's first refusal.
- [x] Checked against stub hosts:
  - a public `/models`, and a 401 at `keyCheck`
  - a 400 for a bad key
  - no list, so the catalog's
  - a field in the base URL
  - a header
- [x] `npm run typecheck`, and `git diff --check`. *Checked by 69 checks against stub hosts, with fxbot's SDK in-process on a throwaway Postgres: the catalog and what it leaves out, each key check, fields, headers, the lists, the long tail, a provider from before 0.8.0, and the migration.*

**M2. Sign-ins**
- [x] Vercel with fxbot's own client id by default, and `FXBOT_VERCEL_CLIENT_ID` overriding it. *Built as the catalog's `clientId`. Vercel's sign-in is off for now: Vercel won't let fxbot's app use a device code (see **Built**). Checked: a published catalog with an id brings the button and its device code asks with that id, the environment's overrides it, and with neither the sign-in is left out and says how to set one.*
- [x] OpenRouter by PKCE, against a stub: the challenge, the callback on the page's origin, the exchange, the key sealed, and the first tab's poll finishing. The `paste` way, for a plain-http origin and for a callback that never comes.
- [x] Hugging Face by device code, against a stub: tokens sealed, a refresh near expiry under the lock, and the router's models with their metadata.
- [x] OrcaRouter by device code, against a stub: the key sealed, and a provider at its API.

**M3. The clouds**
- [x] Vertex: a service-account JSON made here with a throwaway RSA key. The JWT is verified against its public key, and traded at a stub token endpoint. The token is cached, and refreshed after 55 minutes. The models come with their `google/` prefix.
- [x] Bedrock: the region in the URL, Claude hidden, and the check at mantle's list.
- [x] Azure: the resource in the URL, `api-key` sent, and the deployments as the models.
- [x] Cloudflare: the account in the URL, the token checked, and models.dev's lists.

**M4. The page**
- [x] `add-provider.tsx`: the groups, search, each kind of card, a device code with its QR and copy link, OpenRouter's redirect and paste, the fields, the key check's messages, and the model step with a recommended model. It's used in Settings, and for **Sign in again** and **Replace key**.
- [x] Local servers found on the machine are marked as found. *Checked: a stub answering at vLLM's usual address marks vLLM **Found here**, and no other.*
- [x] First-run setup's provider step shows the page in place, with its words.
- [x] In a browser with the mock model and stub providers: each card through to a chat that answers. Block `PATCH /api/settings` from the check page, so the owner's time zone isn't saved as UTC. *Checked in Chromium against a throwaway fxbot, whose providers answered from stubs: first-run setup, OrcaRouter's and Hugging Face's device codes, OpenRouter's way back and its pasted code, Vertex's file, Bedrock's region, Azure's deployments, Vercel's code, Custom's unreachable server, Replace key, and a phone in the dark. Then a chat on each of the eight providers added answered. The check's fxbot was its own, so no owner's settings were near it.*

**M5. Docs**
- [x] Add a provider, the tutorial's provider step, and a page for each provider in the catalog's groups, each with the parts above. *34 pages under **Providers**, from the catalog, the research, and each provider's own docs. Each says what it couldn't confirm, and that fxbot hasn't run the provider with a real key yet.*
- [x] Reference: Providers, built from the catalog when the site builds. *Its words are `packages/website/src/providers-reference.md`, and the build fills in its table from `providers-registry.json`.*
- [x] `npm run build-site`, and every card's **Help** lands on its page. *Checked: 100 pages, and all 10,280 links and assets resolve; each of the 37 entries' `docs` is a page, at its heading where it names one.*

**Human checks, with real accounts**
- [ ] Each sign-in, from a phone over Tailscale and from the machine: Vercel, ChatGPT, Grok, OpenRouter, Hugging Face, and OrcaRouter.
- [ ] Each featured key, with streaming, a two-turn tool loop, and reasoning on, before its `tested` is set:
  - Anthropic, Gemini, DeepSeek, Z.ai, Qwen, Kimi, MiniMax, xAI, Mistral, Groq, Together, Fireworks, DeepInfra, Cerebras, NVIDIA, and Nous Portal
  - a provider that fails comes off the featured list, with a note in its docs page, until libfx carries what it needs
- [ ] Vertex with a real service account, Bedrock with a real key, and Azure and Cloudflare with their own.
- [ ] A new install's first run, from nothing to a first chat, on each way in.

## 5. Open questions

1. **Who registers fxbot's Vercel and Hugging Face apps?** Both are public apps with no secret, so their client ids ship in fxbot. Each needs an account to own it, a name, and an icon. The default is the project's own accounts, named "fxbot". *Both registered by the owner on 2026-11-09, under the project's own team. Hugging Face's client id ships in the catalog. Vercel's doesn't: Vercel won't let the app use the device code yet, so its sign-in is off (see **Built**).*
2. **Ask Nous for a client id for fxbot?** Its device code would give Nous Portal a sign-in button. The default is to ask, and use a key until then. OrcaRouter's partner `app_id`, for its Verified badge, is the same kind of ask. *Built: a key, for now. Asking is the owner's.*
3. **The featured order.** The default is by demand: AI Gateway, OpenAI, Anthropic, Gemini, DeepSeek, OpenRouter, Z.ai, Qwen, Kimi, MiniMax, xAI, Mistral, Groq, Together, Fireworks, DeepInfra, Cerebras, NVIDIA, Nous Portal. *Built as the default, with OpenCode Go after Gemini, at the owner's word, Hugging Face before Nous Portal, and OrcaRouter and OpenCode Zen after it.*
4. **Untested providers in search: shown with a note, or hidden?** The default is shown, with "Not yet tried with fxbot". *Built as the default.*
5. **OpenRouter's attribution headers, on or off?** On would send `HTTP-Referer: https://fxbot.sh` and `X-OpenRouter-Title: fxbot`, and list fxbot among OpenRouter's apps. That says nothing about the owner that the key doesn't already. The default is on. *Built as the default.*
6. **First-run setup: a way to skip the provider?** Hermes has "I'll choose a provider later". The default is no, since a first bot can't answer without one, and today's whole-setup skip stays. *Built as the default. Then, at the owner's word, **Skip for now** skips only the step it's on, the provider's too ([onboarding](onboarding.md)'s **What the build changed**).*
7. **libfx's Codex sign-in, or OpenAI's new Sign in with ChatGPT?** The default is libfx's, which works today. The new one waits for libfx to speak the Responses API. *Built as the default.*
