# Phone v2: the voice is phone's

Talk with a bot by voice, in the app or on a phone line, as naturally as realtime voice products do: cut in the moment you speak, take time to think, hear a voice you like, and keep everything the bot can do.
- **The voice is the bot,** in its own words, from its own model, always. phone carries the voice for the app and every phone line: it hears the owner, stops the bot as they speak, and never takes the bot's own voice for theirs.
- **A sidekick:** the bot talks with the owner and works behind the scenes at once. Quick looks it does in the conversation. Anything longer it hands to subagents with its tools, its computer, and herdr, or to a herdr agent, and comes straight back to the conversation. What they find comes back on its own, and the bot tells the owner at a pause.
- **Rooms too, a conference call of bots:** talk with a chat room's bots at once, such as Bob and Mr Robot, each in a voice of its own. The bot you name answers, or the room's lead, who hands it to the one that fits better. The bots address each other as they do in text, one speaking at a time, and you cut in whenever you like.
- **Voice providers are logins,** on Settings › Providers beside the bots' models. A login that also speaks, such as Mistral's or OpenAI's, serves as it is. phone adds the voice services people use, ElevenLabs (the owner's favorite) and Deepgram, to the same page. A speech server on the owner's own machine, or the browser's own speech in Chrome, Firefox, Safari, or Edge, works too.
- **In-app calls:** a Talk button in a bot's chat, over the connection the app already has, web pairing included. The bot opens with "Hey, what's up?"
- **A carrier plugin only places the call and carries its sound,** over a SIP user agent phone offers. `phone-signalwire` becomes SignalWire's SIP account, and its RELAY way goes. This release waits until SIP works well on the owner's network.

Status: **planned on 2026-11-25, not built.** Researched the same day against the research directive's references, Pipecat and LiveKit Agents, about 40 voice providers, the browsers' own speech, local speech servers, and nine phone carriers. Revised twice the same night with the owner's answers: the bot speaks in its own words, as a sidekick that works in the background while it talks. Live voice models are an option to test, not the plan. Then the owner added calls in chat rooms, to the first version. Nothing here has run on a real account or network except the two calls on dev that showed why it's needed. What's unverified says so.

## What the owner asked

