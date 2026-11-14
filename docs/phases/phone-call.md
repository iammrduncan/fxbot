# Phone call

`phone` lets the owner talk with a bot by voice, on a real phone call:
- **Press Call me, and the bot rings your phone.** Answer and it says "Hey, this is your fxbot Bob. How can I help today?" Then you talk back and forth, as you'd chat by text, with your hands on the wheel.
- **It's the bot itself on the line.** What you say goes to the bot's own chat, and its own model, memory, and tools answer. Its words are read out as it writes them, and the chat keeps the whole conversation.
- **The bot can call you too, when you asked it to.** For example "call me when the build is done": the call opens with why it rang, and the conversation goes on from there.
- **Only your phone.** You set your number once and confirm it, and no tool takes a number.

Providers come in three kinds: some carry the call and do the speech, some only turn speech into text or text into speech, and some only carry the call. The plugin keeps fxbot's side of a call to text, so each provider is one small file of its kind.

The first is **Twilio's ConversationRelay**, which carries the call and does the speech, with ElevenLabs' v4 Turbo voice and Deepgram's Flux, which hears when the owner has finished. It's the simplest and the best-sounding of the ways compared, though not the cheapest; cheaper ones follow in an order this plan sets. fxbot trades only text with it, over one connection Twilio opens for each call, which needs one public path to fxbot, through Tailscale Funnel or a proxy of the owner's own.

Status: planned on 2026-11-14 at the owner's word, not built. It replaces the same day's plan for a call that only read a message out: the owner wants a conversation. Researched against the research directive's references, OpenClaw, Hermes Agent and its phone plugins, Twring, the coding-agent phone projects, ChatGPT, Home Assistant, the phone services, ElevenLabs, xAI, Cartesia, the other speech providers, and the realtime voice models, read on 2026-11-14. It needs no change to the plugin API.

## What the owner asked

- "I want to get these two things launched on fxbot such that the bot is able to make outgoing phone calls when asked and approved (to my phone) and the agent is able to use herdr to see agent activity and access the rest of my ai lab." (2026-11-14; the herdr half is [herdr](../_completed/phases/herdr.md).)
- Then, of the first plan: "I want the bot to call me and we have a live conversation. So I click a button and it calls me and says "Hey this is your fxbot <name>, how can I help today?" and then I can start talking to it back and forth via voice instead of text chat. So that I can control it while driving hands free etc... gpt-live is one option, there are many out there" (2026-11-14).
- Then: "what about elevenlabs? I would support multiple providers... Some providers offer phone and voice model support, some are just voice models, some are jsut phone... But we should find the simplest, highest quality, and cost effective as first target." With "also https://x.ai/voice" and "also https://www.cartesia.ai/" (2026-11-14).

## 0. Core or plugin

