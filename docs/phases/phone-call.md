# Phone call

`phone` lets the owner talk with a bot by voice, on a real phone call:
- **Press Call me, and the bot rings your phone.** Answer and it says "Hey, this is your fxbot Bob. How can I help today?" Then you talk back and forth, as you'd chat by text, with your hands on the wheel.
- **It's the bot itself on the line.** What you say goes to the bot's own chat, and its own model, memory, and tools answer. Its words are read out as it writes them, and the chat keeps the whole conversation.
- **The bot can call you too, when you asked it to.** For example "call me when the build is done": the call opens with why it rang, and the conversation goes on from there.
- **Only your phone.** You set your number once and confirm it, and no tool takes a number.

The phone service, Twilio, turns speech into text and text into speech. fxbot trades only text with it, over one connection that Twilio opens for each call. That connection needs one public path to fxbot, which the owner routes through Tailscale Funnel or a proxy of their own. Ways with nothing open, and their costs, are in [open question 1](#5-open-questions).

Status: planned on 2026-11-14 at the owner's word, not built. It replaces the same day's plan for a call that only read a message out: the owner wants a conversation. Researched against the research directive's references, OpenClaw, Hermes Agent and its phone plugins, Twring, the coding-agent phone projects, ChatGPT, Home Assistant, the phone services, and the realtime voice models, read on 2026-11-14. It needs no change to the plugin API.

## What the owner asked

- "I want to get these two things launched on fxbot such that the bot is able to make outgoing phone calls when asked and approved (to my phone) and the agent is able to use herdr to see agent activity and access the rest of my ai lab." (2026-11-14; the herdr half is [herdr](../_completed/phases/herdr.md).)
- Then, of the first plan: "I want the bot to call me and we have a live conversation. So I click a button and it calls me and says "Hey this is your fxbot <name>, how can I help today?" and then I can start talking to it back and forth via voice instead of text chat. So that I can control it while driving hands free etc... gpt-live is one option, there are many out there" (2026-11-14).

## 0. Core or plugin

**A plugin**, `phone` ([Core or plugin](../../CONVENTIONS.md#core-or-plugin)). A phone service isn't what every bot needs, what plugins plug into, or what fxbot needs to run. It costs money, needs an account and a public path, and not every owner wants it. It's in fxbot's list, off until added, and not in **Essentials**.

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

From the services' docs, price pages, npm, and each project at its commit or in its docs, read on 2026-11-14. Prices are US list prices that day, and they change. Nothing here placed a call or opened a tunnel.

### What decides the design

Two questions:
1. **Who thinks?** The bot's own model, with its memory and tools, or a voice model in front of it that hands work over.
2. **What has to reach fxbot?** fxbot listens only on its own machine.

**Every phone service that streams a live call connects to the app.** Twilio's Media Streams and ConversationRelay "accept secure WebSocket connections (TCP port 443) from Twilio," from "any public IP address" ([Media Streams](https://www.twilio.com/docs/voice/media-streams)). Telnyx, Vonage, Plivo, SignalWire's streams, and Bandwidth are the same.

**So does every hosted voice agent that lets your own model think.** Vapi, Retell, ElevenLabs, Telnyx's assistants, and Ultravox all call a public URL of yours, and Vapi refuses a private address outright ([Vapi](https://docs.vapi.ai/customization/custom-llm/using-your-server)).

So the ways with nothing reaching fxbot are the ones where someone else holds the call and fxbot connects out to them. The ways, side by side, with the price per minute leaving out the bot's own model, which is the same in each:

| Way | Who thinks | What reaches fxbot | Per minute | What it costs fxbot |
| --- | --- | --- | --- | --- |
| **Twilio ConversationRelay**: Twilio does speech both ways, fxbot trades text | the bot, its words spoken as written | one `wss://` path | $0.084 ($0.07 + $0.014 to a US phone) | a socket of text |
| **OpenAI GPT-Live**, outbound over a SIP trunk, with client delegation | GPT-Live talks, and hands work to the bot | nothing: fxbot holds a WebSocket out | about $0.06 ($0.05 + the trunk) | a WebSocket client |
| **LiveKit Cloud**, an agent with the bot's turn as its model, and a trunk | the bot | nothing | about $0.03–0.06, 1,000 minutes free | a 36 MB package with a 26 MB native binding, which a plugin can't carry |
| **SignalWire RELAY**: collect speech, run the turn, play speech | the bot | nothing | $0.008 + $0.015 per 15 s of speech recognized | a turn at a time: no interrupting, unverified |
| **A SIP line** that registers out, such as Asterisk in a container, with speech in fxbot | the bot | nothing, if the provider and the router let the audio back in | about $0.005–0.02, plus speech | a second container, speech, and RTP through NAT, which Twilio and Telnyx don't document |
| **Pipecat with Daily** dial-out | the bot | nothing | about $0.035–0.07 | a Python sidecar, and dial-out approval from Daily |
| **Telnyx Conversation Relay**, the same frames as Twilio's | the bot | one `wss://` path | $0.057 | the same socket |

Sources:
- ConversationRelay: [overview](https://www.twilio.com/docs/voice/conversationrelay), [TwiML](https://www.twilio.com/docs/voice/twiml/connect/conversationrelay), [messages](https://www.twilio.com/docs/voice/conversationrelay/websocket-messages), [prices](https://www.twilio.com/en-us/voice/pricing/us)
- GPT-Live: [SIP](https://developers.openai.com/api/docs/guides/voice-sip.md), [delegation](https://developers.openai.com/api/docs/guides/live-delegation.md)
- LiveKit: [nodes](https://docs.livekit.io/agents/build/nodes/), [prices](https://livekit.com/pricing)
- SignalWire RELAY: [reference](https://signalwire.com/docs/server-sdks/reference/typescript/relay)
- Asterisk: [WebSocket channel](https://docs.asterisk.org/Configuration/Channel-Drivers/WebSocket)
- Pipecat with Daily: [dial-out](https://docs.pipecat.ai/guides/telephony/daily-pstn)
- Telnyx: [Conversation Relay](https://developers.telnyx.com/docs/voice/programmable-voice/conversation-relay)
- fxbot's own: web pairing's [WebRTC in Node](../_completed/phases/web-pairing.md#webrtc-in-node), on why a native addon can't be in a plugin

**GPT-Live, closer.**
- OpenAI's guide says outbound SIP is "available to all organizations" and needs "no incoming-call webhook," but other copies of the same page say it isn't supported and list `403 outbound_sip_not_enabled`.
- It requires a `sips:` trunk address, and Twilio's docs say Twilio "does not support the sips scheme." Telnyx's GPT-Live guide covers incoming calls only. No one in these sources has called a real phone this way.
- With client delegation, GPT-Live holds the conversation and decides when to hand over. Its delegation event carries no text, so the app rebuilds the request from the transcript. What the bot writes back "the model may paraphrase," and so may the greeting.
- The bot is in charge only as far as GPT-Live's instructions keep it.

**ConversationRelay, closer.**
- `welcomeGreeting` is spoken the moment the call connects, word for word. `interruptible` defaults to `any`: Twilio stops speaking when the owner talks, and sends `interrupt` with `utteranceUntilInterrupt`, what the owner heard before they cut in.
- The app sends `text` frames at any time, with `last` on a reply's end, so a filler is one frame.
- Speech-to-text is Deepgram by default, or Google. Text-to-speech is ElevenLabs by default, or Google or Amazon.
- An outbound call takes its TwiML inline in `Calls.json`, so only the socket reaches fxbot, as the earlier plan found for `<Say>`.
- Twilio signs the socket's opening with `X-Twilio-Signature`, an HMAC of the address with the account's auth token ([security](https://www.twilio.com/docs/usage/webhooks/webhooks-security)).

**A public path.**
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
  - Twilio's own target for a turn is 1.1 seconds, end of speech to reply.
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
2. **The phone service does the speech, and fxbot trades text.** ConversationRelay is the smallest way to do that: an exact greeting, interruptions with what was heard, and fillers as frames. It's what OpenClaw runs, with no audio, codecs, or ports in fxbot.
3. **It costs one public path,** and only one, through Funnel or the owner's own proxy. Each call has a token of its own, and Twilio's signature is checked. Each way with nothing open costs more than that path:
   - GPT-Live puts a voice model in charge, and is unproven with a trunk.
   - LiveKit needs native code a plugin can't carry.
   - A SIP line needs a second container, and audio through NAT.

   They come later ([open question 1](#5-open-questions)).
4. **The greeting is the owner's words, said by Twilio the moment they answer.** A call the bot makes opens with why it called, and the bot hears what was said.
5. **Fill the wait with true things:** "One moment." once, then "Still working on it." while a turn runs. Hand long work to a subagent, and the result is read out if the call's still on.
6. **What the owner says joins the running turn** with `steer`, so work isn't lost. "Stop" cancels, and words that only take the floor are kept from the bot.
7. **Approvals stay on the screen.** Nothing is approved by voice.
8. **Caps the server owns:** one call at a time, a length cap, an idle hangup, the owner's number only, and a day's cap on calls a bot makes on its own.

## 3. Implementation

### The plugin

`plugins/phone/`, version 0.1.0, in fxbot's list, not in **Essentials**:
- `plugin.json`: settings, and `minFxbot`, the oldest release with what it uses (0.9.0 by the API's `Since` notes, confirmed by `scripts/check-plugins.mjs`)
- `fxbot/server.ts`: the tools, the routes, the call records, call-backs, and confirming the number
- `fxbot/call.ts`: a live call: the socket's frames, what the owner says into the chat, the reply out as speech, fillers, stop words, interruptions, and the limits
- `fxbot/twilio.ts`: placing a call with its TwiML, reading it, ending it, and checking Twilio's signature, the only file that knows the phone service
- `fxbot/page.jsx`, built to `page.js` with the rolldown command in its README
- `fxbot/migrations/0001_phone.sql`
- `skills/phone/SKILL.md`, `README.md`

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
           language="en-US" voice="…" interruptible="any" hints="Bob" />
       </Connect>
     </Response>
     ```

   The token is 32 random bytes, made for this call. The bot's name comes from its profile.
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

`fxbot/call.ts` holds one live call: its bot, its token, the bot's own chat, and what's being said.

**What the owner says** comes as Twilio's `prompt` frames, with `voicePrompt` and `last`. Each finished utterance goes to the bot's own chat:

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
- It gathers `text_delta`s into sentences and sends each as a `text` frame, with `last: true` at `turn_end`.
- Before a sentence goes, it's made speakable:
  - markdown marks go
  - a link is said as "a link in the chat"
  - a code block or table is said once as "There's more in the chat"

**Fillers,** only from what's true:
- "One moment." once a turn, when 1.5 seconds pass after the owner's words with nothing to say.
- "Still working on it." every 20 seconds while a tool runs and nothing else is said.

**Interruptions.**
- Twilio stops speaking when the owner talks, and sends `interrupt` with what was heard. The plugin drops the rest of that reply and keeps what was heard.
- The owner's next words go to the bot with "(They cut you off after: "…")", so it knows where they stopped listening.
- The turn itself keeps running.

**Words the bot never gets:**
- **Stop words:** an utterance that's only "stop", "cancel", or "never mind", with at most the bot's name or "okay", cancels the call's running turn with `fx.chats.cancel(bot)`. The plugin says "Okay, stopped." itself. A turn the call didn't start, such as the owner's typed one, isn't the plugin's to stop, so it says "That one isn't mine to stop from here."
- **Floor words:** an utterance that's only "wait", "hold on", "one second", or "sorry" isn't sent: Twilio has stopped speaking already.

**Ending.**
- **The owner hangs up:** Twilio closes the socket.
- **The bot:** `phone_hang_up` ends the call once its turn ends and its last words have had time to be heard. Whether ConversationRelay tells when speech has played is unverified. Until it does, the plugin waits about 70 ms a character, up to 10 seconds, then sends `end`.
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

### The owner's number

The owner sets it in the plugin's settings tab, with Twilio's account. It isn't used until it's confirmed:
1. **Call me to confirm** places a call with inline `<Say>`, which reads a 4-digit code twice. No socket is needed.
2. The owner types the code in the tab. Until then, every call refuses: "The owner's number isn't confirmed yet."
3. Changing the number unconfirms it.

So a typo can't ring a stranger. The how-to has the owner save the Twilio number as a contact, such as "Bob (fxbot)": that gets it past Silence Unknown Callers, makes "Spam Likely" rarer, and in a car the phone says who's calling.

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
  sid text,                                 -- Twilio's id for it
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
| `voice` | A ConversationRelay voice, such as an ElevenLabs voice's id; empty is Twilio's default | empty |
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

About 800 lines of code:
- `server.ts`: about 350
- `call.ts`: about 250
- `twilio.ts`: about 80
- `page.jsx`: about 200
- the SQL: about 20

Plus the skill, the README, and a how-to. OpenClaw's voice-call plugin is about 18,000 lines, for three phone services and several ways to hold a conversation. This has one of each.

### Not in this phase

- **A way with nothing open:**
  - GPT-Live, once a real call proves its trunk
  - a SIP line that registers out, for calls both ways and speech on the machine

  Each would be a second file beside `twilio.ts` ([open question 1](#5-open-questions)).
- **Calling the bot,** such as "Hey Siri, call Bob" from the car. The same socket would take it, through a Twilio number whose TwiML Bin points at it, with caller ID and a keypad PIN, since "Caller ID is not proof" (hermes-line).
- **Approvals by voice.** They stay on the screen.
- **Voice in the app,** over web pairing, for the desk: the [Phone calls](phone-calls.md) stub.
- **Calling anyone else,** and texts: [Gateways](gateways.md).
- **Another phone service.** Telnyx's Conversation Relay has the same frames for about $0.057 a minute, as a second file when an owner asks.
- **Recording.** What was said is in the chat.

### What changes

- `plugins/phone/` (new, 0.1.0), and its entry in `packages/sdk/src/plugins-registry.json`.
- No change to the core or the plugin API, so no line in `plugin-breaks.json`.
- The docs:
  - a how-to, **Talk with a bot on the phone**: the Twilio account and its upgrade from a trial, the number saved as a contact, confirming the owner's number, the Funnel command, and the address
  - the README's Phases line
  - `CHANGELOG.md` under `## Unreleased`

## 4. Checklist

The plugin's checks run against a fake Twilio, a small local server, through `FXBOT_PHONE_API`. It answers `Calls.json`, keeps each request, and plays Twilio's side of the socket: it connects to the relay with the signature, then sends `setup`, `prompt`, and `interrupt` and keeps the `text` frames. They run with a mock model and a disposable fxbot. No check rings a real phone except the last group's.

**First, with the owner's go-ahead,** since it opens a public path on their tailnet:
- [ ] Funnel with `--set-path=/phone` to the relay path carries a WebSocket to a test socket, with the token after the path, and the signature computed over the public address matches. If it doesn't, change [The way in](#the-way-in) before building more.

**The plugin**
- [ ] `plugins/phone/` 0.1.0, with its migration, settings, skill, and README. `page.js` is built from `page.jsx` and committed. `npm run typecheck` passes, with its `minFxbot`.
- [ ] Confirming: **Call me to confirm** places a call whose `<Say>` reads a 4-digit code twice. The right code confirms, a wrong one doesn't, and changing `to` unconfirms. Before it's confirmed, every call refuses.
- [ ] **Call me:** the fake gets `To`, `From`, `Timeout`, and `TimeLimit`. It gets TwiML with the address and a fresh token, and `welcomeGreeting` "Hey, this is your fxbot Bob. How can I help today?", escaped: a bot named `A&B "x"` speaks as written. There's no `MachineDetection`. A second **Call me** while one rings refuses.
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
  - `phone_hang_up` sends `end` after the reply.
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
- [ ] On a paid Twilio account, through Funnel:
  - **Call me** rings the owner's phone from the saved contact.
  - It greets in exact words as they answer.
  - A question gets the bot's answer, and the time to its first word is noted.
- [ ] **Talking over the bot** stops it, and it knows where. "Stop" stops work it started.
- [ ] **On speaker,** and in a car over Bluetooth or CarPlay, the bot's own voice doesn't cut it off. Answering from the steering wheel works.
- [ ] **A call-back:** "call me when the subagent is done" rings when it is, and opens with the result.
- [ ] **Voicemail:** a call the bot makes, left to ring, leaves its line on voicemail.
- [ ] **The bill:** the call's price on Twilio's bill matches the settings tab.

## 5. Open questions

1. **The way in.** Recommended: ConversationRelay through one Funnel path, as planned. It keeps the bot in charge, word for word, with the least code. The others, later, as a second file:
   - **GPT-Live:** nothing open, and turn-taking at a speech model's speed, for about $0.06 a minute. But GPT-Live talks and the bot works behind it, its words can be reworded, it's OpenAI's voice only, and no one has rung a real phone through a trunk with it. Try it when OpenAI's pages agree and a trunk is proven.
   - **A SIP line that registers out:** nothing open, calls both ways, and speech on the machine, at the cost of a second container and audio through NAT that has to be tried on real routers.
2. **Twilio first, and only Twilio,** with Telnyx's Conversation Relay as a second file when an owner asks? Recommended: yes.
3. **The bot's own chat** for a call, not a session of the call's own? Recommended: its own chat. The call shares the bot's memory of the day, joins work that's running, and leaves the conversation where the owner reads it later.
4. **May call me on its own,** off by default, 3 a day, outside quiet hours? Recommended: as written. The owner's own asks, "call me" and "call me when", need no setting.
5. **Calling the bot** from the car, with a keypad PIN, next? Recommended: as its own phase, once calling out is in use.
6. **A voice for each bot,** in a bot's section? Recommended: later. One voice for the plugin first.
7. **Approvals while driving.** A card the bot needs waits on the screen, and in a call's turn it expires after Permissions' `expires`, 30 minutes, as any background card does. Recommended: as is, with the note telling the bot to say so. Permissions could later keep a call's card open until the call ends.