On 2026-11-25, after two test calls on dev from their Apple Watch on speaker:
- "I wasn't able to intterject/interrupt it at all." Of a build that spoke one sentence at a time: "very unnatural pacing of the audio."
- "why is gpt live or other phone demos able to instantly stop and allow user to cut in, block out background noise, etc? is this cause we are using signal wires tuff and not our own?" It is: SignalWire gives nothing it hears while it speaks ([The first call on dev](../_completed/phases/phone.md#the-first-call-on-dev-2026-11-25)).
- Then the ask: "ok. we need to make this better... true own the voice... phone plugin should own this, it should offer the various voice providers as logins (like our provider login does) or reuse existing logged in providers (phone plugin adds voice providers to the provider screen in settings). So first identify which existing providers would overlap that we can start with plus some premium ones that we know folks use like elevenlabs, deepgram, etc... Then each phone-* plugin becomes just the SIP/comms plugin to call outbound but the root `phone` plugin allows in app calling with whatever voice provider you choose (You should also be able to do this locally with a locally hosted model if you want or built in tts/stt provider in browser/device etc). So use @docs/research-directive.md and plan out a phase for `phone-v2` that does this and works with main providers etc..."

Earlier that night they asked for time to think, "I may stutter, stumble, or brain pause before finishing my statement", which phone 0.1.2's `pause` setting built.

Their answers to the first version's questions:
- "gpt live is openai... btw... elevenlabs is my favorite,. google servers is a toggle but no everyone uses chrome... some folks use firefox etc...... nah get rid of signalwire we won't release this update until SIP works well and we won't need that. We do want a small greeting like "Hey whats up?" or something. phone v2 before coding."
- "I really want natural sounding conversation with deep functionality and handoffs."

Then, on a first revision that had a live voice model front the bot: "live voice is the bot, and I meant options... i know gpt live replaces the agent loop I think etc... so we need to figure that out... but I want bots own words, handoff as in it can do tool calls, ask herdr to do stuff, fire off subagents, work on computer etc. it can talk to me and delegate behin tthe scenes and keep our conversation interactive. A true sidekick..."

"Get rid of signalwire" meant its RELAY way, the speech SignalWire does today: "yes keep signalwire as first sip carrier." On how hard a call thinks: "yes call low, subagents full unless toggled to be different (default low)." On the GPT-Live test: "yes its worth after we get other stuff working."

And one more, for the first version: "I want this to work in a chat room too with multiple bots. I don't think anyone does this yet... but I want to... I want to have conversations with bob and mr robot and the one that is more appropriate or I address directly responds or defaults to the default bot of the room and the bots can address the other bots on the call etc... just like in chatroom text, but over a "conference call" of bots."

## 0. Core or plugin

**A plugin, `phone` 0.2.0, with three small hooks in the plugin API** ([Core or plugin](../../CONVENTIONS.md#core-or-plugin)). Talking by voice isn't what every bot needs. phone owns the voice loop, how a bot works on a call, the in-app call, the voice providers' adapters, and a phone line's audio. Carriers stay plugins that need phone.

**Provider logins are core:** the Add provider page, keys sealed in Postgres, and the key check. The owner asked for voice providers on that page, and for logins already added to serve. A plugin can do neither today. `fx.models.ask` makes one chat request, and nothing lets a plugin add a kind of provider or reach an added one's API. So the plugin API widens, with nothing in it about voice, and a call needs one more hook to be quick:
1. **Provider entries a plugin brings.** `plugin.json` may carry `providers`: catalog entries of the same shape as `providers-registry.json`'s, checked by the same rules, with a new `models: "none"`. While the plugin is added, the Add provider page lists them in a group under the plugin's name. They're added, sealed, and key-checked like any provider, and they're never a bot's model.
2. **`fx.providers`:** `list()`, `fetch(id, url, init)`, and `socket(id, url, protocols)`. These are requests and WebSockets to an added provider's own hosts, with its key or sign-in added by fxbot, as libfx's requests get theirs. The plugin never holds a key, as with `fx.models.ask` ("Keys stay on the server").

3. **How hard a call's turn thinks:** `fx.chats.send` takes `effort`, such as `low`, for the turn its message starts in the bot's own chat. A turn it joins keeps its own level. Plugin sessions have had `effort` since 0.10.0, but a call has to be in the bot's own chat, where `subagents_start` works and the owner reads it.

Any plugin can use the first two: an image plugin bringing fal.ai, a search plugin bringing a search API. `effort` works for a plugin's own sessions too, so a room's bots think less on a call.

**Rooms need no more core.** Chat rooms keeps who answers. It offers phone a little more with `fx.provide`, and phone names it under `needs` as optional, as the computer does. Subagents learn to start from a room, through what chat rooms offers.

**Fewer ways for a carrier, not more.** `phone-signalwire` 0.2.0 is SignalWire's SIP account and nothing else. Its RELAY way, `relay.ts` with its 419 lines, goes. So do phone's text lines, `{ "line": 1 }` and `2`, which only RELAY used. This release waits until SIP works well, so no owner is left without a way to call.

**Not core, but needed:** web.fxbot.sh sends `permissions-policy: … microphone=()` on the shell and on every frame ([`relay/worker.ts`](../../packages/web-app/relay/worker.ts)). That blocks the microphone for fxbot's page over web pairing, though the shell's iframe asks for it with `allow="…microphone…"`. It changes, and web.fxbot.sh is deployed again.

## 1. Research

### fxbot today

- **phone 0.1.2** (on `release/0.12.0`):
  - `call.ts` holds the conversation and its rules: the owner's `pause`, the bot's own voice matched in order for 1.5 seconds, cutting in on two words, "stop" and "hold on", and the greeting playing through.
  - A provider's line passes text both ways (`{ "line": 2 }`: `hearing`, `heard`, `played`, `say`, `stop`).
  - SignalWire's RELAY speaks and listens.
- **Why that can't be fixed in phone:** two calls on dev proved that SignalWire gives nothing it hears while a play runs. The owner's 8 words, said over a sentence, came at once, 32 and 97 ms into the next line. One sentence per play let them in at each sentence's end, but the pacing was wrong, and it was undone. With text in and text out, the bot can't be cut off mid-sentence, and fxbot can't touch the noise.
- **The sidekick's parts are built** ([subagents](../../plugins/subagents/README.md)):
  - `subagents_start` runs the bot again on one task, in the background, "with the bot's instructions, tools, computer, skills, and memories", and the bot "can start several, for parallel work, and keep talking with you".
  - `subagents_tell` brings what can't wait into the chat while the subagent works. Reports come back together as one message, which joins the bot's turn or starts its next.
  - `subagents_list` answers "how's it going?"
  - herdr's `herdr_prompt` sets an agent to work in its pane, and the computer's tools work for a subagent as for the bot.
  - phone already speaks the bot's reply to a report while a call lasts, and its note on a call says to hand long work to a subagent.
- **Chat rooms already decide who answers** ([chat-rooms](../../plugins/chat-rooms/README.md), 0.5.2):
  - A message wakes the bots it tags (`<@bot:id>`, or `<@all>`). One that tags no one wakes the lead, or every bot in order, by the room's setting.
  - The lead's skill, `room-lead`, has it answer or tag "another bot in the room [that] fits it better".
  - A reply that tags another bot wakes that bot next, up to 3 tags a reply and 10 replies a message. A new message from the owner replaces the queue. Stop ends the reply being written.
  - Each bot answers in a session of its own for the room.
  - The room's stream gives `reply` with the bot and its text so far, then each `message`, the `queue`, and `idle`.
  - The room's header has a place, `chat-rooms.room-header`, for other plugins. It offers `roomOf(session)` and `rooms()`.
  - `subagents_start` works "only in the bot's own chat with you, not in a room".
- **What fxbot has for this:**
  - **Requests a plugin makes with a provider's login:** `fx.models.ask` (keys stay on the server), and the SDK's `embeddingsTarget` (an address and credentials for a provider kind that serves something).
  - **The catalog** (`packages/sdk/src/catalog.ts`): checked entries with `connect` key, url, or device; `headers` with `{apiKey}` (which fits `xi-api-key: {apiKey}` and `Authorization: Token {apiKey}`); `keyCheck`; and `models`. It arrives with fxbot's lists, hourly.
  - **Sockets:** `fx.socket`, a plugin's WebSocket, carries binary both ways, with `bufferedAmount`. Web pairing's bridge carries WebSockets, binary included, over its data channels (`plugins/web-pairing/fxbot/bridge.ts`).
  - **Node 22's own `WebSocket`** sends custom headers. Checked here: a server saw `authorization: Token test-key` and `xi-api-key: k2`. So fxbot can open a provider's socket with the key and hand it over.

### The references

| Project | Where the audio goes | Turn end | Cutting in | Echo | Notes |
|---|---|---|---|---|---|
| [eve's voice template](https://github.com/vercel/eve/blob/53cecd7e58f1a4e6f68059a3d4f9e86e83950a28/apps/templates/eve-voice-template/README.md) | The browser's WebSocket goes straight to AI Gateway's GPT-Live-1. The server mints a one-use secret. | The model's | On speech start, the AI SDK stops playback and truncates the reply to the ms played ([realtime-session.ts](https://github.com/vercel/ai/blob/a457990a33491a9bfd6e7a48318d23a16c0ac95d/packages/ai/src/realtime/realtime-session.ts#L1042-L1055)) | The browser's defaults | The realtime model hands work to eve. Calls are capped at 10 minutes, and hanging up cancels eve's turn. |
| [Pi's p2 voice](https://github.com/earendil-works/pi/blob/c11a73bfba1310dc4075ad836254ea87003f409b/apps/p2/plugins/voice/server.ts) | The page's own WebSocket: 16 kHz PCM16 up, PCM16 chunks down, with the speech engines on the server | Silero VAD and Parakeet on CPU. The owner's pause is 0.5 to 2 seconds, 0.8 by default. | Sound only gets the bot ready. Only a real word in a transcript cuts it, and with none in 1.5 s it plays on ([interruption.ts](https://github.com/earendil-works/pi/blob/c11a73bfba1310dc4075ad836254ea87003f409b/apps/p2/plugins/voice/interruption.ts)) | The browser's echo cancellation on speakers and off for headphones. Three or more words, all from the bot's recent text, count as echo. The mic is held 500 ms after playback. | Replies are spoken by sentence. A prompt asks for short replies and hands long work to a subagent. It holds the screen awake. |
| [OpenBot](https://github.com/CopilotKit/OpenBot/blob/9a895cb025c1942f94f4e1ea50dbeaa4d82e66dc/docs/configuration.md) | OpenAI Realtime over WebRTC, or xAI over WebSocket, from the browser | `semantic_vad` or `server_vad` | The provider truncates, or the page sends the ms played | All three constraints on, and the mic stays open | One `ask_agent` tool. A cut reply is saved as "[Response interrupted…]". 15-minute cap. |
| [OpenDots](https://github.com/CopilotKit/OpenDots/blob/0d043bafc8dfc02fc722aa767aa30910759b1853/src/server/voice.ts) | OpenAI Realtime over WebRTC | `semantic_vad` | The provider's | The browser's | `ask_compute`, 6 a call. A call receipt is posted at hang-up. |
| OpenDuet, openmuse | OpenDuet merged into OpenBot, and openmuse's voice is a roadmap item | | | | |
| [Grok Bot](https://docs.x.ai/grok-bot/chat-and-collaboration#start-a-voice-chat) | Not published. xAI's voice API is a WebSocket at 8 to 48 kHz. | `server_vad` | `speech_started`, then truncate | Not published | A voice chat ends when a phone call takes the audio. |
| herdr | Mobile dictates on the device and pastes the text into the box ([herdr mobile](https://herdr.dev/mobile/)) | | | | |

Pi's p2 is the shape for fxbot: the page's own socket, the speech engines behind the server, keys never in the page, and only words cutting in. eve, OpenBot, and OpenDots send audio from the browser straight to a speech-to-speech model. That would make the model the brain, not the bot's own model and tools, and put a provider's secret in the page.

### Voice frameworks: Pipecat and LiveKit Agents

- **The parts:**
  - Transport in and out, with a playback clock.
  - A voice detector, and speech to text, streamed or one stretch at a time.
  - An end-of-turn decision, then the model.
  - Text to speech, one sentence at a time.
  - Interruption, and a record of what was heard.

  LiveKit's `AgentSession` takes `stt`, `vad`, `llm`, and `tts`, with the turn rules apart from the adapters ([agent_session.py](https://github.com/livekit/agents/blob/e95d482a09331c418bd103b4f8e0f0e2450072f0/livekit-agents/livekit/agents/voice/agent_session.py#L422-L454)). Pipecat splits turn starts, stops, and mutes into strategies.
- **Latency:** Pipecat's primer adds up to about 1.3 seconds from the user stopping to the first audio, and aims for 1.5 ([voiceaiandvoiceagents.com](https://voiceaiandvoiceagents.com/)):

  | Step | Time |
  |---|---|
  | Speech to text and end of turn | 300 ms |
  | The model's first token | 650 ms |
  | A sentence | 20 ms |
  | Text to speech's first audio | 120 ms |
  | Codecs, network, and devices | about 200 ms |

  The end of turn is the knob. Deepgram's Flux claims about 260 ms with a model ([Flux](https://developers.deepgram.com/docs/flux/quickstart)). Pipecat's Smart Turn v3 is an audio model of 8.7 MB for 23 languages, about 12 to 65 ms on a CPU, under BSD-2 ([smart-turn](https://github.com/pipecat-ai/smart-turn)). LiveKit's turn model may only be used with LiveKit Agents ([license](https://huggingface.co/livekit/turn-detector)).
- **Interruption:**
  - LiveKit asks for 0.5 seconds of speech, and plays on after 2 seconds with no transcript, which it calls a false interruption ([turn.py](https://github.com/livekit/agents/blob/e95d482a09331c418bd103b4f8e0f0e2450072f0/livekit-agents/livekit/agents/voice/turn.py#L163-L211)).
  - Pipecat starts a turn on enough words ([min words](https://github.com/pipecat-ai/pipecat/blob/188813a94823e50980c69ca6b71c10ee11501d69/src/pipecat/turns/user_start/min_words_user_turn_start_strategy.py)).
  - To stop the bot, both empty the output queue and tell the line to drop what it holds: Twilio's and Telnyx's `clear` ([twilio.py](https://github.com/pipecat-ai/pipecat/blob/188813a94823e50980c69ca6b71c10ee11501d69/src/pipecat/serializers/twilio.py#L234-L236)).
- **What the model learns of a cut reply:** only what was played. LiveKit's text is lined up with the audio played ([agent_activity.py](https://github.com/livekit/agents/blob/e95d482a09331c418bd103b4f8e0f0e2450072f0/livekit-agents/livekit/agents/voice/agent_activity.py#L3657-L3710)). phone's `played` and "(They cut you off after: …)" already do this, by sentence.
- **Adapters:**
  - LiveKit's speech to text is a stream that takes audio frames and gives `START_OF_SPEECH`, interim, final, and `END_OF_SPEECH` ([stt.ts](https://github.com/livekit/agents-js/blob/f170f632142cf71d7e17b99cefff9cac3135ffc7/agents/src/stt/stt.ts)).
  - Its text to speech takes text and gives audio frames, with flush and close ([tts.ts](https://github.com/livekit/agents-js/blob/f170f632142cf71d7e17b99cefff9cac3135ffc7/agents/src/tts/tts.ts)).
  - A batch model becomes a stream with a voice detector in front (`StreamAdapter`).

### Live voice models: options, not the bot

A live voice model hears and speaks in one model, so it backchannels, takes turns, and lets the owner cut in as a person does. But it replaces the bot's loop: it decides what's said. Even handing work to an agent, it answers small talk itself and says the agent's answers "in its own words", as eve's template does. So it can't be the bot. It could be the bot's ears and mouth only if it passes the bot's words through unchanged, and that's a test, in the checklist, not the plan.

- **OpenAI's GPT-Live 1** ([model](https://developers.openai.com/api/docs/models/gpt-live-1), [launch, 2026-09-10](https://openai.com/index/introducing-gpt-live-1-in-the-api/)):
  - It "listens and speaks at the same time" and "reasons over incoming and outgoing audio together", handling background noise and silence. OpenAI reports 30 points better on Full Duplex Bench than GPT-Realtime-2.1, and a customer reports interruptions cut by almost 80%.
  - Only the Live endpoint, `v1/live/sessions`, serves it, over WebRTC, a WebSocket, or a sideband WebSocket. It takes function calls, and has "Telephony support".
  - $0.05 a minute active and $0.02 on standby, billed by the second. Custom voices are by sales. GPT-Live 1.1 is listed on AI Gateway.
  - **Delegation** ([guide](https://developers.openai.com/api/docs/guides/live-delegation)):
    - In *client delegation*, "your application prepares the context, runs an agent or workflow, and sends results back to GPT-Live".
    - `session.delegation.created` starts one, and carries only metadata.
    - `session.thinking.append` is "quiet context the model can use later without speaking it". `session.commentary.append` holds "results GPT-Live should say aloud", up to 500 tokens each.
    - "Live speech and delegated work continue independently", with an acknowledgement by default.
  - **eve's voice template** is that, with eve as the agent: GPT-Live "does the listening, speaking, and turn-taking", hands off "anything beyond small talk", and is given "the agent's answer to say in its own words". Progress shows on screen, and approvals are answered on screen or by naming an option. Hanging up cancels eve's turn.
  - **Not verified:** the Live endpoint's WebSocket address and its auth from a server with an API key, its audio formats, and the event that says the owner cut in.
- **ElevenLabs' agents** ([client tools](https://elevenlabs.io/docs/agents-platform/customization/tools/client-tools), [events](https://elevenlabs.io/docs/eleven-agents/customization/events/client-events)):
  - An agent is ElevenLabs' listening, a model of its own, and an ElevenLabs voice, with turn-taking. It's turn by turn, not full duplex.
  - A conversation runs over a WebSocket (`wss://api.elevenlabs.io/v1/convai/conversation?agent_id=…`, from a third party). Client tools run in whatever holds the conversation: `client_tool_call` comes in, and `client_tool_result` goes back with its id. So fxbot holds the conversation and hands off through one tool.
  - A 2026 fix stopped the sound of a tool call being taken as the user's speech.
  - **Not verified:** making an agent through the API, the WebSocket's auth from a server, how progress is passed while a tool runs, and the price a minute.
- **Others, later:** Gemini's Live API, xAI's `grok-voice-3.0` at $0.08 a minute, and Bedrock's Nova Sonic, each with function calls.

### Several bots on one call

Nothing found does what the owner asked: named bots with real tools on one call, which the owner addresses by name, and which hand the floor to each other. One search, so something may have been missed.
- [AI Group Call](https://completeaitraining.com/ai-tools/ai-group-call/), a consumer app, puts up to six AI characters on a voice call, each with a name and role. They "go quiet the instant you start speaking".
- [Telnyx's multi-participant calls](https://telnyx.com/resources/multi-participant-voice-ai-calls) are one assistant with several people. It tracks who's speaking and stays quiet when it isn't addressed.
- A [Gemini multi-speaker demo](https://fishjam.swmansion.com/blog/voice-ai-how-we-built-a-multi-speaker-ai-agent-using-gemini) found an agent for each client "chaotic", with everyone speaking at once. It found "floor control", deciding who answers, the hard part.
- Aircall's and LiveKit's multi-agent setups pass a caller from one agent to the next, one at a time.

So the floor is the design: who answers is the room's, which it already decides in text, and only one bot speaks at a time.

### Voice providers: the logins fxbot already has

As read on 2026-11-25. Prices are list prices. "Same key" means the key the owner gave for chat works.

| Provider | Listens | Speaks | Notes |
|---|---|---|---|
| **Mistral** | A realtime WebSocket, `voxtral-mini-transcribe-realtime-3`, 16 kHz PCM16, sending `turn.start`, `turn.eager_end`, `turn.resume`, and `turn.end`; and batch `/v1/audio/transcriptions` ([realtime](https://docs.mistral.ai/studio/audio/speech-to-text/transcribe-in-realtime), checked) | `/v1/audio/speech`, and a realtime WebSocket that takes text in pieces | Same key. About $0.006 a minute to listen, and $16 per million characters to speak. A LiveKit user measured about 1.2 s to first audio. |
| **xAI** | A WebSocket at 8 to 48 kHz with end-of-turn detection, and batch ([voice](https://docs.x.ai/developers/model-capabilities/audio/voice)) | A WebSocket, μ-law to MP3 | Same key. $0.20 an hour to listen as it streams, and $15 per million characters. |
| **Gemini** | `gemini-3.5-transcribe-live` on the Live API, with speech start and end on the server, in 10-minute sessions | `gemini-3.8-flash-tts` and `-lite-tts`, streaming 24 kHz PCM or 8 kHz μ-law | Same key (AI Studio). The price doubles on 2027-01-01 ([pricing](https://aistudio.google.com/docs/pricing)). |
| **OpenAI** | `gpt-live-transcribe` over a Realtime WebSocket, with no turn detection on the server: the client commits each turn. Batch `gpt-transcribe`. | `/v1/audio/speech` until **2027-01-06**, when `tts-1`, `tts-1-hd`, and `gpt-4o-mini-tts` shut down. The replacement OpenAI names, `gpt-realtime-2.1-mini`, runs only on the Realtime API ([deprecations](https://developers.openai.com/api/docs/deprecations), checked). | Same key. Whisper and the `gpt-4o` transcribers shut down on 2027-02-26. |
| Azure OpenAI | The same models, and realtime transcription | `gpt-4o-mini-tts` | Same key. Azure Speech's own voices need another resource. |
| Groq | Batch Whisper, OpenAI-shaped, at $0.04 an hour | Batch Orpheus, WAV, 200 characters a request | Same key. Fast enough to transcribe one stretch at a time. |
| Together, DeepInfra, OpenRouter | OpenAI-shaped batch, and Together's realtime WebSocket | OpenAI-shaped `/audio/speech`, plus Together's WebSocket | Same key |
| Cloudflare Workers AI | Deepgram's Flux, `@cf/deepgram/flux`, over a WebSocket; Whisper | Deepgram's Aura-2 and MeloTTS | Same account and token, at `api.cloudflare.com/client/v4/accounts/{id}/ai/run/@cf/deepgram/…` ([Flux there](https://developers.cloudflare.com/workers-ai/models/flux/)) |
| Qwen, MiniMax | Qwen's realtime ASR over a WebSocket with `server_vad` | Qwen's and MiniMax's realtime WebSocket voices | Same key, in the key's own region |
| Vertex | Chirp 3 (streaming not confirmed) | Chirp 3 HD, streaming | Whether the owner's Vertex login reaches the Cloud Speech APIs isn't known. |
| LiteLLM, vLLM | Proxies `/audio/transcriptions` and `/v1/realtime` | `/audio/speech` | The owner's own server |
| Vercel and AI Gateway | Batch REST in a shape of its own. Streaming is documented only through the AI SDK, which fxbot doesn't use. | Batch, the same | Later, if ever |
| NVIDIA, Hugging Face, Bedrock, Baseten | gRPC trial terms; batch through client libraries; Nova Sonic, speech to speech only; dedicated deployments | | Not first |
| **No speech:** Anthropic, DeepSeek, Kimi, Cerebras, Nous, OrcaRouter, OpenCode, and the ChatGPT and Grok plan sign-ins ("Your ChatGPT subscription does not provide you with API access") | | | |

### Voice providers: the services people use

| Service | Listens | Speaks | Price, and free credit | Turns and cutting in |
|---|---|---|---|---|
| **Deepgram** ([pricing](https://deepgram.com/pricing)) | Flux over `wss://api.deepgram.com/v2/listen`: linear16 and μ-law, 8 to 48 kHz | Aura-2 over `/v1/speak`, with `Speak`, `Flush`, and `Clear` | Flux $0.0065 a minute, Aura-2 $0.030 per 1,000 characters. $200 of credit. | End of turn at about 260 ms, eager end, and resume. `Authorization: Token`. |
| **ElevenLabs** ([pricing](https://elevenlabs.io/pricing/api)) | Scribe realtime: PCM or μ-law, committed by `vad` or `turn_prediction` | Flash v2.5 over a multi-context WebSocket, about 75 ms | $0.22 an hour; $0.04 per 1,000 characters (Flash). 10,000 to 20,000 characters free. | Contexts cut on their own. `xi-api-key`. |
| Cartesia ([pricing](https://cartesia.ai/pricing)) | Ink-2's turns WebSocket: the same `turn.*` names as Mistral's | Sonic-3.6 over a WebSocket, with a context per reply, `continue`, and `cancel` | About $39 per million characters on Startup | `X-API-Key` and a version |
| AssemblyAI ([pricing](https://www.assemblyai.com/pricing)) | Streaming with `end_of_turn`, at $0.30 an hour | TTS-1 over a WebSocket, and OpenAI-shaped | $50 free | `Authorization` |
| Soniox, Speechmatics, Gladia | Streaming with endpoint or end-of-turn events, $0.12 to €0.68 an hour | Soniox and Speechmatics speak too | | |
| Rime, Inworld, Fish Audio | | WebSocket voices, some with μ-law | | |
| **Gone:** Hume's voice API ended on 2026-11-13, LMNT shut down, and PlayHT's API ended on 2025-12-31. | | | | |

**One adapter serves many,** since they share a few shapes:
- **OpenAI's HTTP shape,** `/v1/audio/transcriptions` and `/v1/audio/speech`: OpenAI (until its shutdowns), Azure, Groq, Mistral, Together, DeepInfra, OpenRouter, AssemblyAI's voice, LiteLLM, vLLM, and every local speech server below.
- **Deepgram's WebSockets:** Deepgram, and Cloudflare's hosted Flux and Aura.
- **Turn events:** Mistral and Cartesia send the same `turn.*` names. Flux's `StartOfTurn`, `EagerEndOfTurn`, `TurnResumed`, and `EndOfTurn`, AssemblyAI's `end_of_turn`, and ElevenLabs' commits all map to one: the words so far, and the turn's end.

### On the device, and on the owner's machine

**The browser's own speech:**

| | Listening (`SpeechRecognition`) | Speaking (`speechSynthesis`) |
|---|---|---|
| Chrome on a computer | Google's servers by default. On the device with `processLocally` after `install()`, about 60 MB a language ([blink-dev](https://groups.google.com/a/chromium.org/g/blink-dev/c/VNOok2dbmHM)). A continuous session ends after 15 s of silence and is started again. | Its "Google" voices need the network and break past about 14 s; the OS's voices are local. |
| Chrome on Android | Works, in the cloud. `continuous` has no effect. | Works |
| Firefox on a computer (161) | Only on the device | Works |
| Safari in a tab | Works; asks to send audio to Apple | The OS's voices, after a tap on iOS |
| **An iPhone's home-screen app** | **None**: "not available in… web apps added to Home Screen" ([WebKit 225298](https://bugs.webkit.org/show_bug.cgi?id=225298)). Since iOS 26, every site added to the Home Screen opens that way. | Works |

So "This device" can always speak, but it can't listen in the fxbot app on an iPhone, which is how most owners reach it.

- **Echo cancellation in the page** (`getUserMedia` with `echoCancellation`):
  - **Chrome on a computer** cancels everything the browser plays, Web Audio and `<audio>` included ([media_switches.cc](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/media/base/media_switches.cc)). The old rule, that it covers only WebRTC's audio, is out of date there.
  - **Android** relies on the OS's canceller, unverified.
  - **On iOS,** keep it on: with it off, audio moves to the earpiece. With it on, iOS 26.2 to 27.x crackled ([WebKit 326286](https://bugs.webkit.org/show_bug.cgi?id=326286)), reported fixed in 27.2.
  - Echo can't be cancelled on the server: it needs what the speaker played lined up with the microphone, sample for sample.
- **Models in the page:**
  - Silero VAD as `@ricky0123/vad-web`, about 2.3 MB.
  - Moonshine at about 80 MB, Kokoro.js at 92 MB or more, and Piper.

  None of these has been measured on a phone.
- **Speech servers the owner can run.** Each speaks OpenAI's shape, so one adapter covers all of them:
  - [Speaches](https://github.com/speaches-ai/speaches), MIT: faster-whisper to listen, and Kokoro and Piper to speak. Both directions in one container, on CPU or GPU.
  - LocalAI.
  - whisper.cpp's server, with `--inference-path`.
  - Kokoro-FastAPI: first audio in about 300 ms on a GPU, and under 1 s on an M3 CPU.
  - vLLM, for Voxtral realtime.
  - llama.cpp's `/v1/audio/speech`.
  - Ollama's new `/v1/audio/speech` ([Phonon](https://ollama.com/blog/speech-models), on Apple silicon so far).

  Kyutai's servers and Unmute speak protocols of their own, and need a 16 GB NVIDIA GPU.

### Phone lines with nothing connecting in

The owner's rule stands: nothing on the internet connects to fxbot. Every carrier's audio stream has the carrier connect in: SignalWire's stream and tap, Telnyx's media streaming, Twilio's Media Streams, Vonage, and Plivo. What's left is SIP registered outward, with fxbot as a softphone:

| Carrier | Audio with nothing connecting in | Through the router | Price, US, a minute |
|---|---|---|---|
| **SignalWire, a SIP credential** | Likely: fxbot registers and calls out, with `call_handler: passthrough` and `send_as` the number ([SIP endpoints](https://signalwire.com/docs/apis/rest/sip-endpoints/create-sip-endpoint.md)) | Undocumented. FreeSWITCH, which SignalWire runs on, learns where RTP really comes from by default. | $0.003 for SIP, plus $0.008 for the phone call |
| Telnyx, a credential connection | Likely: REGISTER over TLS, and Telnyx re-uses the connection ([registration](https://support.telnyx.com/en/articles/4363904-sip-registration)) | A private address in the SDP is refused with 488, so fxbot puts the address STUN finds there | $0.005 |
| Twilio Elastic SIP Trunking | Yes, outbound only | The only documented latch: a symmetric RTP switch, off by default ([risks](https://www.twilio.com/docs/sip-trunking/risks-associated-with-using-symmetric-rtp)) | $0.010 |
| VoIP.ms | Yes | One user behind CGNAT lost audio one way 10 to 15 minutes into calls | $0.01 |
| Telnyx WebRTC | Through any router | | Its use policy bans reverse engineering, and only its SDKs are documented. |

- **The Node code to copy:** [ringcentral-softphone](https://github.com/ringcentral/ringcentral-softphone-ts) 2.0.0 (MIT). It does SIP over `node:tls`, SDES-SRTP on `node:crypto`, and PCMU or Opus on one `node:dgram` socket, and registers again every 30 s. Its SDP gives the private address, so fxbot learns its public one with STUN.
- **To keep the way through the router open:** CRLF keepalives on the TLS connection, and RTP every 20 ms, silence included.
- **When a real call is still needed:** an installed iPhone app loses the microphone when the screen locks ([WebKit 239602](https://bugs.webkit.org/show_bug.cgi?id=239602)), and CarPlay needs a native app. Driving, a locked phone, and weak data need a phone line.

## 2. Key takeaways

- **Own the audio.** Speech done by the carrier, text in and text out, can't be cut off mid-sentence. Every product that feels instant carries the sound itself.
- **The voice is the bot,** its own model and words. A live voice model replaces the bot's loop, so it's an option to test as ears and mouth only.
- **A sidekick talks and works at once.** A call's turns stay short. Anything longer goes to the background, to subagents with the bot's tools, computer, and herdr, or to a herdr agent, and the bot comes straight back to the conversation. Findings and reports come back on their own, and the bot tells the owner at a pause, never over them.
- **A fast talker and deep workers.** A call's turns think less, so the first words come quickly. Subagents think at the bot's own level, or the subagents plugin's `thinking`.
- **A room is a conference call.** The room already decides who answers. phone adds three things: spoken names become tags, each bot gets a voice of its own, and only one speaks at a time.
- **One reply, one voice context,** in the bot's own words. Its text streams into one speaker context as the model writes, so the pacing flows: ElevenLabs' stream-input, Cartesia's `continue`, or Deepgram's `Flush`. One request per sentence sounded wrong on dev.
- **One voice loop, for the app and the line.** `voice.ts` makes a `Line` out of a transport, a listener, and a speaker. `call.ts` keeps the conversation and every rule it has: the pause, the echo window, cutting in, and "stop".
- **Only words cut the bot off.** With a listener that gives words as they come, two words do, as now. With one that doesn't, 700 ms of the owner's voice does, since the browser's echo cancellation has already taken the bot out. phone's echo window stays as the second layer, as Pi has one.
- **Stopping is instant because phone owns playback.** On a cut, phone tells the page or line to drop what it holds, at once, and learns how much had played.
- **A small interface, and four adapters cover most providers:**
  - OpenAI's HTTP shape: local servers and ten hosted providers.
  - Deepgram, with Cloudflare's hosted copy.
  - ElevenLabs.
  - Mistral's realtime listening.
  - And the browser's own speech, in the page.
- **End of turn from the provider when it has one,** such as Flux, Voxtral, Scribe, xAI, or Gemini Live, with the owner's `pause` as its wait. Otherwise phone's hold, after a simple voice detector. Smart Turn comes later, if it's needed.
- **Keys stay on the server.** fxbot opens the provider's socket for phone, and the page only ever talks to fxbot.
- **OpenAI's `/v1/audio/speech` has six weeks left,** so it's never the default speaker. OpenAI's own voice is moving to GPT-Live and its Realtime models.
- **ElevenLabs first,** the owner's favorite: Scribe to listen, and Flash to speak.
- **Phone lines are SIP, registered outward,** with STUN, SRTP, and RTP that never stops, and they're proven on a real network before they're built.

## 3. Implementation

### The pieces

```text
packages/sdk/src/
  catalog.ts          models "none", hosts
  plugins.ts          a plugin's providers, in the catalog while it's added
  providers.ts        fx.providers: list, fetch, socket
  plugin-api.ts       the types and their docs
  index.ts            effort on fx.chats.send, for the turn a message starts
packages/ui/src/
  add-provider.tsx    a plugin's group
  (model pickers)     skip models "none"
plugins/phone/        0.2.0, minFxbot 0.12.0
  plugin.json         providers: Deepgram, ElevenLabs, a speech server
  fxbot/voice.ts      the voice loop: a Line from a transport, a listener, and a speaker
  fxbot/speech.ts     the listener and speaker types, and which adapter serves which kind
  fxbot/speech/       openai.ts, deepgram.ts, elevenlabs.ts, mistral.ts
  fxbot/talk.ts       the app's call: its socket and what crosses it
  fxbot/room.ts       a room's call: spoken names to tags, a voice for each bot, and the floor
  fxbot/call.ts       the sidekick on a call, the app's greeting, a voice event, and no more text lines
  fxbot/line.ts       one contract left, { "line": 3 }: audio
  fxbot/sip.ts        part 2: a SIP user agent, offered to carriers
  fxbot/migrations/   0002_voice.sql
  fxbot/page.jsx      Talk, the call's screen, the microphone and playback, this device's speech, Voice settings
plugins/chat-rooms/  0.6.0: offers post, stop, on, and wake; a message's label and note
plugins/subagents/   0.3.0: starts from a room, and reports there
plugins/phone-signalwire/  part 2: 0.2.0, SignalWire's SIP account only; relay.ts goes
packages/web-app/relay/worker.ts  the microphone allowed
```

### Core: provider entries a plugin brings

- **The manifest:** `plugin.json`'s `extensions["sh.fxbot"].providers` is a list of catalog entries. Each passes `usable()`, and must have `models: "none"`. An id fxbot's own catalog has, or another plugin's, is left out, with a line in the plugin's log.
- **`models: "none"`** is new: a provider that serves no chat model. The page doesn't ask its server for models.
- **`hosts`** is new and optional: other origins of the same service, such as `wss://api.deepgram.com`. A provider's hosts are its base URL's origin, the `wss:` or `ws:` twin of that origin, `keyCheck`'s origin, and `hosts`.
- **The Add provider page** lists a plugin's entries in a group of their own, titled with the plugin's name ("For Phone"), while the plugin is added. They're added as any key or URL entry is: the key is sealed, and checked at `keyCheck`.
- **Places that pick a model skip them:** a bot's model, idle compaction's model, and memory search. Settings › Providers lists them, marked with their plugin.
- **When the plugin is removed:** the entries leave the Add page. A provider added from one stays listed, marked "Phone isn't added", and can be removed. Its key stays sealed until it is.

phone's entries:
- **Deepgram:**
  - base `https://api.deepgram.com/v1`
  - `headers: { "Authorization": "Token {apiKey}" }`
  - `keyCheck: https://api.deepgram.com/v1/projects`
  - key page `https://console.deepgram.com/`
- **ElevenLabs:**
  - base `https://api.elevenlabs.io/v1`
  - `headers: { "xi-api-key": "{apiKey}" }`
  - `keyCheck: https://api.elevenlabs.io/v1/user`
- **Speech server:**
  - `connect: "url"`, default `http://localhost:8000/v1`
  - its about: "Speaches, LocalAI, Kokoro-FastAPI, whisper.cpp, or any server with OpenAI's audio endpoints, on this machine"
  - In a container, its hint says what Ollama's does about localhost.

### Core: `fx.providers`

```ts
providers: {
  /** The providers added, with no key: each one's id, the catalog entry it came from, its name, and the entry's. */
  list(): Promise<{ id: string; kind: string; name: string; label: string }[]>;
  /** A request to a provider's own hosts, with its key or sign-in added as its entry says. Since 0.12.0. */
  fetch(id: string, url: string, init?: RequestInit): Promise<Response>;
  /** A WebSocket to a provider's own hosts, opened with its key or sign-in in its headers. Since 0.12.0. */
  socket(id: string, url: string, protocols?: string | string[]): Promise<WebSocket>;
};
```

- **How the key is added:** with its entry's `headers` when it has them, or `Authorization: Bearer`, through `entryFetch`, which keeps a key out of error bodies. Vertex's token, Hugging Face's, and a Vercel login, whose hosts are AI Gateway's, work as they do for chat.
- **What it refuses:**
  - a URL off the provider's hosts (400)
  - a ChatGPT or Grok plan ("This sign-in has no API for that.")
  - a provider with no key that needs one
- **What it never answers:** a key.
- **Docs:** the plugin API reference, and a "For plugins" line in the CHANGELOG. Nothing is removed, so `plugin-breaks.json` gets no line.

### phone: the voice loop (`voice.ts`)

`voiceLine({ transport, listener, speaker, pause }, events) → Line`, the same `Line` that `call.ts` holds today:
- **The transport:**
  - The app's socket, from `talk.ts`, or a SIP call, from `sip.ts`.
  - Audio comes in as 16 kHz PCM16 frames, and the transport sends frames out.
  - `clear()` drops what it holds and answers how much had played.
  - It reports the marks played: one after each sentence.
- **Hearing:**
  - Frames go to the listener. Its words as they come become `hearing`, and its finished words `heard`.
  - A listener with turns, such as Flux, Voxtral, or Scribe, ends a turn itself, with the owner's `pause` as its wait (Flux's `eot_timeout_ms`, and the others' like it). phone then holds nothing more.
  - A listener without turns gets phone's own: a voice detector, below, cuts the stretches it sends, and `call.ts`'s hold does the rest, as now.
- **The voice detector:** energy against a noise floor that follows the room, about 40 lines. It cuts stretches for a batch listener, and gives `voice(ms)` while the owner speaks, for a listener that has no words as they come.
- **Speaking:**
  - `say(text)` adds a sentence to the reply's text, which streams into one speaker context a reply, so the voice's pacing carries across sentences. Audio goes out a second ahead at most, so a cut drops little, with a mark after each sentence.
  - The mark played becomes `played`.
  - `stop()` aborts the speaker, clears the transport, and drops what waits.
  - `speaking` is true while anything is queued or playing.
- **Formats:**
  - 16 kHz PCM16 in the app.
  - 8 kHz μ-law on a line. A provider is asked for μ-law where it offers it (Deepgram, ElevenLabs, xAI, Gemini, Cartesia), and phone resamples where it doesn't.

### phone: `call.ts`

- **The app's greeting is "Hey, what's up?"** A phone call keeps "Hey, this is your fxbot Bob…", since the owner may not know who's calling. In the app, the first message tells the bot "You're in a voice chat with the owner in the app" in place of the call's note.
- **A `voice(ms)` event:** 700 ms of the owner's voice while the bot speaks cuts it off, after the greeting, for a listener with no words as they come. Words still decide with any other listener.
- **Everything else stays:** the pause, the echo window, "stop", "hold on", "One moment.", and the call's limits.
- **The text lines go.** `call.ts` gets its `Line` from `voice.ts`, never from a carrier, so the `turns` flag and the line 1 paths go.

### phone: listeners, speakers, and adapters (`speech.ts`)

```ts
export type Heard = { type: "partial"; text: string } | { type: "final"; text: string; turn: boolean };
export type Listener = { write(pcm: Int16Array): void; close(): void; heard(on: (h: Heard) => void): void };
/** Audio for one reply, whose text streams in as the model writes it, at the rate asked, ending early when signal
 * aborts. Marks say which sentence plays from where. One context a reply keeps the voice's pacing. */
export type Speaker = { speak(text: AsyncIterable<string>, signal: AbortSignal): AsyncIterable<{ audio: Int16Array | Uint8Array } | { mark: number }> };
export type Adapter = {
  /** Which providers it serves, by catalog entry: "deepgram", "cloudflare". */
  kinds: string[];
  listen?(p: ProviderId, o: { model: string; rate: number; mulaw: boolean; pause: number; hints: string[] }): Listener;
  speak?(p: ProviderId, o: { model: string; voice: string; rate: number; mulaw: boolean }): Speaker;
  voices?(p: ProviderId, model: string): Promise<Voice[]>;
  models: { listen?: string[]; speak?: string[] };
};
```

| Adapter | Listens | Speaks | Serves |
|---|---|---|---|
| `openai.ts` | `/audio/transcriptions`, one stretch at a time, as the voice detector cuts them | `/audio/speech`, one sentence at a time, PCM, since the shape has no context to stream into | openai (until its shutdowns), azure, groq, mistral, together, deepinfra, openrouter, litellm, vllm, and phone's speech server |
| `deepgram.ts` | Flux over `/v2/listen`, with turns | Aura-2 over `/v1/speak`, with `Flush` and `Clear` | phone's deepgram, and cloudflare at `/ai/run/@cf/deepgram/…` |
| `elevenlabs.ts` | Scribe realtime, committed by `turn_prediction` | Flash v2.5 over the multi-context WebSocket, a context a reply | phone's elevenlabs |
| `mistral.ts` | Voxtral realtime, with `turn.*` | (`openai.ts`'s `/audio/speech`) | mistral |
| the page | `SpeechRecognition` | `speechSynthesis` | This device |

- **Next, one file each:** xAI, Gemini (Live transcription and its voices), Cartesia, AssemblyAI, Soniox, Rime, and Inworld.
- **The default listener and speaker** come from what's added: ElevenLabs, then Deepgram, then Mistral, then the OpenAI shape, then This device. OpenAI is never a default speaker.

### phone: a sidekick on a call (`call.ts`)

The bot is the voice, in its own chat, with everything it has: its tools, memory, computer, herdr, and subagents. phone makes a call fast and keeps it a conversation:
- **What the bot is told on a call** (the call's note, and phone's skill):
  - Talk as a person does, in one to three short sentences, and say in a few words what you'll do.
  - A quick look, such as a status, a read, or a list, you do yourself, in the conversation.
  - Anything longer goes to the background, and you come straight back to the owner. That means work on the computer, a herdr agent's task, digging, or anything with more than a couple of tool calls. Start a subagent with the task, or prompt a herdr agent, and say what's under way. Never wait on it in the call.
  - When a subagent tells you something or reports, say what matters, briefly.
  - When the owner asks how it's going, check (`subagents_list`, herdr's agents), and don't guess.
  - Without the subagents plugin, keep each turn short, and say so if a task will take a while.
- **A call's turns think less:** phone sends what the owner says with `effort`: a new setting, `callThinking`, `low` by default, or the bot's own. Subagents think at the bot's own level, as the subagents plugin's `thinking` setting says by default (`same`), unless the owner changes it there.
- **The bot never talks over the owner.** A reply that isn't to what the owner just said waits while the owner is speaking, and plays at their next pause. That covers a subagent's report, what it tells the chat, and "Still working on it."
- **What's under way shows,** in the call's bar: the subagents working, by name, from the bot's panel as it lists them.
- **The owner's words always reach the bot.** They join a running turn, as now. With long work in the background, the call's turn is short, so they rarely wait.
- **On a phone line the same:** a phone call is this conversation too.

### phone: a conference call in a room (`room.ts`)

A call in a room is the room's conversation, said aloud. The room keeps who answers and its limits, exactly as in text. phone adds the voices and the floor:
- **Where:**
  - Talk, in the room's header, through `chat-rooms.room-header`.
  - Call me there, for a phone line.
  - One call at a time still holds. A call's row gets the room.
- **The owner's words go to the room** as their message, labeled **your call**, through chat rooms' `post`.
- **Names become tags:**
  - A bot of the room named at the start ("Bob, …", "Hey Mr Robot, …") or at the end ("…, Bob?") is tagged with the room's token, so the room shows its chip and wakes it.
  - "Everyone", "both of you", or "you all" tags `<@all>`.
  - A name in the middle ("ask Bob about it") tags no one, and the lead decides, as in text.
  - Names match loosely: case, "Mr" and "Mister", a missing space. They're the recognizer's hints, so they're heard as written.
- **No name:** the room's own setting decides. The lead answers, and hands it to the bot that fits better, as its `room-lead` skill says. Or every bot answers in order.
- **Bots address each other** as they do in text. A reply that tags another bot gives it the floor next, and the tag is said as its name: "Mr Robot, can you check the logs?"
- **A voice for each bot:**
  - A bot speaks in its own voice, from its Phone section.
  - A bot with none, in a room, gets one of the speaker's voices that no other bot in the room has, in the room's order, so no two sound alike.
  - The call's bar lights the face of whoever's speaking.
- **One speaker at a time:** replies play in the order the room runs them, each in its bot's voice. A reply that streams in while another plays waits, with a breath, about 300 ms, between speakers.
- **Cutting in:**
  - It stops whoever's speaking, and drops the replies waiting to be said.
  - The owner's next words replace the room's queue, as a typed message does. They carry a note for the bots that isn't shown: "(They cut off Bob after: "…". Mr Robot's reply wasn't heard.)"
  - "Stop" is the room's Stop.
- **The greeting:**
  - In the app, the lead says "Hey, what's up?"
  - On a phone line, the lead says "Hey, it's Bob and Mr Robot. What's up?"
- **Thinking:** a room's turns on a call think at `callThinking`, through `post`'s `effort`.
- **The sidekick in a room:**
  - A bot in a room starts subagents as in its own chat: subagents 0.3.0 drops the "not in a room" rule.
  - Their tells and reports come back into the room through chat rooms' `wake`, which wakes that bot there.
  - Herdr and the room's computer already work in a room.
- **Chat rooms 0.6.0 offers,** besides `roomOf` and `rooms`:
  - `post(room, { text, label, note, effort })`, the owner's message from a call
  - `stop(room)`
  - `on(room, listener)`, the stream's events
  - `wake(session, { text, label })`, a message from another plugin, such as a subagent's report, that wakes the bot whose session it is

  A message keeps its `label`, shown with it, and its `note`, which the bots get and the room doesn't show.

### phone: Voice settings

- **phone's tab gains a Voice section:**
  - **Listening:** a provider and its model.
  - **Speaking:** a provider, its model, and a voice.
  - **The pause,** and how hard a call's turns think, which move here from the settings list.
  - **Defaults:** ElevenLabs when it's added, and otherwise in the order below.

  Each list holds only the providers phone can use, plus **This device**, with a link to add one.
- **A bot's voice,** its Phone section's, is a voice of the speaker chosen, so each bot can sound like itself.
- **Storage:** `0002_voice.sql`, a `voice` table of one row: the listening provider and model, and the speaking provider, model, and voice. `pause` and `callThinking` stay settings.

### phone: the app's call (`talk.ts` and the page)

- **Talk,** in a bot's message box beside Call me, starts a call in the app. The call's bar shows Listening, Thinking, or Speaking, Mute, and End.
  - A call's row has `provider` "app", and shows in Last calls.
  - One call at a time still holds everywhere.
  - Talk shows once the Voice section has both a listener and a speaker, This device included.
- **The page:**
  - `getUserMedia` asks for `echoCancellation`, `noiseSuppression`, and `autoGainControl`.
  - An AudioWorklet sends 16 kHz PCM16 in 20 ms frames over `fx.socket` at `/talk/:bot`. Another plays what comes back, with about 0.3 s held.
  - It answers each mark as it plays, and on `clear`, empties at once and answers the mark it reached.
  - It holds the screen awake.
  - When the app goes to the background, the call ends ("The app went to the background"), since iOS takes the microphone then.
- **What crosses the socket:**

  | Up | Down |
  |---|---|
  | Binary: the microphone, 16 kHz PCM16 | Binary: the bot's voice, 16 kHz PCM16 |
  | `{"played": n}`: mark n has played | `{"mark": n}` after a sentence's audio |
  | `{"heard": {"partial" or "final": text}}`, This device listening | `{"say": n, "text": …}`, This device speaking |
  | `{"mute": true}` | `{"clear": true}`, and `{"state": …}` for the bar |

  That's 32 KB a second each way, which web pairing's data channel carries.
- **This device, listening:**
  - `SpeechRecognition`, continuous, with interim results, started again when it ends.
  - It gets the echo-cancelled track with `start(track)` where the browser has that. Where it doesn't, it stops while the bot speaks, and says so: no cutting in.
  - Each browser listens its own way:
    - Firefox (161 and later) listens only on the device.
    - Safari in a tab listens through Apple.
    - Edge listens on the device in its newest builds.
    - Chrome on a computer listens on the device when `install()` has its language.
  - **Chrome's cloud is a toggle:** "Let Chrome send what you say to Google". It's off until the owner turns it on. With it off and no language on the device, This device doesn't listen in Chrome, and says why.
  - It isn't offered where there's no `SpeechRecognition`: an iPhone's home-screen app, and Firefox on Android.
- **This device, speaking:**
  - `speechSynthesis`, local voices first.
  - `cancel()` on a cut, and an utterance's end as its mark.
  - Text crosses the socket in place of audio.
- **Over web pairing:**
  - The bridge already carries the socket.
  - web.fxbot.sh's policy becomes `microphone=(self "https://*.web.fxbot.sh")` on the shell, and `microphone=(self)` on frames.
  - It's checked first against `npm run dev --prefix packages/web-app`, then deployed with the owner's approval.

### Part 2: phone lines that carry audio

This release waits for it, since RELAY goes. The proof, the first item of its checklist, comes before any of it is built.

- **The contract is `{ "line": 3 }`.** A carrier's line places the call, and carries 8 kHz audio both ways:
  - `place(call)` and `hangUp()`
  - `send(frame)` and `clear()`
  - events `audio(frame)` and `ended(how)`

  phone's voice loop does the rest. It's the only contract left: lines 1 and 2 go with RELAY.
- **phone's `sip.ts`,** offered to its carriers with `fx.provide({ sip })`, about 500 lines with no dependency, shaped after ringcentral-softphone:
  - SIP over TLS on 5061, with digest auth, REGISTER, and INVITE.
  - SDP with the address STUN finds.
  - SDES-SRTP, AES_CM_128_HMAC_SHA1_80, on `node:crypto`.
  - PCMU in 20 ms frames on one UDP socket, sent without a gap, silence included.
  - CRLF keepalives, and a new REGISTER about every 60 s.
- **phone-signalwire 0.2.0 is SignalWire's SIP account:**
  - It makes its SIP endpoint itself through SignalWire's REST API, with the project and token it already holds, `call_handler: passthrough`, and `send_as` the owner's SignalWire number.
  - It places calls through phone's `sip`.
  - `relay.ts` and its voice list go. A bot's voice is phone's now.
- **If SignalWire's audio doesn't come back** through the owner's router, Twilio's Elastic SIP Trunking is next, the one carrier with a documented latch, and then Telnyx, with STUN in the SDP ([Phone: Telnyx](phone-telnyx.md)).

### What the owner sees

1. **Add a voice provider:** Settings › Providers › Add has a **For Phone** group: Deepgram, ElevenLabs, and Speech server. Or they skip this: a Mistral, Groq, OpenAI, or Cloudflare login already serves.
2. **Pick the voice:** phone's tab, Voice. ElevenLabs Scribe and Flash, with a voice they like, or This device.
3. **Talk in the app:** a bot's chat, Talk. "Hey, what's up?" They talk as they would to a person, and the bot answers in its own words within a second or two.
4. **Ask for real work:** "Have a look at why the build failed, and ask the herdr agent on fxbot to rebase." "On it. I've got Curie on the build, and I've asked the fxbot agent to rebase." They keep talking about something else. "Curie found it: a missing env var in CI. Want me to fix it?" It comes at a pause, not over them. They cut in whenever they like, and the chat shows it all.
5. **In a room:** Talk, in the room with Bob and Mr Robot. Bob, the lead, says "Hey, what's up?" They say "Mr Robot, what's the GPU box doing?", and Mr Robot answers in his own voice, then "Bob, you had the logs?", and Bob takes it. A question with no name goes to Bob, who hands it to Mr Robot when it's his. They cut in on either.
6. **On a phone line,** after part 2: Call me rings their phone, in a bot's chat or a room, and the call behaves the same.

### Docs, when it's built

- **How-tos:** Talk with several bots in a room gets a By voice section. Talk with a bot on the phone gets an In the app section, a page on adding a voice provider, and Run speech on your machine, with Speaches.
- **References:** the plugin API's `fx.providers` and `providers` in `plugin.json`, and phone's README with its contract, line 3.
- **The rest:** CHANGELOG, the README's Phases line, and this doc's What the build changed.

### Size

- **Core:** about 150 lines. The catalog takes 15, the manifest's providers 30, `fx.providers` 60, the Add page and model pickers 30, and the types 15.
- **phone, part 1:** about 1,100 lines:
  - `voice.ts`: 250
  - `speech.ts` and its four adapters: 400
  - `talk.ts`: 80
  - `call.ts`: 20
  - the page: 300
  - settings and the migration: 50
- **The sidekick:** about 80 lines in `call.ts`, the note, and the skill, and 20 for `effort` in core.
- **Rooms:** about 150 lines in phone's `room.ts` and the page, 60 in chat rooms, and 60 in subagents.
- **Part 2:** about 600 lines: `sip.ts` 500, and phone-signalwire 100.
- **Removed:** `relay.ts` (419 lines), and phone's text-line paths, about 60.

### Not in this phase

- **Models in the page** (Moonshine, Kokoro.js, Silero), Smart Turn, and RNNoise. The energy detector comes first, and each of these waits for a measured need.
- **The next adapters:** xAI, Gemini, Cartesia, AssemblyAI, and Soniox.
- **Live voice models** (GPT-Live, ElevenLabs' agents, Gemini Live, xAI's voice, and Nova Sonic) as the bot's ears and mouth. They come only if the test in the checklist shows the bot's words come through unchanged.
- **Calling a bot,** over the SIP registration: [Phone calls](phone-calls.md).
- **Telnyx and Twilio,** unless SignalWire's proof fails.
- **Telling headphones from speakers,** which Pi does to turn echo cancellation off.

## 4. Checklist

Checks run against fakes and a disposable fxbot, never dev or a real account, until the owner's own items.

**Part 1, core** (fxbot 0.12.0):
- [ ] `catalog.ts`: `models: "none"` and `hosts` pass `usable()`. A plugin's `providers` join the catalog while it's added and leave when it's removed. An id fxbot's catalog or another plugin has is left out, with a log line.
- [ ] The Add provider page shows a plugin's group under its name.
  - Added from it, a key provider checks its key at `keyCheck`: a fake service answering 401 refuses it.
  - Its key is sealed.
  - It's in no place that picks a model.
  - Settings › Providers marks it, and marks it again when its plugin is removed.
- [ ] `fx.providers.list()` answers no key.
- [ ] `fetch` and `socket` reach a fake voice service (HTTP and WebSocket in one script), which records the headers: `Token {key}` for a `headers` entry, and `Bearer` for OpenAI's shape.
  - They refuse a URL off the provider's hosts, a plan sign-in, and a provider with no key.
- [ ] `effort` on `fx.chats.send`: the turn a message starts thinks at that level, seen in the mock model's request, and a turn it joins keeps its own.
- [ ] Docs: the plugin API reference, and CHANGELOG's For plugins line.
- [ ] `npm run typecheck`, `npm run build-site`, and `git diff --check` pass.

**Part 1, phone 0.2.0:**
- [ ] `0002_voice.sql`, and the Voice section:
  - Its lists hold only what phone can use, plus This device.
  - The defaults follow the order in [the adapters](#phone-listeners-speakers-and-adapters-speechts).
  - A bot's voice comes from the speaker.
- [ ] `voice.ts` against a fake transport, listener, and speaker:
  - Words as they come cut the bot within one frame, and so does 700 ms of voice with a batch listener.
  - `clear` drops what was held, and what played becomes `played`.
  - A cut reply's next message says where.
  - A listener with turns holds nothing more.
  - The echo window and the pause work as in 0.1.2.
- [ ] Each adapter against a fake of its protocol, built from its docs' messages:
  - `openai.ts`: one stretch, then a sentence's PCM, with a speech server's address and with a key's.
  - `deepgram.ts`: Flux's `EndOfTurn`, then Aura's `Clear` on a cut, and Cloudflare's address.
  - `elevenlabs.ts`: commits, and a context closed on a cut.
  - `mistral.ts`: `turn.end`.
- [ ] The app's call, in Chromium with a fake microphone (`--use-fake-device-for-media-stream --use-file-for-fake-audio-capture=<wav>`), with the fake Deepgram and a mock model:
  - Talk starts a call, and the words reach the bot.
  - The reply plays, and the marks come back.
  - Words over a sentence stop the playback within 300 ms, and the next message says where.
  - End ends it.
  - Last calls shows it.
  - On a phone-sized page in dark mode, the bar fits.
- [ ] The sidekick, with a mock model, the subagents plugin, and the check-only waiter tool:
  - A call's message carries `effort` `low`.
  - A request for long work starts a subagent, and the call's turn ends in seconds while the subagent works.
  - The owner talks on, and gets answers.
  - The subagent's `subagents_tell` and its report are spoken at the owner's next pause, never over their words, even when the owner is speaking as they arrive.
  - "How's it going?" is answered from `subagents_list`.
  - The call's bar shows the subagent by name.
- [ ] A room's call, in Chromium, with two mock bots in a room, the fake speaker recording which voice each reply asked for:
  - "Bob, …" wakes Bob, and "…, Bob?" does too. "Mister Robot, …" wakes Mr Robot, and "everyone" wakes both.
  - A question with no name wakes the lead.
  - A reply that tags the other bot is said next, in that bot's voice, with the tag said as its name.
  - Two bots with no voice of their own get different voices.
  - One speaks at a time.
  - A cut stops the speaker and drops what waits, and the next message carries the note, which the room doesn't show.
  - "Stop" stops the room.
  - A room's call shows in Last calls with the room.
- [ ] Chat rooms 0.6.0: `post`, `stop`, `on`, and `wake`, `label` shown and `note` not, and its README's For other plugins.
- [ ] Subagents 0.3.0: a bot in a room starts one. Its `subagents_tell` and report wake that bot in the room, and on a call they're said at a pause. Its README, and the "not in a room" line, change.
- [ ] This device in Chromium: speaking, with `speechSynthesis` stubbed to count utterances, and a cut cancels it. Listening is stubbed the same way. It isn't offered where `SpeechRecognition` is missing. Chrome's Google toggle starts off, and with it off and no language on the device, it says why. In Firefox through Playwright, listening is offered where the browser has it.
- [ ] Over web pairing locally: `npm run dev --prefix packages/web-app` with the new policy. The frame gets the microphone, and a call works through the bridge.
- [ ] A local Speaches container, run disposably under podman, if its image and a small model fit on this machine. It hears a WAV and speaks a sentence through the speech server entry. If it doesn't fit, it's said here, and the fake stands in.
- [ ] phone's README (Voice, the app's call, and line 3), the how-tos, CHANGELOG, and the README's Phases line.
- [ ] Dev: phone 0.2.0 landed in one write a file, and the API restarted. Its log shows the providers phone found.

**Part 1, web.fxbot.sh:**
- [ ] The relay's `permissions-policy` changed and checked locally, then deployed with the owner's approval.
- [ ] The live `shell.js` hash matches a local build.

**The owner's own** (only a person can):
- [ ] A Deepgram key and an ElevenLabs key added from For Phone.
- [ ] A call in Chrome on a computer, and on the iPhone app over web pairing, on speaker: cutting in mid-sentence, no echo heard as them, and pacing that sounds right.
- [ ] One call with This device in Chrome, and one in Firefox.
- [ ] A conference call with Bob and Mr Robot, in the app and on the phone: naming each, a question with no name, the bots handing it to each other, and cutting in.
- [ ] A sidekick call: they ask for work on the computer, a herdr agent's task, and a subagent's digging, then keep talking. They hear each result at a pause, and cut in mid-sentence.
- [ ] After everything above works, with the owner's go-ahead, since it spends credit: GPT-Live as the bot's ears and mouth only. Every word it says comes from `session.commentary.append`, with the bot's reply, and instructions to say exactly that and nothing of its own. If it adds, drops, or rewords, it's out, and that goes here.
- [ ] One with a Mistral or Groq login reused.
- [ ] One with Speaches on their machine.
- [ ] On Android, whether echo cancellation holds.

**Part 2, phone lines** (this release waits for it; with the owner's go-ahead, since it uses their SignalWire account, rings their phone, and spends credit):
- [ ] The proof, a script run from the release's container under rootless podman, on the owner's router and on a phone hotspot. Each answer goes in this doc:
  - REGISTER and an INVITE to the owner's number over TLS, from a SIP endpoint the script makes, show the SignalWire number.
  - Which SDP address SignalWire takes, private or STUN's, and whether its RTP comes back.
  - Two-way audio for 30 minutes, with long silences from the bot, and the TLS connection kept.
  - SRTP agreed with `encryption: required`.
  - Mouth to fxbot and back, in ms.
  - Whether SignalWire bills both legs.
- [ ] If it passes:
  - `{ "line": 3 }` and `sip.ts`.
  - phone-signalwire 0.2.0's SIP way, with its endpoint made through the REST API.
  - The voice loop on a line, against a fake carrier: a local SIP-over-TLS and RTP script made for the check.
- [ ] If it fails: what failed goes here, and the same proof runs on Twilio's Elastic SIP Trunking before anything is built.
- [ ] RELAY goes:
  - `relay.ts`, its voices, and phone's lines 1 and 2.
  - phone-signalwire's settings keep the project, token, and number, and lose the voice and language.
  - A test call's checks are replaced by the SIP fake's.
- [ ] The owner's calls from their watch on speaker, in the app and on the phone: they cut in mid-sentence, the bot works in the background while they talk, and it sounds natural. 0.12.0 is cut only after these, as the owner said.

## 5. Open questions

None left. Answered on 2026-11-25:
- ElevenLabs first.
- Google's servers are a toggle, and This device works across browsers.
- RELAY goes, and this release waits for SIP. SignalWire stays the first SIP carrier, and Twilio's trunking is next if its audio doesn't come back.
- "Hey, what's up?" opens an app call.
- Phone v2 comes before Coding.
- The voice is the bot, in its own words. Handoffs are its own background work.
- A call's turns think at `low` (`callThinking`), and subagents at the bot's own level unless the owner changes the subagents plugin's `thinking`.
- The GPT-Live test runs once the rest works.
- Calls in chat rooms, with several bots, are in the first version.
