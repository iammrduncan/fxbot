# Phone: SignalWire

`phone-signalwire` lets the owner talk with a bot by voice, on a real phone call:
- **Press Call me, and the bot rings your phone.** Answer and it says "Hey, this is your fxbot Bob. How can I help today?" Then you talk back and forth, as you'd chat by text, with your hands on the wheel.
- **It's the bot itself on the line.** What you say goes to the bot's own chat, and its own model, memory, and tools answer. Its words are read out as it writes them, and the chat keeps the whole conversation.
- **The bot can call you too, when you asked it to.** For example "call me when the build is done": the call opens with why it rang, and the conversation goes on from there.
- **Only your phone.** You set your number once and confirm it, and no tool takes a number.
- **Nothing reaches fxbot.** fxbot opens one connection to SignalWire for each call. SignalWire places the call, hears the owner, and speaks the bot's words, and never connects to fxbot.

It's the first of two phone plugins. [Phone: Telnyx](phone-telnyx.md), later, is a softphone with speech providers of the owner's own: more code, a third of the price, and better speech.

Status: planned on 2026-11-14 at the owner's word, not built. It replaces the same day's plans for a call that only read a message out, and then for Twilio's ConversationRelay through a public path, which the owner ruled out: fxbot has no public endpoint. Researched against the research directive's references, OpenClaw, Hermes Agent and its phone plugins, Twring, the coding-agent phone projects, ChatGPT, Home Assistant, the phone services, ElevenLabs, xAI, Cartesia, the other speech providers, and the realtime voice models, read on 2026-11-14. It needs no change to the plugin API.

## What the owner asked

- "I want to get these two things launched on fxbot such that the bot is able to make outgoing phone calls when asked and approved (to my phone) and the agent is able to use herdr to see agent activity and access the rest of my ai lab." (2026-11-14; the herdr half is [herdr](../_completed/phases/herdr.md).)
- Of the first plan: "I want the bot to call me and we have a live conversation. So I click a button and it calls me and says "Hey this is your fxbot <name>, how can I help today?" and then I can start talking to it back and forth via voice instead of text chat. So that I can control it while driving hands free etc... gpt-live is one option, there are many out there."
- "what about elevenlabs? I would support multiple providers... Some providers offer phone and voice model support, some are just voice models, some are jsut phone... But we should find the simplest, highest quality, and cost effective as first target." With "also https://x.ai/voice" and "also https://www.cartesia.ai/".
- "I want no public endpoint of fxbot, so anything that requires that is out."
- "Maybe we do signalwire relay first, later we add telnyx as a more complex but cheaper alternative for folks... lets do `phone-signalwire` as the first plugin." (All 2026-11-14.)

## 0. Core or plugin