**A plugin**, `phone` ([Core or plugin](../../CONVENTIONS.md#core-or-plugin)). A phone service isn't what every bot needs, what plugins plug into, or what fxbot needs to run. It costs money, needs an account and a public path, and not every owner wants it. It's in fxbot's list, off until added, and not in **Essentials**. Its providers are files inside it, not plugins of their own: they share one conversation, and none is any use alone.

**No change to the plugin API.** Everything a call needs is there:
- a socket for the phone service (`fx.socket`)
- the bot's own chat:
  - `fx.chats.send`, with `steer`, so what the owner says joins a turn that's running
  - `asked`, so Permissions' reviewer sees the owner's words
  - `fx.chats.stream` for the reply as it's written
  - `fx.chats.cancel` for "stop"
- a button in the message box (`app.composer`), a bar above it (`app.chat`), a card in the chat (`app.toolView`), and settings with secrets

fxbot's server has no sign-in of its own: what reaches its port is the owner's, which is why the public path must reach only this plugin's socket, and why the socket checks each call itself ([The way in](#the-way-in)).

## 1. Research

From the services' docs, price pages, npm, and each project at its commit or in its docs, read on 2026-11-14. Prices are US list prices that day, and they change. Rankings are Artificial Analysis's, read that day ([text to speech](https://artificialanalysis.ai/text-to-speech/leaderboard), [streaming speech to text](https://artificialanalysis.ai/speech-to-text/streaming), [speech to speech](https://artificialanalysis.ai/speech-to-speech)), and none of them is on 8 kHz phone audio, let alone in a car. Nothing here placed a call or opened a tunnel.

### What decides the design

Two questions:
1. **Who thinks?** The bot's own model, with its memory and tools, or a voice model in front of it that hands work over.
2. **What has to reach fxbot?** fxbot listens only on its own machine.

**Every phone service that streams a live call connects to the app.** Twilio's Media Streams and ConversationRelay "accept secure WebSocket connections (TCP port 443) from Twilio," from "any public IP address" ([Media Streams](https://www.twilio.com/docs/voice/media-streams)). Telnyx, Vonage, Plivo, SignalWire's streams, and Bandwidth are the same.

**So does every hosted voice agent that lets your own model think:**
- Vapi refuses a private address outright ([Vapi](https://docs.vapi.ai/customization/custom-llm/using-your-server)).
- Retell, Ultravox, and Telnyx's assistants call a public URL of yours.
- ElevenLabs' agents call one each turn ([custom LLM](https://elevenlabs.io/docs/eleven-agents/customization/llm/custom-llm)).
- Cartesia's call one during the call ([agents](https://docs.cartesia.ai/api-reference/agents/agents/update.md)).

Only a few ways have nothing reaching fxbot. GPT-Live is the one that's simple enough, and it puts its own model in front ([below](#the-ways-with-nothing-open)).

### Providers, by kind

- **Phone and voice together, trading text:** the provider carries the call, hears the owner, and speaks fxbot's text.
  - Twilio's ConversationRelay ([overview](https://www.twilio.com/docs/voice/conversationrelay), [TwiML](https://www.twilio.com/docs/voice/twiml/connect/conversationrelay), [messages](https://www.twilio.com/docs/voice/conversationrelay/websocket-messages))
  - Telnyx's Conversation Relay ([docs](https://developers.telnyx.com/docs/voice/programmable-voice/conversation-relay))
  - Cartesia's agents with code of your own
  - ElevenLabs' agents with a custom model, or its Speech Engine
- **Voice only:** speech to text, text to speech, or both at once.
  - Speech to text: Deepgram's Flux, ElevenLabs' Scribe, Cartesia's Ink, xAI's, AssemblyAI's, Soniox's, and models run on the machine.
  - Text to speech: ElevenLabs, Cartesia's Sonic, Inworld, Deepgram's Aura and Flux, xAI's, and models run on the machine.
  - Speech to speech: OpenAI's GPT-Live, xAI's Grok Voice, and Gemini Live. A voice model talks, and hands work to the bot.
- **Phone only:** the carrier streams the call's raw audio, 8 kHz μ-law. That's Twilio's Media Streams, Telnyx's media streaming, Plivo, SignalWire, Vonage, and Bandwidth, or a SIP trunk to a speech-to-speech model.

A call needs phone and voice, so a provider of one kind goes with one of the other. Each row below is a whole call, priced for 10 minutes in the US. The prices leave out the bot's own model and the number ($1.15 a month at Twilio, $1.00 at Telnyx), and assume the bot speaks 40% of the call.

| Way | Kinds | Who says the bot's words | What reaches fxbot | 10 minutes | Quality | fxbot's code |
| --- | --- | --- | --- | --- | --- | --- |
| **Twilio ConversationRelay**, Flux and ElevenLabs v4 Turbo | phone and voice | Twilio, as written | one `wss://` path, signed by Twilio | **$0.84** | voice #2 of 105; Flux turns; an echo filter | **about 330 lines** |
| Telnyx Conversation Relay, Flux | phone and voice | Telnyx, as written | one `wss://` path, signed | $0.57 | Flux; Telnyx's voices unranked | one more file, about 100 |
| Cartesia's agents, with code of your own | phone and voice | Cartesia, as written | one `wss://` path, unsigned | about $0.44 | Sonic 3.6 #4, Ink-2 | a file, on a protocol documented only in its Python SDK's source |
| ElevenLabs' agents, custom model | phone and voice | ElevenLabs, as written | one HTTPS path, asked each turn | $0.90–0.98 | v4; Scribe | about 350 |
| Twilio Media Streams, Flux, ElevenLabs v4 Turbo | phone, and voice | fxbot, as written | one `wss://` path, of audio | $0.38 | the same as the first row | 700 to 1,000 more |
| Twilio Media Streams, xAI's speech to text and text to speech | phone, and voice | fxbot, as written | one `wss://` path, of audio | about $0.27 | speech to text #3 of 49; its voice #31 | 500 to 650 more |
| Telnyx media, Flux, Inworld TTS-2 | phone, and voice | fxbot, as written | one `wss://` path, of audio | $0.25 | voice #9 | 700 to 1,000 more |
| All Telnyx: media, and its speech sockets | phone, and voice | fxbot, as written | one `wss://` path, of audio | $0.17–0.19 | unranked | 700 to 1,000 more |
| GPT-Live, over a SIP trunk, with delegation | voice, over a trunk | GPT-Live, reworded | nothing | about $0.60 | first audio 1.34 s | a WebSocket client |
| Grok Voice 3.0, over Twilio Media Streams | voice, and phone | Grok, as written with `force_message` | one `wss://` path, of audio | $0.99–1.14 | speech to speech #2 | a bridge, and one tool |

The raw-audio rows leave fxbot to do what a bundle does:
- hear when the owner has finished, from the speech-to-text's end of turn
- stop speaking when they cut in, and keep track of what they heard: Twilio's `clear`, a `mark` after each sentence, and cancelling the speech that's being made
- keep the bot's own voice from cutting it off
- frame the audio, and keep three sockets alive, each with its own key

That's 700 to 1,000 lines, against twilio-labs' call-gpt (about 320, with no ledger of what was heard and no echo guard) and voice-agent-kit (a pipeline core of 903).

**Latency doesn't separate them.** Every way's speech runs about 0.5 to 0.9 seconds from the end of the owner's words to the first sound, while the bot's own first word takes 2 to 6. Twilio's figure for ConversationRelay is 491 ms at the median and 713 at p95, its own benchmark. Raw audio adds trips through Funnel and the owner's connection for every sound, and ConversationRelay sends only text through them.

**Cost does.** For 20 calls of 10 minutes a month:

| Way | A month |
| --- | --- |
| ConversationRelay | about $18 |
| Telnyx's relay | about $12 |
| Twilio streams with Flux and ElevenLabs | about $9 |
| All Telnyx | about $5 |

The gap between the first and the cheapest is about $13 a month, for 700 to 1,000 lines and two more accounts.

### The first target, closer

**ConversationRelay's settings** ([TwiML](https://www.twilio.com/docs/voice/twiml/connect/conversationrelay), modified 2026-11-13):
- **Speech to text:**
  - `transcriptionProvider="Deepgram" speechModel="flux"`: "Flux fuses transcription and turn detection in a single model" ([changelog](https://www.twilio.com/en-us/changelog/conversation-relay-now-supports-deepgram-flux---new-features), 2026-05-06).
  - Its default is Nova-3, and on accounts used before 2025-09-12 it's Google, so the plugin sets both.
  - Twilio's noise tutorial found Flux "passed every test condition on its default config" against a vacuum and a drill on speakerphone. A car wasn't tested.
- **The voice:** ElevenLabs is the default provider, and a model is named after the voice's id, as in `UgBBYS2sOqTuMpoF3BR0-v4_turbo` ([voices](https://www.twilio.com/docs/voice/conversationrelay/voice-configuration)).
  - With no model, en-US speaks Flash v2. Its family is #57 of 105.
  - `v4_turbo` is #2 and `v4` #1, at the same $0.07 a minute.
  - Google's Chirp 3 HD is #65, and Amazon's Polly Neural #99.
  - A voice cloned in the owner's own ElevenLabs account isn't documented: Twilio points at ElevenLabs' library, and takes no ElevenLabs key.
- **The car:**
  - `echoPromptFiltering` "drops words from the caller's transcript that match what the agent just said."
  - `ignoreBackchannel` keeps an "uh-huh" from cutting in.
  - `interruptible` defaults to `any`, and `welcomeGreeting` is spoken the moment the call connects, word for word.
- **What was heard:**
  - `interrupt` carries `utteranceUntilInterrupt`, what the owner heard before they cut in.
  - `events="tokens-played"` "will provide messages about what's just been played," which tells the plugin when its last words are out. The message's fields aren't on the page.
- **The account:**
  - Trial accounts can't use it: "`<Stream>` and `<ConversationRelay>` are both blocked" ([trials](https://www.twilio.com/docs/usage/trials/try-out-voice)).
  - The owner accepts Twilio's AI/ML Features Addendum in the console first, or calls fail with error 95250 ([onboarding](https://www.twilio.com/docs/voice/conversationrelay/onboarding)).
  - Without a business profile, Twilio's caller ID carries the lowest STIR/SHAKEN rating, C, so the number saved as a contact matters.
- **The connection:** an outbound call takes its TwiML inline in `Calls.json`, so only the socket reaches fxbot. Twilio signs its opening with `X-Twilio-Signature`, an HMAC of the address with the account's auth token ([security](https://www.twilio.com/docs/usage/webhooks/webhooks-security)).

**Telnyx's Conversation Relay,** the same frames for $0.057 a minute, is second, not first:
- Paid Telnyx accounts put "This is an automated call generated on the Telnyx platform…" before machine-made speech until the account is Verified, with an identity check and an "AI agent evaluation" ([paid accounts](https://developers.telnyx.com/docs/account-setup/levels-and-capabilities/paid.md)). Its pages don't say whether that plays on a relay call, but if it does, it comes before the greeting on every call.
- It documents no echo filter, sensitivity, or timeout.
- "Telnyx does not reconnect automatically if the WebSocket closes."
- Whether its better voices cost more a character isn't stated.

### The three the owner named

- **ElevenLabs** is in all three roles, and is the best voice in any of them.
  - **Its v4 and v4 Turbo are #1 and #2,** which ConversationRelay already speaks.
  - **Its own agents place calls through Twilio or a SIP trunk** ([outbound](https://elevenlabs.io/docs/eleven-agents/api-reference/integrations/twilio/outbound-call)), and say `first_message` word for word. But they fit a bot poorly:
    - They ask fxbot's public HTTPS address for each reply, and send the whole conversation each time.
    - A reply that hasn't started after `cascade_timeout_seconds`, 4 by default, is asked for again, at least 3 times, so a bot's 2-to-6-second turn can arrive twice.
    - fxbot can speak only while it's asked, so there's no "still working" and no subagent's report between turns.
  - **Its Speech Engine** is a clean text socket, but ElevenLabs connects to it, with no sign-in by default, and its phone guide has fxbot relay Twilio's audio too.
  - **On its own,** its text to speech (`ulaw_8000` for phone lines, about 100 ms to start) and Scribe v3 Live (2.86% of words wrong, streaming) are a strong voice for the raw-audio way.
- **xAI** is a voice provider, not a phone one.
  - **Its SIP takes calls in only,** announced by a webhook, and it has no outbound call ([SIP](https://docs.x.ai/developers/model-capabilities/audio/speech-to-speech/sip.md)).
  - **Grok Voice 3.0 is #2 at speech to speech, for $0.08 a minute.** Unlike GPT-Live, it has `force_message`, which speaks the app's text word for word ([speech to speech](https://docs.x.ai/developers/model-capabilities/audio/speech-to-speech.md)), so the bot's words and the greeting stay its own.
  - **Its speech to text is #3 of 49 on accuracy,** at $0.20 an hour, and its voice is #31, at $15 a million characters.
  - So it's a cheap voice for the raw-audio way, about $0.27 for 10 minutes, and later a fast front for owners who want one.
- **Cartesia** is a voice provider first.
  - **Sonic 3.6 is #4, and Ink-2 hears when the owner has finished** (`turn.start`, `eager_end`, `end`). Both take and give 8 kHz μ-law over plain WebSockets.
  - **Its agents can hold the call and trade text** with code of your own, for about half ConversationRelay's price. But:
    - the protocol is documented only in its Python SDK's source
    - its connection carries no documented signature
    - outbound calls in that mode are unconfirmed
  - **It keeps every call's recording and transcript, and its terms allow training on them unless the owner opts out.** Zero retention is Enterprise only.

### The ways with nothing open

**GPT-Live,** outbound over a SIP trunk the owner brings, with client delegation:
- OpenAI's guide says outbound SIP is "available to all organizations" and needs "no incoming-call webhook," but other copies of the same page say it isn't supported ([SIP](https://developers.openai.com/api/docs/guides/voice-sip.md)).
- It requires a `sips:` trunk address, and Twilio's docs say Twilio "does not support the sips scheme." No one in these sources has called a real phone this way.
- **GPT-Live holds the conversation and decides when to hand over.** Its delegation event carries no text, so the app rebuilds the request from the transcript ([delegation](https://developers.openai.com/api/docs/guides/live-delegation.md)). What the bot writes back "the model may paraphrase," and so may the greeting.

**Two others:**
- **LiveKit Cloud** connects out too, but its Node agent is 36 MB with a 26 MB native binding, which a plugin can't carry (web pairing's [WebRTC in Node](../_completed/phases/web-pairing.md#webrtc-in-node)).
- **A SIP line that registers out,** such as Asterisk in a container, needs a second container, and audio through NAT that Twilio and Telnyx don't document.

### A public path

- **Tailscale Funnel** serves only ports 443, 8443, and 10000. It routes one path with `--set-path`, and TLS ends on the owner's machine: "The Funnel relay server cannot decrypt data" ([Funnel](https://tailscale.com/docs/features/tailscale-funnel.md), [CLI](https://tailscale.com/docs/reference/tailscale-cli/funnel.md)).
- Tailscale doesn't say that Funnel carries WebSockets. OpenClaw's voice-call plugin sends Twilio's stream through it ([its docs](https://docs.openclaw.ai/plugins/voice-call/configuration)).
- Cloudflare Tunnel needs a domain on the owner's account. A free ngrok address changes on restart, which breaks Twilio's signatures.
- **web.fxbot.sh must not carry calls.** A Durable Object could join Twilio's socket to fxbot's outbound one, but it would see every word, and the relay passes only the sealed pairing handshake today.

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
  - ConversationRelay's `welcomeGreeting`, and Home Assistant's `start_conversation`, which hands the agent the reason for the call, are the models.
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

## 2. Key takeaways

1. **The bot's own turn runs the call.** What the owner says is a message in the bot's own chat, and the bot's reply is what they hear, word for word. No second model talks for it, so a bot on any model, hosted or local, works, and it's the bot the owner controls.
2. **Providers come in three kinds, and fxbot's side of a call is text whatever the kind.** The conversation hears "the owner said this," "they cut in after hearing that," and "the call ended," and says "speak this" and "hang up." A provider that does phone and voice is one file that does that. A carrier, a speech-to-text, and a text-to-speech do it together through one shared file, later. So each new provider is one small file of its kind.
3. **First: Twilio's ConversationRelay, with ElevenLabs v4 Turbo and Deepgram Flux.**
   - **The simplest:** text only, one account, an exact greeting, interruptions with what was heard, and about 330 lines.
   - **The best-sounding:** the #2 voice of 105, at no extra charge.
   - **The priciest:** $0.84 for 10 minutes, about $18 a month for 20 calls.

   The cheaper ways cost 700 to 1,000 more lines and two more accounts, and latency doesn't separate them, since the bot's own first word takes 2 to 6 seconds.
4. **Then cost, in order:**
   - Telnyx's relay: the same frames, 32% less, once a real call shows its notice doesn't play.
   - Twilio's streams with Deepgram: half the price, the first raw-audio pair.
   - One file each for ElevenLabs, Cartesia, Inworld, xAI, AssemblyAI, and Soniox.
   - Telnyx's media: the cheapest carrier.
5. **It costs one public path,** and only one, through Funnel or the owner's own proxy, with a token for each call and Twilio's signature checked. GPT-Live is the only simple way with nothing open, and it puts a voice model in charge.
6. **The greeting is the owner's words, said by Twilio the moment they answer.** A call the bot makes opens with why it called, and the bot hears what was said.
7. **Fill the wait with true things:** "One moment." once, then "Still working on it." while a turn runs. Hand long work to a subagent, and the result is read out if the call's still on.
8. **What the owner says joins the running turn** with `steer`, so work isn't lost. "Stop" cancels, and words that only take the floor are kept from the bot.
9. **Approvals stay on the screen.** Nothing is approved by voice.
10. **Caps the server owns:** one call at a time, a length cap, an idle hangup, the owner's number only, and a day's cap on calls a bot makes on its own.

## 3. Implementation

### The plugin

`plugins/phone/`, version 0.1.0, in fxbot's list, not in **Essentials**:
- `plugin.json`: settings, and `minFxbot`, the oldest release with what it uses (0.9.0 by the API's `Since` notes, confirmed by `scripts/check-plugins.mjs`)
- `fxbot/server.ts`: the tools, the routes, the call records, call-backs, and confirming the number
- `fxbot/call.ts`: the conversation: what the owner says into the chat, the reply out, fillers, stop words, interruptions, and the limits. It names no provider.
- `fxbot/lines/twilio.ts`: the first line ([below](#the-line)). It places a call with its TwiML, reads it, and ends it, and turns the socket's frames into the line's words and back. It checks Twilio's signature. It's the only file that knows Twilio.
- `fxbot/page.jsx`, built to `page.js` with the rolldown command in its README
- `fxbot/migrations/0001_phone.sql`
- `skills/phone/SKILL.md`, `README.md`

### The line

A **line** is what `call.ts` holds a call through. It's the provider's whole part, in text:
- **`place({ to, greeting, reason, token })`** rings the owner, and answers the provider's id for the call.
- **It tells the call:**
  - `heard(text)`: the owner finished a turn
  - `interrupted(heard)`: they cut in, after hearing that much
  - `played(text)`: those words are out
  - `ended(how)`
- **It does:**
  - `say(text, { last })`
  - `hangUp()`

`lines/twilio.ts` is that over ConversationRelay, in about 120 lines.
- **A second provider that does phone and voice,** such as Telnyx's relay, is a second file of the same shape.
- **The raw-audio way** is one file, `lines/cascade.ts`, which makes a line from three smaller ones:
  - a carrier, which places the call and passes μ-law audio, `clear`, and marks
  - a speech-to-text, which takes audio and tells speech starting, words so far, and the end of a turn
  - a text-to-speech, which makes μ-law from text and can be cancelled
- **A setting picks the line** once there are two. This phase builds only `twilio.ts`, so it has no such setting.

### A call

1. **Placed** with `POST https://api.twilio.com/2010-04-01/Accounts/{account}/Calls.json`, Basic auth with the account and its auth token, and a form body:
   - `To`: the owner's number, and `From`
   - `Timeout`: 30, the seconds it rings
   - `TimeLimit`: `minutes`, in seconds
   - `Twiml`, with every value XML-escaped:

     ```xml
     <Response>
       <Connect>
         <ConversationRelay url="wss://box.example.ts.net/phone/<token>"
           welcomeGreeting="Hey, this is your fxbot Bob. How can I help today?"
           transcriptionProvider="Deepgram" speechModel="flux"
           ttsProvider="ElevenLabs" voice="UgBBYS2sOqTuMpoF3BR0-v4_turbo"
           language="en-US" interruptible="any" echoPromptFiltering="true"
           ignoreBackchannel="true" events="tokens-played" hints="Bob" />
       </Connect>
     </Response>
     ```

   The token is 32 random bytes, made for this call. The bot's name comes from its profile. The voice and language are the plugin's settings.
2. **Ringing:** the plugin reads `GET .../Calls/{sid}.json` every 3 seconds until Twilio opens the socket, or the call ends `no-answer`, `busy`, `failed`, or `canceled`.
3. **On the call:** Twilio opens the socket and says the greeting. From then on the socket carries the conversation ([below](#on-the-call)).
4. **Ended** by a hang-up, the bot, **End call**, the idle or length limit, or Twilio. Then the call is read once more, for its `duration` and `price`.

A call the bot makes is the same, with two changes:
- **Voicemail detection:** `MachineDetection=Enable`, $0.0075, which holds the TwiML until Twilio knows who answered.
- **The greeting comes from the plugin,** not `welcomeGreeting`. When the socket opens, the plugin reads the call's `answered_by`:
  - a person: it sends "Hey, this is your fxbot Bob." and the reason
  - a machine: "Hi, it's Bob from fxbot. <reason>. Talk to me in the app anytime." Then it ends the call.

**One call at a time,** for every bot: a second one refuses while one is placing or on.

### On the call

`fxbot/call.ts` holds one live call: its bot, its line, the bot's own chat, and what's being said.

**What the owner says** comes from the line as `heard`, which on Twilio is a `prompt` frame with `last`. Each finished utterance goes to the bot's own chat:

```ts
fx.chats.send(bot, { text, shown: words, label: "On the phone", steer: true, asked: words })
```

- **`text`** starts with a note. The first message of a call has the whole note:

  > You're on a live phone call with the owner, who may be driving. You called them and said: "Hey, this is your fxbot Bob. How can I help today?" What they say comes to you as text, and what you write is read out to them. Answer in one to three short spoken sentences, with no lists, tables, links, code, or markdown. Before work that takes more than a few seconds, say in a few words what you'll do, and hand long work to a subagent if you have one. Anything that needs their OK shows on their screen, which they can't look at while driving. When they're done, say goodbye and use phone_hang_up.

  Later ones start with "[On the phone]". The note is in the message, not the instructions, so the chat's cache holds.
- **`shown`** is what the owner said, and the chat shows it, so the whole call is there afterward.
- **`steer`** joins a turn that's running. The turn's id comes back as `joined`, and the call speaks that turn from there.
- **`asked`** gives Permissions' reviewer the owner's words.

**What the owner hears:**
- The plugin follows the bot's own chat with `fx.chats.stream`, from the first message of the call.
- It speaks every reply in that chat while the call is on, including a subagent's report, since the owner is on the line.
- It gathers `text_delta`s into sentences and sends each with `say`, with `last` at `turn_end`.
- Before a sentence goes, it's made speakable:
  - markdown marks go
  - a link is said as "a link in the chat"
  - a code block or table is said once as "There's more in the chat"

**Fillers,** only from what's true:
- "One moment." once a turn, when 1.5 seconds pass after the owner's words with nothing to say.
- "Still working on it." every 20 seconds while a tool runs and nothing else is said.

**Interruptions.**
- Twilio stops speaking when the owner talks, and the line says `interrupted` with what was heard. The plugin drops the rest of that reply.
- The owner's next words go to the bot with "(They cut you off after: "…")", so it knows where they stopped listening.
- The turn itself keeps running.

**Words the bot never gets:**
- **Stop words:** an utterance that's only "stop", "cancel", or "never mind", with at most the bot's name or "okay", cancels the call's running turn with `fx.chats.cancel(bot)`. The plugin says "Okay, stopped." itself. A turn the call didn't start, such as the owner's typed one, isn't the plugin's to stop, so it says "That one isn't mine to stop from here."
- **Floor words:** an utterance that's only "wait", "hold on", "one second", or "sorry" isn't sent: Twilio has stopped speaking already.

**Ending.**
- **The owner hangs up:** Twilio closes the socket, and the line says `ended`.
- **The bot:** `phone_hang_up` ends the call once its turn ends and the line says its last words were `played`, from Twilio's `tokens-played`. That message's fields aren't documented, so if it doesn't say what was played, the plugin waits about 70 ms a character, up to 10 seconds. Then it sends `end`.
- **Idle:** with nothing from the owner and no turn running for 60 seconds, the plugin says "I'll let you go. Bye for now." and ends the call.
- **Length:** at one minute left of `minutes`: "We have about a minute left on this call." `TimeLimit` ends it if nothing else does.
- **The page's End call:** ends it at once, through Twilio's `POST .../Calls/{sid}.json` with `Status=completed`.

When a call ends, a turn still running keeps going. Its reply lands in the chat, and if the owner asked for a call-back, the bot can call ([below](#who-can-start-a-call)).

**After a restart,** a live call's socket is gone, and Twilio ends the call. A call row still `placing`, `ringing`, or `on` is read once more and gets how it ended. Nothing is placed again.

### Who can start a call

**The owner, with Call me:** a button in the message box, on each bot the plugin is on for. The tap is the yes.

**The bot, with `phone_call({ reason?, later? })`,** not `idempotent`, since a call run twice rings twice:
- **In a turn of the owner's own,** typed in the bot's own chat or said on a call:
  - It calls now, with `reason` said after the greeting.
  - With `later: true`, it calls no one. It keeps one **call-back** for the bot, with the reason, for 12 hours: "call me when the build is done."
- **In any other turn,** such as a subagent's report or a routine's run, it calls only:
  - on the bot's open call-back, which it uses up
  - or with the bot's **May call me on its own**, off by default, under `perDay` and outside `quiet`

  Otherwise: "The owner didn't ask for a call. Tell them in the chat, and they can ask you to call."
- **On a call already,** a call now refuses: "You're on a call with the owner now: just tell them." A call-back can still be kept.

The plugin tells the turns apart with `turn.start`: no `from` is the owner's typed turn, and a turn the call's words started or joined (`joined`) is the owner's spoken one. `reason` is up to 300 characters. The tool waits until the call is answered or isn't, and answers in words: "Answered." "Not answered after 30 seconds of ringing." "It went to voicemail, and I left the reason." "Busy." "The call failed: <Twilio's words>."

**`phone_hang_up()`**, on a call only: "Hanging up after this reply."

### The way in

The plugin's socket is `/api/plugins/phone/relay/:token`. The owner routes one public path to it on the machine whose 127.0.0.1 has fxbot's port, which in a release is the host:

```sh
tailscale funnel --bg --https=443 --set-path=/phone http://127.0.0.1:<port>/api/plugins/phone/relay
```

They set the plugin's `address` to `wss://<machine>.<tailnet>.ts.net/phone`. Any other proxy works, if it routes only that path: everything else on fxbot's port is the owner's whole app. Whether Funnel's `--set-path` keeps the token after the path, and carries the socket, is checked first ([Checklist](#4-checklist)).

The socket takes one connection for each call, and closes any other with no answer:
- the token must be the one made for a call that's placing now, used once
- `X-Twilio-Signature` must be Twilio's HMAC-SHA1 of `address` and the token, with the account's auth token, which is why the address is a setting: the public one is what Twilio signs

The raw-audio way would use the same path, carrying audio instead of text.

### The owner's number

The owner sets it in the plugin's settings tab, with Twilio's account. It isn't used until it's confirmed:
1. **Call me to confirm** places a call with inline `<Say>`, which reads a 4-digit code twice. No socket is needed.
2. The owner types the code in the tab. Until then, every call refuses: "The owner's number isn't confirmed yet."
3. Changing the number unconfirms it.

So a typo can't ring a stranger. The how-to has the owner save the Twilio number as a contact, such as "Bob (fxbot)": with Twilio's lowest caller-ID rating, that's what gets it past Silence Unknown Callers and makes "Spam Likely" rarer, and in a car the phone says who's calling.

### The page

- **Call me,** with `app.composer`: a phone button in the message box. When the plugin isn't set up, it opens the settings tab instead.
- **The call bar,** with `app.chat`, above the message box: "Ringing…", then "On the phone · 3:12" with **End call**. It reads `/calls/live` every 2 seconds while a call is placing or on, and every 15 while the chat is open and none is.
- **A call's card,** `app.toolView("call")`: the reason, ringing, on the call, then how it ended and how long it lasted.
- **The settings tab,** with `app.settings`:
  - Twilio's account, auth token, and number
  - the owner's number, with **Call me to confirm** and the code's box
  - the address, the voice and language, and the limits
  - the last 20 calls, each with its bot, time, how it ended, length, and price
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
  sid text,                                 -- the provider's id for it
  status text not null default 'placing',   -- placing, ringing, on, ended, voicemail, missed, busy, failed
  seconds int,
  price text,
  error text,
  at timestamptz not null default now(),
  answered_at timestamptz,
  ended_at timestamptz
);
create table callbacks (bot text primary key, reason text not null, until timestamptz not null);
create table bots (bot text primary key, on_its_own boolean not null default false);
```

A call's token is kept in memory only, so a restart can't reopen one. The confirmed number, and a code waiting to be typed, for 10 minutes, are kept with `fx.secrets`. The number is confirmed while `to` matches the confirmed one. Calls are kept 90 days. What was said is in the bot's chat, and nothing is recorded. Removing the plugin drops the schema.

### Settings (`plugin.json`)

| Setting | What it is | Default |
| --- | --- | --- |
| `account` | The Twilio account's SID | |
| `token` | Its auth token, sealed (`isSecret`), for calls and for checking Twilio's signature | |
| `from` | The Twilio number calls come from, such as +15551234567 | |
| `to` | The owner's phone, the only number called | |
| `address` | The public address that reaches the plugin's socket, such as `wss://box.example.ts.net/phone` | |
| `voice` | A ConversationRelay voice: an ElevenLabs voice's id and model, or a Google or Amazon voice | `UgBBYS2sOqTuMpoF3BR0-v4_turbo` |
| `language` | What the owner speaks | `en-US` |
| `minutes` | The longest call, 5 to 120 | `30` |
| `quiet` | Hours a bot doesn't call on its own, in the owner's time zone | `22:00-07:00` |
| `perDay` | The most calls one bot makes on its own in a day, 1 to 20 | `3` |

`FXBOT_PHONE_API`, read once at start, points the plugin at another address than Twilio's, for checks only, as the computer reads `FXBOT_COMPUTER_NAME`.

### Cost

- **Each request of each bot it's on for:** two tool definitions, about 250 tokens, cached with the rest, and the skill's line.
- **A call:**
  - Twilio: $0.084 a minute, so a 10-minute drive costs about $0.84. A bot's call adds $0.0075 for voicemail detection, and the number is $1.15 a month.
  - The bot's model: each thing the owner says is a turn on it, with the chat's context, which is cached.
  - fxbot: a socket of text, a read of the call every 3 seconds while it rings, and none while it's on.
- **Idle:** nothing on the server: no process, and no timer. A call-back ends by its time, read when a call asks. The page reads `/calls/live` every 15 seconds while a chat is open.

### Size

About 850 lines of code:
- `server.ts`: about 350
- `call.ts`: about 250
- `lines/twilio.ts`: about 120
- `page.jsx`: about 200
- the SQL: about 20

Plus the skill, the README, and a how-to. OpenClaw's voice-call plugin is about 18,000 lines, for three phone services and several ways to hold a conversation. This has one of each.

### Providers after this one

In order, each when this one is in use, and each a file:
1. **Telnyx's Conversation Relay,** `lines/telnyx.ts`, about 100 lines: the same frames for $0.057 a minute. It places calls with inline TeXML and a TeXML application made once, and checks Telnyx's Ed25519 signature. First, one real call settles whether Telnyx's "automated call" notice plays.
2. **The raw-audio way:**
   - `lines/cascade.ts` with Twilio's Media Streams, on the same account and `Calls.json`.
   - Deepgram is its voice, one key for Flux both ways, in μ-law, and its text to speech tells what was spoken when cut off.
   - About $0.04 a minute, 700 to 1,000 lines, and a phase of its own.
3. **More voices,** one file each, of about 120 to 180 lines:
   - text to speech: ElevenLabs v4 Turbo with the owner's own key, which allows a cloned voice; Cartesia's Sonic 3.6; Inworld's TTS-2; xAI's
   - speech to text: AssemblyAI, the best on phone audio in the one benchmark with phone audio; Soniox, at $0.002 a minute; ElevenLabs' Scribe; Cartesia's Ink; xAI's
4. **Telnyx's media,** the cheapest carrier, at $0.0105 a minute. With Telnyx's own speech sockets, the whole call costs $0.017 to $0.019 a minute on one key.
5. **Later still:**
   - voices on the machine, through a sidecar
   - a speech-to-speech line, Grok Voice with `force_message` or GPT-Live, for owners who want its speed
   - Cartesia's agents, once their protocol is documented

ElevenLabs' own agents stay off the list: they ask for each reply again after 4 seconds, and fxbot can't speak between their turns.

### Not in this phase

- **The providers after this one,** above.
- **A way with nothing open:** GPT-Live, once a real call proves its trunk, or a SIP line that registers out ([open question 3](#5-open-questions)).
- **Calling the bot,** such as "Hey Siri, call Bob" from the car. The same socket would take it, through a Twilio number whose TwiML Bin points at it, with caller ID and a keypad PIN, since "Caller ID is not proof" (hermes-line).
- **Approvals by voice.** They stay on the screen.
- **Voice in the app,** over web pairing, for the desk: the [Phone calls](phone-calls.md) stub.
- **Calling anyone else,** and texts: [Gateways](gateways.md).
- **Recording.** What was said is in the chat.

### What changes

- `plugins/phone/` (new, 0.1.0), and its entry in `packages/sdk/src/plugins-registry.json`.
- No change to the core or the plugin API, so no line in `plugin-breaks.json`.
- The docs:
  - a how-to, **Talk with a bot on the phone**, covering:
    - the Twilio account, upgraded from a trial, with the AI/ML addendum accepted
    - the number saved as a contact
    - confirming the owner's number
    - the Funnel command, and the address
  - the README's Phases line
  - `CHANGELOG.md` under `## Unreleased`

## 4. Checklist

The plugin's checks run against a fake Twilio, a small local server, through `FXBOT_PHONE_API`. It answers `Calls.json`, keeps each request, and plays Twilio's side of the socket: it connects to the relay with the signature, then sends `setup`, `prompt`, `interrupt`, and `tokens-played`, and keeps the `text` frames. They run with a mock model and a disposable fxbot. No check rings a real phone except the last group's.

**First, with the owner's go-ahead,** since it opens a public path on their tailnet:
- [ ] Funnel with `--set-path=/phone` to the relay path carries a WebSocket to a test socket, with the token after the path, and the signature computed over the public address matches. If it doesn't, change [The way in](#the-way-in) before building more.

**The plugin**
- [ ] `plugins/phone/` 0.1.0, with its migration, settings, skill, and README. `page.js` is built from `page.jsx` and committed. `npm run typecheck` passes, with its `minFxbot`.
- [ ] `call.ts` names no provider: it holds a call only through the line's `place`, `heard`, `interrupted`, `played`, `ended`, `say`, and `hangUp`.
- [ ] Confirming: **Call me to confirm** places a call whose `<Say>` reads a 4-digit code twice. The right code confirms, a wrong one doesn't, and changing `to` unconfirms. Before it's confirmed, every call refuses.
- [ ] **Call me:**
  - The fake gets `To`, `From`, `Timeout`, and `TimeLimit`.
  - It gets TwiML with the address, a fresh token, `welcomeGreeting` "Hey, this is your fxbot Bob. How can I help today?", Flux, the voice setting, `echoPromptFiltering`, `ignoreBackchannel`, and `tokens-played`.
  - Every value is escaped: a bot named `A&B "x"` speaks as written.
  - There's no `MachineDetection`.
  - A second **Call me** while one rings refuses.
- [ ] **The socket** refuses a missing token, a wrong one, a used one, one for a call that ended, and a wrong signature. It takes the call's.
- [ ] **A conversation:**
  - A `prompt` becomes a message in the bot's own chat, showing the owner's words with the label and carrying the note and `asked`.
  - The mock reply comes back as `text` frames by sentence, with `last` at its end.
  - Markdown, a link, and a code block come out speakable.
- [ ] **Fillers:** a slow mock turn gets "One moment." once at 1.5 s. A tool that runs 45 s gets "Still working on it." twice.
- [ ] **Steer:** a `prompt` while a turn runs joins it (`joined`), and the reply that follows is spoken.
- [ ] **Interrupt:** the rest of that reply isn't sent, and the next message carries what was heard.
- [ ] **Stop words:** "stop" cancels the call's turn, says "Okay, stopped.", and reaches no message. "Hold on" alone reaches none. "Stop the build when it's red" goes to the bot.
- [ ] **A subagent's report** during a call is spoken.
- [ ] **Ending:**
  - `phone_hang_up` sends `end` after the fake's `tokens-played` for the last words, and after the timer when the fake sends none.
  - 60 s idle ends the call, after its words.
  - The minute's warning comes before `minutes`.
  - **End call** sends `Status=completed`.
  - The fake closing the socket marks the call ended, with its `duration` and `price` read after.
- [ ] **`phone_call`:**
  - In the owner's typed turn, and in a call's turn, it calls.
  - `later: true` keeps a call-back and calls no one.
  - A subagent's report then calls on it, and uses it up.
  - With no call-back, a background turn refuses. With **May call me on its own**, it calls outside `quiet`, refuses inside it, and stops at `perDay`.
  - On a call, a call now refuses, and `later: true` still keeps a call-back.
- [ ] **A bot's call:**
  - `MachineDetection=Enable`, and no `welcomeGreeting`.
  - With `answered_by` a person, the plugin sends the greeting and the reason.
  - With a machine, it sends its one line, ends the call, and the tool says voicemail.
- [ ] **A restart** while the fake rings, and while it's on: nothing is placed again, and the row gets how the call ended.
- [ ] **The page:** **Call me**, the bar's ringing, its time, and **End call**, the call's card, the settings tab with the code and the last calls, and a bot's section with **May call me on its own** and **Remove**.

**The docs**
- [ ] The how-to, the plugin's README, `CHANGELOG.md`, and the README's Phases line. `npm run build-site` passes.

**Only a person can check**
- [ ] On a paid Twilio account with the AI/ML addendum accepted, through Funnel:
  - **Call me** rings the owner's phone from the saved contact.
  - It greets in exact words, in the v4 Turbo voice, as they answer.
  - A question gets the bot's answer, and the time to its first word is noted.
- [ ] **What Twilio sends:** `tokens-played`'s fields are written down, and the hang-up uses them in place of the timer.
- [ ] **Talking over the bot** stops it, and it knows where. "Stop" stops work it started.
- [ ] **On speaker,** and in a car over Bluetooth or CarPlay, the bot's own voice doesn't cut it off. An "uh-huh" doesn't either. Answering from the steering wheel works. Flux hears the owner over road noise.
- [ ] **A call-back:** "call me when the subagent is done" rings when it is, and opens with the result.
- [ ] **Voicemail:** a call the bot makes, left to ring, leaves its line on voicemail.
- [ ] **The bill:** the call's price on Twilio's bill matches the settings tab.

## 5. Open questions

1. **The first target:** Twilio's ConversationRelay, with ElevenLabs v4 Turbo and Deepgram Flux? Recommended: yes. It's the simplest and the best-sounding, and its cost, about $18 a month for 20 drives of 10 minutes, buys back 700 to 1,000 lines and two accounts.
2. **The order after it:** Telnyx's relay, then the raw-audio way with Twilio and Deepgram, then one file for each voice, then Telnyx's media? Recommended: as in [Providers after this one](#providers-after-this-one). Telnyx's relay is a small follow-up once a real call settles its notice. The raw-audio way is a phase of its own.
3. **The way in.** Recommended: one Funnel path, as planned. With nothing open, there's only GPT-Live, which talks for the bot, may reword it, and hasn't rung a real phone through a trunk, or a SIP line that needs a second container. Try GPT-Live when OpenAI's pages agree and a trunk is proven.
4. **The bot's own chat** for a call, not a session of the call's own? Recommended: its own chat. The call shares the bot's memory of the day, joins work that's running, and leaves the conversation where the owner reads it later.
5. **May call me on its own,** off by default, 3 a day, outside quiet hours? Recommended: as written. The owner's own asks, "call me" and "call me when", need no setting.
6. **Calling the bot** from the car, with a keypad PIN, next? Recommended: as its own phase, once calling out is in use.
7. **A voice for each bot,** in a bot's section, or the owner's own cloned voice? Recommended: one voice for the plugin first. A voice for each bot is a column later. A cloned voice needs ElevenLabs with the owner's own key, which ConversationRelay doesn't take, so it comes with the raw-audio way.
8. **Approvals while driving.** A card the bot needs waits on the screen, and in a call's turn it expires after Permissions' `expires`, 30 minutes, as any background card does. Recommended: as is, with the note telling the bot to say so. Permissions could later keep a call's card open until the call ends.