**A plugin**, `phone-signalwire` ([Core or plugin](../../CONVENTIONS.md#core-or-plugin)). A phone service isn't what every bot needs, what plugins plug into, or what fxbot needs to run. It costs money, needs an account, and not every owner wants it. It's in fxbot's list, off until added, and not in **Essentials**.

**One plugin for each phone service,** as the owner put it: `phone-signalwire` now, and `phone-telnyx` later. The conversation inside is kept apart from SignalWire in a file of its own ([The line](#the-line)). When the second plugin is built, that file is the part they share, through one of:
- a `phone` plugin both need, with `fx.provide`
- a copy

That's decided then, with a second real use ([open question 2](#5-open-questions)).

**No change to the plugin API.** Everything a call needs is there:
- the bot's own chat:
  - `fx.chats.send`, with `steer`, so what the owner says joins a turn that's running
  - `asked`, so Permissions' reviewer sees the owner's words
  - `fx.chats.stream` for the reply as it's written
  - `fx.chats.cancel` for "stop"
- a button in the message box (`app.composer`), a bar above it (`app.chat`), a card in the chat (`app.toolView`), and settings with secrets

A WebSocket out is plain Node: Node 22 has one built in.

## 1. Research

From the services' docs, price pages, npm, and each project at its commit or in its docs, read on 2026-11-14. Prices are US list prices that day, and they change. Rankings are Artificial Analysis's, read that day ([text to speech](https://artificialanalysis.ai/text-to-speech/leaderboard), [streaming speech to text](https://artificialanalysis.ai/speech-to-text/streaming), [speech to speech](https://artificialanalysis.ai/speech-to-speech)), and none of them is on 8 kHz phone audio, let alone in a car. Nothing here placed a call.

### What decides the design

Two questions:
1. **Who thinks?** The bot's own model, with its memory and tools, or a voice model in front of it that hands work over.
2. **What has to reach fxbot?** Nothing may. fxbot has no sign-in of its own, so whatever reaches its port is the owner's. The owner's rule: no public endpoint, through Tailscale Funnel or anything else.

**Every phone service that streams a live call connects to the app.** Twilio's Media Streams and ConversationRelay "accept secure WebSocket connections (TCP port 443) from Twilio," from "any public IP address" ([Media Streams](https://www.twilio.com/docs/voice/media-streams)). Telnyx's streams and its Conversation Relay, Vonage, Plivo, SignalWire's own streams, and Bandwidth are the same.

**So does every hosted voice agent that lets your own model think:**
- Vapi refuses a private address outright ([Vapi](https://docs.vapi.ai/customization/custom-llm/using-your-server)).
- Retell, Ultravox, and Telnyx's assistants call a public URL of yours.
- ElevenLabs' agents call one each turn ([custom LLM](https://elevenlabs.io/docs/eleven-agents/customization/llm/custom-llm)).
- Cartesia's call one during the call ([agents](https://docs.cartesia.ai/api-reference/agents/agents/update.md)).
- xAI's SIP takes calls in only, announced by a webhook ([SIP](https://docs.x.ai/developers/model-capabilities/audio/speech-to-speech/sip.md)).

That rules out the earlier first target, Twilio's ConversationRelay, which needed one public path.

### The ways with nothing reaching fxbot

There are three kinds:
1. **A service holds the call and fxbot steers it,** over a connection fxbot opens.
2. **fxbot is a softphone,** signed in to a carrier as a phone app is, with its own speech providers.
3. **A voice model holds the call,** and hands work to the bot.

Each row is a whole call. The prices leave out the bot's own model and the number, assume the bot speaks 40% of the call, and include listening the whole time, so the owner can cut in:

| Way | Kind | Who says the bot's words | Cutting in | 10 minutes | 18 hours | fxbot's code |
| --- | --- | --- | --- | --- | --- | --- |
| **SignalWire RELAY** | a service, steered | SignalWire, as written | built from documented parts, untried | **$0.79–1.01** | **$85–109** | about 1,200 lines |
| Voximplant | a service, steered | Voximplant, as written, streamed | yes, in a script fxbot uploads | about $0.61 | about $66 | about 500, half of it a script that runs in Voximplant's cloud |
| **Telnyx softphone,** Deepgram Flux and ElevenLabs v4 Turbo | a softphone | fxbot, as written | fxbot's own | **about $0.25–0.27** | **about $27–29** | about 2,100 |
| GPT-Live, over a SIP trunk | a voice model | GPT-Live, reworded | the model's own, the best | $0.55–0.60 | about $62 | about 300 |
| Vapi, through its listen and control sockets | a service, steered | Vapi, as written | Vapi's own, if its model can be kept quiet | about $1.00 | about $108 | about 250 |

Sources:
- SignalWire: [RELAY](https://signalwire.com/docs/platform/voice/make-and-receive-calls#make-and-receive-calls-via-websocket-relay), [prices](https://signalwire.com/pricing/voice)
- Voximplant: its [WebSockets doc](https://github.com/voximplant/vox-docs-en/blob/main/fern/pages/help/websockets.md), [prices](https://voximplant.com/pricing)
- Telnyx: [Phone: Telnyx](phone-telnyx.md)
- GPT-Live: [SIP](https://developers.openai.com/api/docs/guides/voice-sip.md), [delegation](https://developers.openai.com/api/docs/guides/live-delegation.md)
- Vapi: [listen](https://docs.vapi.ai/calls/call-listen), [control](https://docs.vapi.ai/calls/call-features)

What rules out the rest:
- **Retell and Telnyx's AI Assistant** reword the bot's answers.
- **Twilio with its Conversation Orchestrator** takes about 4 to 10 seconds to a first word, and can't be cut off.
- **LiveKit Cloud and Amazon Chime** need cloud code the owner runs. LiveKit's Node agent also needs a native binding a plugin can't carry (web pairing's [WebRTC in Node](../_completed/phases/web-pairing.md#webrtc-in-node)).

**Why SignalWire first.** It's the simplest, in the owner's words "signalwire relay first, later we add telnyx as a more complex but cheaper alternative":
- one account, one connection out, no audio in fxbot, no trunk, and no code that runs anywhere else
- every word the bot's, with an exact greeting
- the bot's own turn deciding everything

Its costs:
- it's three to four times the Telnyx softphone's price, since SignalWire bills the listening and the speaking
- its turns are taken one at a time
- cutting in is untried

**GPT-Live,** for the record:
- Outbound calls are on for every organization since 2026-11-02, by OpenAI's changelog. No public report shows one placed through a trunk.
- It rewords: a measured run rewrote 11 of 11 replies, and once added a fact (bddap-bot/voice #128).
- The bot is in charge only as far as GPT-Live's instructions keep it, so it can come later, as a choice for owners who want its speed.

### SignalWire's RELAY, closer

**The connection.** RELAY "holds a WebSocket connection to SignalWire. It receives calls and events on that connection and sends commands back, so it needs no public HTTP endpoint" ([RELAY](https://signalwire.com/docs/platform/voice/make-and-receive-calls#make-and-receive-calls-via-websocket-relay)).
- **The protocol is JSON-RPC 2.0.** Its full spec is a guide in SignalWire's TypeScript SDK repo, "for AI coding agents implementing a RELAY client in any language" ([guide](https://github.com/signalwire/signalwire-typescript/blob/5a2d2f6fa92b0103e461c7cce2a7b6cc3b735b86/relay/RELAY_IMPLEMENTATION_GUIDE.md)). The REST reference documents the same commands and fields ([call commands](https://signalwire.com/docs/apis/rest/calls/call-commands)).
- **Signing in:** the first frame is `signalwire.connect`, with `authentication: { project, token }` and `event_acks: true`. The token is an API token with the Voice scope.
- **Upkeep:** every event is acknowledged, `signalwire.ping` is answered, and on `signalwire.disconnect` the client connects again with the `protocol` it was given. "Call objects survive reconnect."
- **The SDK:** `@signalwire/sdk` 3.9.0 bundles to 3.19 MB with hono and its server. Its RELAY part alone is 263 KB, but reachable only by a file path its exports don't allow, and its releases break things. A client of fxbot's own, on Node's built-in WebSocket, has no dependencies.

**A call:**
- **Placing it:** `calling.dial` with a `tag` and one phone device: `from_number`, `to_number`, and `timeout`. `calling.call.state` events follow (`created`, `ringing`, `answered`, `ending`, `ended` with an `end_reason`), then `calling.call.dial` with the call's id.
- **Speaking:** `calling.play` with `{ type: "tts", params: { text, voice } }`, and `calling.call.play` says `playing`, then `finished`. A play takes whole text, so the bot's reply goes sentence by sentence, each after the last `finished`, and `calling.play.stop` cuts one off. What a second play does while one runs isn't documented.
- **Listening:** `calling.collect` with `speech`:
  - `end_silence_timeout`: 1 second by default
  - `language`: such as `Deepgram:en-US`, which picks Deepgram's recognizer
  - `hints`
  - `continuous`, so it keeps listening after each result
  - `partial_results`, for words as they come
  - `send_start_of_input`, for an event when the owner starts to speak
- **Ending:** `calling.end`.
- **Voicemail:** `calling.detect` with `type: "machine"` says `HUMAN`, `MACHINE`, then `READY` at the beep, for $0.006 a call.

**Cutting in, from documented parts:**
- a continuous `collect` with partial results and `send_start_of_input`, while `play`s run
- then `calling.play.stop` when the owner starts talking

"Multiple actions can run concurrently on a call, told apart by `control_id`," but no doc says a collect may run during a play, or how quickly a stop cuts the sound. SignalWire's own older SDK handled these events this way. In 2023 an issue there said `continuous` didn't work (signalwire-legacy-js #869), which may be stale. The first real call settles it ([Checklist](#4-checklist)).

**Voices,** as `engine.voice:model` ([voices](https://signalwire.com/docs/platform/voice/tts)), billed by the character ([prices](https://signalwire.com/pricing/voice)):

| Tier | A character | Voices | 10 minutes of the bot speaking 40% |
| --- | --- | --- | --- |
| Economy+ | $0.000032 | Amazon Polly Neural, Google Neural2 | $0.11 |
| Standard | $0.0001 | ElevenLabs Flash, Turbo, and v3 Conversational; Cartesia Sonic; Deepgram Aura-1; OpenAI tts-1 | $0.33 |
| Premium | $0.00015 | Deepgram Aura-2, Google Chirp 3 HD, Rime Mist | $0.50 |
| Pro | $0.0002 | ElevenLabs Multilingual v2 and v3, Rime Coda | $0.66 |

ElevenLabs' v4, the top-ranked voice, isn't offered. A cloned voice needs a request to SignalWire.

**Prices besides voices:**
- Calls out: $0.008 a minute.
- Speech to text: "$0.015 per 15 seconds per use", so $0.06 a minute while it listens. Whether each use is rounded up isn't stated.
- A number: $0.50 a month.

**The account:**
- A trial calls only numbers bought on it, or verified, which the owner's own phone can be, so the owner can try it before paying.
- Leaving the trial takes $5.
- The caller ID is a number in the account, or one verified.

### How others do it

Two shapes recur, and in both the owner's own agent decides:
- **A realtime voice in front, with one hand-off tool.** OpenClaw's `openclaw_agent_consult`, OpenBot's `ask_agent`, OpenDots' `ask_compute`, eve's GPT-Live template, Hermes Desktop, and ChatGPT itself.
- **A cascade, where the agent's own turn is the voice:** speech to text, then the turn, then speech sentence by sentence. Twring, Pi's p2, OpenClaw's classic mode, Hermes' voice mode, Home Assistant, and the coding-agent phones.

Twring is nearest to this phase: "Your agent keeps its own model, memory and tools. Twring adds the call," and "No speech-to-speech model controls the connected agent's tools/actions" ([README](https://github.com/saasagelabs/twring/blob/1a188b9/README.md), [DECISIONS](https://github.com/saasagelabs/twring/blob/1a188b9/docs/DECISIONS.md#L27)). Its records, and the others':
- **The wait is the agent, not the speech.**
  - Twring with Hermes: "the agent's first word took p50 4-6 s, and 45 s and 132 s on tool-heavy turns. Twring's own part… is about 0.4 s" ([ADR-028](https://github.com/saasagelabs/twring/blob/1a188b9/docs/DECISIONS.md#L644)).
  - OpenClaw users sat through 133 seconds of silence on one consult ([#139279](https://github.com/openclaw/openclaw/issues/139279)).
- **Fill it, but only with what's true.** Twring says "Okay, one moment." once, after 1.5 s, which "claims nothing about the work," then "Still working" from the agent's own tool events, at most every 15 s.
- **Say the greeting at once, in exact words.**
  - A slow agent's first words got talked over by the owner's "hello" (Twring ADR-030).
  - GPT-Live doubled or invented greetings on 6 of 6 calls ([#164979](https://github.com/openclaw/openclaw/issues/164979)).
  - Home Assistant's `start_conversation` hands the agent the reason for the call.
- **Long work: "you are the voice, not the worker."** Pi's rule: hand work of more than a few seconds to a subagent, say so in a sentence, and end the turn ([p2](https://github.com/earendil-works/pi/blob/827383a15262905f82e418483825a49dbb1adbf5/apps/p2/README.md#L321-L343)). In Twring, work outlives the call, and when it finishes the agent rings the owner back.
- **Talking while it works.**
  - When each new utterance cancelled the running turn, the owner "had to repeat themselves," so Twring queues talk once a tool has started (ADR-026).
  - **"Stop" isn't sent to the agent:** sent as a prompt, "it starts a new run that may re-plan or resume what it was told to stop." Words that only take the floor, such as wait, hold on, or one second, aren't sent either (ADR-017).
- **Interruptions cut the speech, not the work,** and the agent learns what was heard (Twilio's `interrupt`, Pipecat's "only the words that were actually spoken").
- **Approvals stay in the app.**
  - OpenClaw tried a spoken "yes" and dropped it on 2026-10-10: "saying 'yes'… does not grant permission."
  - hermes-line: "Saying yes never approves anything on this line."
  - GPT-Live: "Enforce permissions and required confirmations in your application."
- **The transcript belongs in the agent's chat,** so later chats share it. Hermes' GPT-Live mode didn't keep one, and its voice later denied work Hermes had done.
- **Limits the server owns.**
  - One call at a time everywhere.
  - A length cap: 5 minutes (OpenClaw) to 15 (OpenBot, OpenDots).
  - An idle hangup: a forgotten GPT-Live session billed for hours in Hermes.
  - A cap on calls: Twring allows 6 rings an hour.
- **Only the owner's number.** OpenClaw's tool dials any `to` ([#197701](https://github.com/openclaw/openclaw/issues/197701), open), and that's what to avoid.
- **Echo** can cut the bot off: its own voice comes back and reads as the owner speaking ([#159140](https://github.com/openclaw/openclaw/issues/159140); Twring's speakerphone records).

The directive's references:
- **eve's** voice template is GPT-Live with delegation, in the browser. Its Twilio channel takes calls in, with a required `allowFrom`, and asks for approvals by numbered texts.
- **OpenBot** and **OpenDots** use a realtime voice in the browser, with one hand-off tool. OpenDots' limits: one call at a time, 15 minutes, and 6 hand-offs, then a receipt of "only confirmed decisions." OpenBot: "calls do not automatically reconnect or repeat actions."
- **Pi's p2** is in-app voice with its own speech server, and holds the screen awake.
- **Grok Bot's** voice chat ends when a phone call takes the audio.
- **fx, fx0, durable-harness, agent-browser, agent-desktop, OpenDuet, OpenFuse,** and **herdr's apps** have nothing on calls. herdr's apps have dictation.

### Why a phone call, in a car

- CarPlay's assistant category, new in iOS 26.4, needs a native app with Apple's entitlement, and Android Auto has no category for others' assistants. A web app can be neither.
- An installed iPhone web app loses the microphone when the screen locks or it goes to the background ([WebKit 239602](https://bugs.webkit.org/show_bug.cgi?id=239602), open).
- A phone call works in any car. It rings through Driving Focus when the phone is connected to the car, answers from the steering wheel, and the car cancels the echo.
- So the call is the way to talk while driving. Voice in the app, over web pairing, is free and private for the desk, and stays in the [Phone calls](phone-calls.md) stub.

### fxbot today

- **A turn's owner:** a turn with no `from` on `turn.start` is the owner's own, typed in the bot's own chat. Any other is background, and a message a plugin sends has its `from` (`plugins/permissions/README.md`, Who's there).
- **Steer:** `fx.chats.send` with `steer` joins a turn that's running in the bot's own chat, and answers that turn's id as `joined`. The turn takes it at its next step, so the work isn't lost and the owner isn't queued.
- **The reply as it's written:** `fx.chats.stream` gives a session's lines, with `text_delta` and `turn_end`, as chat rooms reads them (`plugins/chat-rooms/fxbot/server.ts:345`).
- **Stop:** `fx.chats.cancel(bot)` stops the turn running in the bot's own chat if this plugin started it.
- **Permissions:**
  - A card in a background turn expires after `expires` minutes, 30 by default.
  - Its reviewer reads a turn's `asked`, the owner's own words a plugin quotes.
- **Subagents** take long work and report to the bot's own chat when done (`plugins/subagents`).
- **Instructions** are built each time a turn opens, so a note there that changed for a call would make the model read the chat again without its cache, at the call's start and its end. A note in the message keeps the cache.
- **Tool names** carry the plugin's, hyphen and all, as `chat-rooms_remember` does, so the bot sees `phone-signalwire_call`.

## 2. Key takeaways

1. **The bot's own turn runs the call.** What the owner says is a message in the bot's own chat, and the bot's reply is what they hear, word for word. No second model talks for it, so a bot on any model, hosted or local, works, and it's the bot the owner controls.
2. **Nothing reaches fxbot.** Every phone service that streams a call, and every hosted agent that lets your model think, connects in. So the call is placed and steered over a connection fxbot opens.
3. **SignalWire's RELAY first, as the simplest:** one account, one connection, no audio in fxbot, every word the bot's, and an exact greeting, for $0.79 to $1.01 for 10 minutes. The cheaper way, a softphone on Telnyx at about $0.26, is a plugin of its own later ([Phone: Telnyx](phone-telnyx.md)).
4. **Cutting in is the open part.** A collect that keeps listening while the bot speaks, and stopping the speech when the owner starts, are each documented, but not together. The first real call tries it. Without it, the call takes turns, and "stop" waits for the end of a reply.
5. **The greeting is the owner's words, played the moment the call is answered.** A call the bot makes opens with why it called, and the bot hears what was said.
6. **Fill the wait with true things:** "One moment." once, then "Still working on it." while a turn runs. Hand long work to a subagent, and the result is read out if the call's still on.
7. **What the owner says joins the running turn** with `steer`, so work isn't lost. "Stop" cancels, and words that only take the floor are kept from the bot.
8. **Approvals stay on the screen.** Nothing is approved by voice.
9. **Caps the server owns:** one call at a time, a length cap, an idle hangup, the owner's number only, and a day's cap on calls a bot makes on its own.

## 3. Implementation

### The plugin

`plugins/phone-signalwire/`, version 0.1.0, in fxbot's list, not in **Essentials**:
- `plugin.json`: settings, and `minFxbot`, the oldest release with what it uses (0.9.0 by the API's `Since` notes, confirmed by `scripts/check-plugins.mjs`)
- `fxbot/server.ts`: the tools, the routes, the call records, call-backs, and confirming the number
- `fxbot/call.ts`: the conversation: what the owner says into the chat, the reply out, fillers, stop words, interruptions, and the limits. It names no phone service.
- `fxbot/relay.ts`: SignalWire's RELAY, the only file that knows SignalWire:
  - the JSON-RPC client: signing in, requests and their answers, acknowledging events, pings, and connecting again
  - the line over it ([below](#the-line)): dialing, playing, listening, stopping, detecting voicemail, and hanging up
- `fxbot/page.jsx`, built to `page.js` with the rolldown command in its README
- `fxbot/migrations/0001_phone.sql`
- `skills/phone/SKILL.md`, `README.md`

### The line

A **line** is what `call.ts` holds a call through, in text:
- **`place({ to, greeting })`** rings the owner, and answers the service's id for the call.
- **It tells the call:**
  - `heard(text)`: the owner finished a turn
  - `interrupted(heard)`: they cut in, after hearing that much
  - `played(text)`: those words are out
  - `ended(how)`
- **It does:**
  - `say(text, { last })`
  - `stop()`
  - `hangUp()`

`relay.ts` is that over RELAY. Telnyx's softphone would be the same shape over audio and speech providers, which is what makes `call.ts` the part two plugins could share.

### A call

1. **Connecting.** When a call is placed, `relay.ts` opens `wss://<space>`, the owner's SignalWire space, and signs in with the project and its token. It closes the connection when the call ends, so nothing is open between calls. A connection that drops mid-call connects again with its `protocol`, up to 3 times in 10 seconds, since SignalWire keeps the call. After that, the call is over.
2. **Dialing:** `calling.dial` to the owner's number from the account's number, ringing 30 seconds, with `max_duration` set from `minutes`. Whether that's in minutes or seconds is unclear: the SDK and SignalWire's reference disagree (signalwire-typescript #183). So the plugin also ends the call itself at `minutes`.
3. **Answered:** the greeting plays at once, with the voice setting, as one `calling.play`:
   - "Hey, this is your fxbot Bob. How can I help today?"
   - or, for a call the bot makes, "Hey, this is your fxbot Bob." and the reason

   The bot's name comes from its profile.
4. **Listening:** one `calling.collect` that keeps listening for the whole call, started with the greeting. It has:
   - `speech: { end_silence_timeout: 0.8, language: "Deepgram:<language>", hints: [the bot's name] }`
   - `continuous`, `partial_results`, and `send_start_of_input`
5. **Ended** by a hang-up, the bot, **End call**, the idle or length limit, or SignalWire. `calling.call.state` says `ended` and why: `hangup`, `noAnswer`, `busy`, `decline`, or `error`.

**A call the bot makes** runs `calling.detect` for a machine while the greeting plays:
- **On `MACHINE`:** the plugin stops the greeting and waits for `READY`, the beep. Then it plays "Hi, it's Bob from fxbot. <reason>. Talk to me in the app anytime." and hangs up, and the tool says voicemail.

**One call at a time,** for every bot: a second one refuses while one is ringing or on.

### On the call

`fxbot/call.ts` holds one live call: its bot, its line, the bot's own chat, and what's being said.

**What the owner says** comes from the line as `heard`, a collect's final result. Each goes to the bot's own chat:

```ts
fx.chats.send(bot, { text, shown: words, label: "On the phone", steer: true, asked: words })
```

- **`text`** starts with a note. The first message of a call has the whole note:

  > You're on a live phone call with the owner, who may be driving. You called them and said: "Hey, this is your fxbot Bob. How can I help today?" What they say comes to you as text, and what you write is read out to them. Answer in one to three short spoken sentences, with no lists, tables, links, code, or markdown. Before work that takes more than a few seconds, say in a few words what you'll do, and hand long work to a subagent if you have one. Anything that needs their OK shows on their screen, which they can't look at while driving. When they're done, say goodbye and use phone-signalwire_hang_up.

  Later ones start with "[On the phone]". The note is in the message, not the instructions, so the chat's cache holds.
- **`shown`** is what the owner said, and the chat shows it, so the whole call is there afterward.
- **`steer`** joins a turn that's running. The turn's id comes back as `joined`, and the call speaks that turn from there.
- **`asked`** gives Permissions' reviewer the owner's words.

**What the owner hears:**
- The plugin follows the bot's own chat with `fx.chats.stream`, from the first message of the call.
- It speaks every reply in that chat while the call is on, including a subagent's report, since the owner is on the line.
- It gathers `text_delta`s into sentences and plays them in order, each after the last one's `finished`.
- Before a sentence goes, it's made speakable:
  - markdown marks go
  - a link is said as "a link in the chat"
  - a code block or table is said once as "There's more in the chat"

**Fillers,** only from what's true:
- "One moment." once a turn, when 1.5 seconds pass after the owner's words with nothing to say.
- "Still working on it." every 20 seconds while a tool runs and nothing else is said.

**Interruptions:**
- **What counts:** while a sentence plays, a partial result of two or more words cuts in, unless its words are mostly the sentence playing, which is the bot's own voice coming back. `start_of_input` alone doesn't, since road noise may set it off, until a real call shows it's clean.
- **What happens:** the line stops the play and drops the sentences after it, and says `interrupted` with the sentences that finished.
- **What the bot learns:** the owner's next words go to the bot with "(They cut you off after: "…")", so it knows where they stopped listening. The turn itself keeps running.

If a real call shows that SignalWire won't listen during a play, the call takes turns instead: the collect runs only between the bot's replies, the owner can't cut in, and the how-to says so ([open question 3](#5-open-questions)).

**Words the bot never gets:**
- **Stop words:** an utterance that's only "stop", "cancel", or "never mind", with at most the bot's name or "okay", cancels the call's running turn with `fx.chats.cancel(bot)`. The plugin says "Okay, stopped." itself. A turn the call didn't start, such as the owner's typed one, isn't the plugin's to stop, so it says "That one isn't mine to stop from here."
- **Floor words:** an utterance that's only "wait", "hold on", "one second", or "sorry" isn't sent, and stops the sentence playing.

**Ending:**
- **The owner hangs up:** `calling.call.state` says `ended`.
- **The bot:** `phone-signalwire_hang_up` ends the call once its turn ends and its last play is `finished`, with `calling.end`.
- **Idle:** with nothing from the owner and no turn running for 60 seconds, the plugin says "I'll let you go. Bye for now." and ends the call.
- **Length:** at one minute left of `minutes`, "We have about a minute left on this call," and at `minutes` the plugin ends it.
- **The page's End call:** ends it at once.

When a call ends, a turn still running keeps going. Its reply lands in the chat, and if the owner asked for a call-back, the bot can call ([below](#who-can-start-a-call)).

**After a restart,** SignalWire may keep the call up with no one steering it, since "call objects survive reconnect." So the plugin takes back each call still `ringing` or `on`:
- it connects again with the `protocol` it kept with the call, as a dropped connection would
- it ends the call with `calling.end`, and marks it ended with "fxbot restarted."

If SignalWire won't take the old `protocol`, `max_duration` still ends the call. Nothing is placed again.

### Who can start a call

**The owner, with Call me:** a button in the message box, on each bot the plugin is on for. The tap is the yes.

**The bot, with `phone-signalwire_call({ reason?, later? })`,** not `idempotent`, since a call run twice rings twice:
- **In a turn of the owner's own,** typed in the bot's own chat or said on a call:
  - It calls now, with `reason` said after the greeting.
  - With `later: true`, it calls no one. It keeps one **call-back** for the bot, with the reason, for 12 hours: "call me when the build is done."
- **In any other turn,** such as a subagent's report or a routine's run, it calls only:
  - on the bot's open call-back, which it uses up
  - or with the bot's **May call me on its own**, off by default, under `perDay` and outside `quiet`

  Otherwise: "The owner didn't ask for a call. Tell them in the chat, and they can ask you to call."
- **On a call already,** a call now refuses: "You're on a call with the owner now: just tell them." A call-back can still be kept.

The plugin tells the turns apart with `turn.start`: no `from` is the owner's typed turn, and a turn the call's words started or joined (`joined`) is the owner's spoken one. `reason` is up to 300 characters. The tool waits until the call is answered or isn't, and answers in words: "Answered." "Not answered after 30 seconds of ringing." "It went to voicemail, and I left the reason." "Busy." "The call failed: <SignalWire's words>."

**`phone-signalwire_hang_up()`**, on a call only: "Hanging up after this reply."

### The owner's number

The owner sets it in the plugin's settings tab, with SignalWire's account. It isn't used until it's confirmed:
1. **Call me to confirm** places a call that plays a 4-digit code twice, and hangs up.
2. The owner types the code in the tab. Until then, every call refuses: "The owner's number isn't confirmed yet."
3. Changing the number unconfirms it.

So a typo can't ring a stranger. The how-to has the owner:
- verify their own number on a trial account, which is all a trial calls
- save the account's number as a contact, such as "Bob (fxbot)", which gets it past Silence Unknown Callers, and in a car the phone says who's calling

### The page

- **Call me,** with `app.composer`: a phone button in the message box. When the plugin isn't set up, it opens the settings tab instead.
- **The call bar,** with `app.chat`, above the message box: "Ringing…", then "On the phone · 3:12" with **End call**. It reads `/calls/live` every 2 seconds while a call is ringing or on, and every 15 while the chat is open and none is.
- **A call's card,** `app.toolView("call")`: the reason, ringing, on the call, then how it ended and how long it lasted.
- **The settings tab,** with `app.settings`:
  - SignalWire's space, project, token, and number
  - the owner's number, with **Call me to confirm** and the code's box
  - the voice and language, and the limits
  - the last 20 calls, each with its bot, time, how it ended, and length
- **A bot's section,** with `app.botSettings`: **May call me on its own**, and the bot's open call-back, with **Remove**.

### The skill

`skills/phone/SKILL.md`, short:
- "Call me" is a call now. "Call me when X" is `later: true` now, and a call when X is done. "Wake me at 7" is a routine at 7 whose task is to call.
- On a call, talk as you would on the phone: short, plain, and no formatting. Say what you're doing before you do something slow, and give long work to a subagent.
- Never say something is done before a tool said so.
- Hang up when the owner says goodbye, not before.

### Data (`0001_phone.sql`)

```sql
create table calls (
  id bigserial primary key,
  bot text not null,
  why text not null,                        -- button, asked, callback, own, confirm
  reason text,
  sid text,                                 -- SignalWire's call id
  node text,                                -- and its node, to end it after a restart
  protocol text,                            -- the connection's protocol, to connect again after a restart
  status text not null default 'ringing',   -- ringing, on, ended, voicemail, missed, busy, failed
  seconds int,
  error text,
  at timestamptz not null default now(),
  answered_at timestamptz,
  ended_at timestamptz
);
create table callbacks (bot text primary key, reason text not null, until timestamptz not null);
create table bots (bot text primary key, on_its_own boolean not null default false);
```

The confirmed number, and a code waiting to be typed, for 10 minutes, are kept with `fx.secrets`. The number is confirmed while `to` matches the confirmed one. Calls are kept 90 days. What was said is in the bot's chat, and nothing is recorded. Removing the plugin drops the schema.

### Settings (`plugin.json`)

| Setting | What it is | Default |
| --- | --- | --- |
| `space` | The SignalWire space, such as `example.signalwire.com` | |
| `project` | Its project id | |
| `token` | An API token with the Voice scope, sealed (`isSecret`) | |
| `from` | The account's number calls come from, such as +15551234567 | |
| `to` | The owner's phone, the only number called | |
| `voice` | A SignalWire voice, as `engine.voice:model` | `amazon.Joanna:neural:en-US` |
| `language` | What the owner speaks | `en-US` |
| `minutes` | The longest call, 5 to 120 | `30` |
| `quiet` | Hours a bot doesn't call on its own, in the owner's time zone | `22:00-07:00` |
| `perDay` | The most calls one bot makes on its own in a day, 1 to 20 | `3` |

`FXBOT_PHONE_RELAY`, read once at start, points the plugin at another RELAY address than the space's, for checks only, as the computer reads `FXBOT_COMPUTER_NAME`.

### Cost

- **Each request of each bot it's on for:** two tool definitions, about 250 tokens, cached with the rest, and the skill's line.
- **A call,** for 10 minutes, listening throughout:

  | Part | Cost |
  | --- | --- |
  | Calling out | $0.08 |
  | Listening, at $0.015 for 15 seconds | $0.60 |
  | Polly Neural speech | $0.11 |
  | **All, with Polly Neural** | **$0.79** |
  | **All, with ElevenLabs Flash or Cartesia** | **$1.01** |

  That's $85 to $109 for 18 hours. A bot's call adds $0.006 for voicemail detection, and the number is $0.50 a month. Each thing the owner says is also a turn on the bot's own model, with the chat's context, cached.
- **fxbot:** one connection while a call is on, and none between.
- **Idle:** nothing on the server: no process, no timer, and no connection. A call-back ends by its time, read when a call asks. The page reads `/calls/live` every 15 seconds while a chat is open.

### Size

About 1,200 lines of code:
- `relay.ts`: about 400, the JSON-RPC client and the line
- `server.ts`: about 350
- `call.ts`: about 250
- `page.jsx`: about 200
- the SQL: about 20

Plus the skill, the README, and a how-to. OpenClaw's voice-call plugin is about 18,000 lines, for three phone services and several ways to hold a conversation. This has one of each.

### Not in this phase

- **Phone: Telnyx,** the cheaper softphone: a plugin of its own ([stub](phone-telnyx.md)).
- **Calling the bot,** such as "Hey Siri, call Bob" from the car. RELAY can take calls in on a connection fxbot holds open, with nothing public, through a RELAY application on the number. That's a connection kept open all day, and a keypad PIN on top of caller ID, since "Caller ID is not proof" (hermes-line). It's next, if the owner wants it ([open question 6](#5-open-questions)).
- **A voice model in front,** GPT-Live or Grok Voice, for owners who want its speed and accept its words.
- **Approvals by voice.** They stay on the screen.
- **Voice in the app,** over web pairing, for the desk: the [Phone calls](phone-calls.md) stub.
- **Calling anyone else,** and texts: [Gateways](gateways.md).
- **Recording.** What was said is in the chat.

### What changes

- `plugins/phone-signalwire/` (new, 0.1.0), and its entry in `packages/sdk/src/plugins-registry.json`.
- No change to the core or the plugin API, so no line in `plugin-breaks.json`.
- The docs:
  - a how-to, **Talk with a bot on the phone**, covering:
    - SignalWire's space, the project and a Voice token, and a number
    - the owner's number verified for a trial, confirmed in fxbot, and the account's number saved as a contact
    - picking a voice, with what each tier costs
  - the README's Phases line
  - `CHANGELOG.md` under `## Unreleased`

## 4. Checklist

**First, with the owner's go-ahead,** since it uses their SignalWire account, rings their phone, and spends trial credit: a short script on this machine, through RELAY, before the plugin. Each answer goes into this doc, and a "no" changes the plan before more is built:
- [ ] It signs in to the space with the project and token, and dials the owner's verified number from the account's number. The caller ID shows as that number.
- [ ] A greeting plays on `answered`, and the time from answer to sound is noted.
- [ ] A continuous `calling.collect` runs while a `calling.play` runs, and `start_of_input` and partials arrive during the play. `calling.play.stop` cuts the sound, in how many milliseconds.
- [ ] A second `calling.play` sent during one: whether it queues, mixes, or replaces. The gap between back-to-back sentences.
- [ ] On speaker and in a car, the bot's voice and road noise don't set off `start_of_input` or a partial of two words.
- [ ] From the owner's last word to the final result, with `end_silence_timeout` at 1.0 and at 0.8, on Deepgram and on Google.
- [ ] `max_duration`'s unit, a dropped connection connecting again mid-call, `calling.end`, and the owner hanging up.
- [ ] After the script quits mid-call, a new connection with the old `protocol` can end the call. If it can't, say how long the call stays up.
- [ ] The voice strings for Polly Neural, ElevenLabs Flash, and Cartesia Sonic.
- [ ] The invoice: how the listening charge is rounded, and the characters spoken.

**The plugin.** Its checks run against a fake RELAY, a small local WebSocket server, through `FXBOT_PHONE_RELAY`. It answers `signalwire.connect` and `calling.dial` with state events, plays with `playing` and `finished`, and the collect with `start_of_input`, partials, and finals on cue. It keeps every frame. The checks run with a mock model and a disposable fxbot, and no check rings a real phone.
- [ ] `plugins/phone-signalwire/` 0.1.0, with its migration, settings, skill, and README. `page.js` is built from `page.jsx` and committed. `npm run typecheck` passes, with its `minFxbot`.
- [ ] `call.ts` names no phone service: it holds a call only through the line's `place`, `heard`, `interrupted`, `played`, `ended`, `say`, `stop`, and `hangUp`.
- [ ] **The client:**
  - It signs in with the project and token.
  - It acknowledges every event and answers pings.
  - It connects again on `signalwire.disconnect` and on a dropped connection, with its `protocol`, up to 3 times.
  - It closes when the call ends, and nothing is open between calls.
- [ ] **Confirming:** **Call me to confirm** dials and plays a 4-digit code twice. The right code confirms, a wrong one doesn't, and changing `to` unconfirms. Before it's confirmed, every call refuses.
- [ ] **Call me:**
  - The fake gets `calling.dial` with the owner's number, the account's, and 30 seconds.
  - The greeting plays on `answered`, in exact words, with the voice setting.
  - The collect starts with it.
  - A second **Call me** while one rings refuses.
- [ ] **A conversation:**
  - A final result becomes a message in the bot's own chat, showing the owner's words with the label and carrying the note and `asked`.
  - The mock reply plays sentence by sentence, each after the last `finished`.
  - Markdown, a link, and a code block come out speakable.
- [ ] **Fillers:** a slow mock turn gets "One moment." once at 1.5 s. A tool that runs 45 s gets "Still working on it." twice.
- [ ] **Steer:** a final result while a turn runs joins it (`joined`), and the reply that follows is spoken.
- [ ] **Interrupting:**
  - A two-word partial during a play stops it and drops the sentences after it, and the next message carries what was heard.
  - A partial that's mostly the sentence playing doesn't stop it.
  - `start_of_input` alone doesn't stop it.
- [ ] **Stop words:** "stop" cancels the call's turn, says "Okay, stopped.", and reaches no message. "Hold on" alone reaches none, and stops the sentence playing. "Stop the build when it's red" goes to the bot.
- [ ] **A subagent's report** during a call is spoken.
- [ ] **Ending:**
  - `phone-signalwire_hang_up` sends `calling.end` after the last play's `finished`.
  - 60 s idle ends the call, after its words.
  - The minute's warning comes before `minutes`, and the plugin ends the call at `minutes`.
  - **End call** ends it.
  - `ended` from the fake marks the call ended, with its reason.
- [ ] **`phone-signalwire_call`:**
  - In the owner's typed turn, and in a call's turn, it calls.
  - `later: true` keeps a call-back and calls no one.
  - A subagent's report then calls on it, and uses it up.
  - With no call-back, a background turn refuses. With **May call me on its own**, it calls outside `quiet`, refuses inside it, and stops at `perDay`.
  - On a call, a call now refuses, and `later: true` still keeps a call-back.
- [ ] **A bot's call:** `calling.detect` runs. On `HUMAN` the greeting and the reason play. On `MACHINE`, the greeting stops, and at `READY` the one line plays, the call ends, and the tool says voicemail.
- [ ] **A restart** while the fake rings, and while it's on: the plugin connects again with the kept `protocol` and sends `calling.end`, nothing is placed again, and the row says it ended.
- [ ] **The page:** **Call me**, the bar's ringing, its time, and **End call**, the call's card, the settings tab with the code and the last calls, and a bot's section with **May call me on its own** and **Remove**.

**The docs**
- [ ] The how-to, the plugin's README, `CHANGELOG.md`, and the README's Phases line. `npm run build-site` passes.

**Only a person can check**
- [ ] **Call me** rings the owner's phone from the saved contact, greets in exact words as they answer, and a question gets the bot's answer. The time to its first word is noted.
- [ ] **Talking over the bot** stops it, and it knows where. "Stop" stops work it started.
- [ ] **In a car** over Bluetooth or CarPlay, answering from the steering wheel works, the bot's voice doesn't cut it off, and the recognizer hears the owner over road noise.
- [ ] **A call-back:** "call me when the subagent is done" rings when it is, and opens with the result.
- [ ] **Voicemail:** a call the bot makes, left to ring, leaves its line on voicemail.
- [ ] **The bill:** a 10-minute call costs about what [Cost](#cost) says, for the voice set.

## 5. Open questions

1. **The default voice:** Polly Neural, the cheapest that sounds natural, at $0.79 for 10 minutes, or ElevenLabs Flash or Cartesia Sonic, at $1.01? Recommended: Polly Neural, with the others one setting away and their prices in the how-to. Try each on the first call.
2. **Two plugins sharing a conversation:** when Phone: Telnyx is built, should `call.ts` move into a `phone` plugin both need, or be copied? Recommended: decide then, with two real users of it. `call.ts` names no service either way.
3. **If SignalWire won't listen during a play:** ship it taking turns, where the owner can't cut in and "stop" waits for the end of a reply, or move Telnyx up? Recommended: ship it taking turns, with the note asking for short replies, and say so in the how-to.
4. **The bot's own chat** for a call, not a session of the call's own? Recommended: its own chat. The call shares the bot's memory of the day, joins work that's running, and leaves the conversation where the owner reads it later.
5. **May call me on its own,** off by default, 3 a day, outside quiet hours? Recommended: as written. The owner's own asks, "call me" and "call me when", need no setting.
6. **Calling the bot** from the car, through a RELAY connection kept open, with a keypad PIN, next? Recommended: as its own phase, once calling out is in use.
7. **A voice for each bot,** in a bot's section? Recommended: later. One voice for the plugin first.
8. **Approvals while driving.** A card the bot needs waits on the screen, and in a call's turn it expires after Permissions' `expires`, 30 minutes, as any background card does. Recommended: as is, with the note telling the bot to say so. Permissions could later keep a call's card open until the call ends.
