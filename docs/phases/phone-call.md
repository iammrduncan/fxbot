# Phone call

`phone` lets a bot call the owner's own phone, when the owner asked for it and said yes:
- **Only the owner's phone.** The owner sets their number once, in the plugin's settings. No tool takes a number, so a bot can't call anyone else.
- **Only with the owner's yes, given ahead.** A bot asks with `phone_ask`, which shows a card in its chat: "Bob would like to call you once, by 07:30 tomorrow: to wake you for your flight." **Allow** gives it that call. A bot can also be allowed to call without asking, up to a few times a day and never in quiet hours, which is off unless the owner turns it on.
- **The phone rings, and the bot speaks.** `phone_call` rings the owner and reads the bot's message, twice, in a voice that says who's calling, and leaves it as a voicemail if no one picks up. The bot learns whether the call was answered, missed, or went to voicemail.
- **Nothing opens to the internet.** fxbot asks the phone service to place the call and reads how it went. The phone service never calls fxbot back, so fxbot still listens only on its own machine.

Talking back on the call, a real conversation with the bot, needs the call's sound to reach a model and come back while it lasts: a way in to fxbot, or a realtime voice service. It's the next step, in [open question 1](#5-open-questions).

Status: planned on 2026-11-14 at the owner's word, not built. It plans the part of the [Phone calls](phone-calls.md) stub where a bot calls the owner. Talking with a bot in the app, and calling a bot, stay there. Researched against the research directive's references, OpenClaw's voice-call plugin, Hermes Agent, and the phone services' own docs and prices, read on 2026-11-14. It needs one small change to the plugin API: a word on a tool that says it asks the owner itself, so Permissions doesn't ask again.

## What the owner asked

"I want to get these two things launched on fxbot such that the bot is able to make outgoing phone calls when asked and approved (to my phone) and the agent is able to use herdr to see agent activity and access the rest of my ai lab." (2026-11-14; the herdr half is [herdr](../_completed/phases/herdr.md).)

## 0. Core or plugin

**A plugin**, `phone` ([Core or plugin](../../CONVENTIONS.md#core-or-plugin)). A phone service isn't what every bot needs, what plugins plug into, or what fxbot needs to run. It costs money, needs an account with a phone service, and not every owner wants a bot that can ring them. The [Phone calls](phone-calls.md) stub already says plugin. It's in fxbot's list, off until added, and not in **Essentials**.

**One small change to the plugin API.** A call needs the owner's yes, which the plugin gets on its own card, often hours ahead: "call me at 7" is a yes at night for a call in the morning. Permissions, if it's added, asks about every call that reaches outside, and a call does. In `ask` mode it would show a second card at 7, in a turn the owner isn't there for, which expires after 30 minutes, and the call the owner said yes to would fail. Permissions runs a `safe` tool without asking, but a call isn't safe: it rings a phone and costs money. So a tool gets a second word beside `safe`:
- `asks: true` on a `PluginTool`: "It runs only on a yes the owner gave its plugin, on a card of the plugin's own." It reaches `tool.before` as `asks`, as `safe` does (`packages/sdk/src/plugins.ts:716`, `:752`).
- Permissions runs a call with `asks` as it runs a safe one (`plugins/permissions/fxbot/server.ts:184`), and goes to the next version.

It's for any plugin with a yes of its own, such as a payment or a message to someone else, and a plugin that marks a tool with it says so in its README. A plugin's code is trusted as it is today: one that marked every tool `asks` could mark every tool `safe` already.

**Why not only Permissions,** with no card of the plugin's own. Permissions asks at the moment of the call. For "call me when the build is done" or "wake me at 7", the owner isn't there at that moment, which is why they want a call. The yes has to come first, in the chat where they asked, and last until the call.

## 1. Research

From the services' docs, price pages, and npm, and each reference at its 2026-11-13 commit or in its docs, read on 2026-11-14. Prices are US list prices that day, and they change. Nothing here placed a call.

### What a call needs from fxbot

The question that decides the design: what does the phone service have to reach on fxbot? fxbot listens only on its own machine, so anything the service calls back, a webhook or a stream, is a way in that fxbot doesn't have.
- **Twilio places a call with its instructions inline.** `POST /2010-04-01/Accounts/{sid}/Calls.json` takes `To`, `From`, and `Twiml`, TwiML of up to 4,000 characters, "without fetching Twiml from url." `Timeout` is how long it rings, `TimeLimit` the call's longest, and `MachineDetection` (`Enable` or `DetectMessageEnd`) tells a person from a voicemail, holding the call until it knows, for $0.0075 a call.
- **And fxbot reads how it went.** `GET .../Calls/{sid}.json` has `status` (`queued`, `ringing`, `in-progress`, `completed`, `busy`, `no-answer`, `failed`, `canceled`), `duration`, `answered_by` when detection was on, and `price` once it's known. Polling it replaces the status callback.
- **So a call that speaks needs no way in.** Hermes Agent's telephony skill does exactly this: inline `<Say>`, and polling. OpenClaw's voice-call plugin uses inline TwiML too, but asks for status and detection callbacks, so even its calls that only speak need a public URL, and its setup fails on loopback.
- **A key press does need one.** `<Gather>` sends the digits only to its `action` URL, and Twilio documents no other way to read them.
- **So does a conversation over Twilio.** Media Streams and ConversationRelay both have Twilio connect to a public `wss://` address on port 443. OpenClaw does it through a tunnel, ngrok or Tailscale Funnel, which can expose one path on 443, 8443, or 10000.
- **Plain `fetch` is enough.** Basic auth with an API key and a form body. The `twilio` npm package is 16.9 MB in 1,539 files; OpenClaw and Hermes don't use it.

### Twilio, for an owner

- **Price:** $0.014 a minute to a US phone, $1.15 a month for a local number, $0.0075 a call for voicemail detection. Twilio's basic voices are free. Its Standard, Neural, and Generative voices cost $0.0008, $0.0032, and $0.013 for each 100 characters.
- **A trial account doesn't fit.** It calls only numbers verified on it, from a shared trial number, plays a trial message the callee has to press a key through, and gives 75 minutes in 30 days. Its page also lists only Twilio's template URLs for API calls, so inline TwiML on a trial is unconfirmed. The owner upgrades.
- **Spam labels.** Without a business profile in Twilio's Trust Hub, a call is signed with STIR/SHAKEN's lowest level, C, which makes "Spam Likely" more likely. A number the owner saves as a contact is the practical fix, and it gets past iPhone's **Silence Unknown Callers** too.
- **Its own number, or the owner's.** `From` is a number bought on the account, or a verified caller ID; a verified one is signed at B at best.
- **API keys** are Twilio's preferred way in, and can be revoked on their own. Whether one can be limited to calls is unconfirmed.

### The other services

- **Telnyx** has the same shape, inline TeXML and a call to fetch, for about $0.007 a minute and $1 a month for a number. It needs a TeXML application first, and it's untested without a webhook.
- **Plivo** requires an `answer_url` for every call, so even speaking needs a public URL. **Vonage** takes inline instructions, but requires an `event_url`. **SignalWire** is Twilio-shaped; its inline parameter is undocumented.
- **Hosted voice agents,** ElevenLabs ($0.08 a minute), Vapi ($0.05 plus each part), Retell, Bland ($0.14), and CALL-E (about $0.22 a minute), all start a call by API and give the transcript by polling, with no way in. But their own model runs the call: a model of the owner's own, or fxbot's tools during the call, needs a public URL, and Vapi refuses a private address outright.
- **LiveKit** dials out through a SIP trunk, and its agent connects out, so there's no way in. But its Node agent is 36 MB with a 26 MB native binding, it's another account, and its health check listens on every address by default.
- **OpenAI's GPT-Live** places an outbound call over a SIP trunk the owner brings, with TLS and SRTP. fxbot would hold a WebSocket out to OpenAI for the call's events, and with **client delegation** the bot's own model does the thinking while GPT-Live speaks. It costs $0.05 a minute plus the trunk. It's weeks old: on the day these docs were read, OpenAI's own pages disagreed on whether outbound has to be turned on for an organization first, and no one here has tried the trunk end to end. OpenAI's older Realtime SIP takes inbound calls only, with a webhook.

### How others ship it

- **Grok Bot** has the closest feature: "Have a Bot make a phone call," in the US, to businesses. It shows calling terms the first time, then a card before each call with who it will call, **Call** or **Cancel**. During the call: a live transcript, **End call**, and **Take over**. A question the other side asks that the bot can't answer becomes a card for the user, with a deadline. Afterward, the transcript and the recording.
- **OpenClaw's voice-call plugin** calls through Twilio, Telnyx, or Plivo, in a notify mode and a conversation mode, at most one at a time, 5 minutes each, ringing 30 seconds. Its owner's number, `toNumber`, is only the default: the tool takes any `to`, with no list of who may be called and no approval of its own.
- **Hermes Agent's** telephony skill says first: "Always confirm before placing a call or sending a text." Of its community plugins, **hermes-call-me** calls one allowed owner number through CALL-E, up to 8 times a day, one at a time, and polls, and **hermes-phone** and **hermes-line** need a public URL or a tunnel.
- **OpenBot** confirms the owner's number with a Twilio Verify code before it texts it. Its "calls," like **OpenDots'** and Grok Bot's voice chat, are voice in the app, over WebRTC, not phone lines. OpenDots' is the cleanest small one: the voice model has a single tool that runs a turn of the text conversation, one call at a time, 15 minutes, 6 turns, and a receipt afterward of "only confirmed decisions." OpenBot: "calls do not automatically reconnect or repeat actions."
- **eve** has a Twilio channel for calls and texts coming in, with a required `allowFrom` list, Twilio's signatures checked, and approvals sent as numbered texts, even to someone on a call. It has no outbound call. Its docs cover disclosure, consent, and quiet hours.
- **Pi's** p2 has voice in the app, with its own speech server. **fx, fx0, durable-harness, agent-browser, agent-desktop, OpenDuet, and OpenFuse:** nothing on calls. xAI's own SIP is inbound only. Poke calls through Bland's MCP server.

### fxbot today

- **A turn's owner:** a turn with no `from` on `turn.start` is the owner's own, in the bot's own chat. Any other, such as a routine's, a subagent report's, or a message from another bot, is background. Permissions tells them apart this way (`plugins/permissions/README.md`, Who's there).
- **Cards above the message box:** Permissions draws its cards with `app.chat`, which gets the bot, and reads `/asks`, every 15 seconds and every 3 while one is open, with `POST /asks/:id` for the answer (`plugins/permissions/fxbot/page.jsx:132`, `server.ts:216-222`).
- **A call at a time:** routines takes one local time as well as cron, and a run is a background turn with every tool the bot has (`plugins/routines/README.md`). "Wake me at 7" is a routine whose task is to call.
- **Settings** in `plugin.json` take `isSecret`, sealed with the rest and opened on the server (`packages/sdk/src/types.ts:278`). The owner's time zone is `fx.timeZone()`.
- **A tool's wait:** a tool's `execute` gets the turn's `signal`, so a tool that waits for a card or a call stops when the turn does.

## 2. Key takeaways

1. **A call that speaks needs no way in.** Inline TwiML to place it and polling to follow it, as Hermes does. OpenClaw needs a public URL even to speak only because it asks for callbacks. So this phase opens nothing, and talking back, which needs a way in or a realtime service, is the next one.
2. **One number, the owner's, confirmed, and never a tool's input.** OpenClaw's tool takes any `to`, and that's what to avoid. hermes-call-me allows one number, and OpenBot confirms it with a code first.
3. **A yes before every call, from the owner, in the app.** Grok Bot's card before each call and Hermes's "always confirm" agree. But the owner wants a call when they're away from the app, so the yes comes first, in the chat where they asked, and covers a call later: a count and an end time. Approvals stay in the app, never by voice (eve, Grok Bot).
4. **Limits the bot can't talk past.** A day's cap (hermes-call-me: 8), one call at a time (OpenClaw, hermes-call-me, OpenDots), a ring of 30 seconds and a short call (OpenClaw), and quiet hours for any call the owner didn't time (eve).
5. **The outcome in words, and no call again by itself.** Answered, missed, voicemail, busy, or failed, from the service's own status. The bot decides what's next, as OpenBot's calls "do not automatically reconnect or repeat actions." A call isn't idempotent: a crash never rings twice.
6. **Twilio, with `fetch`.** Its no-webhook path is documented, it's what most owners know, and its SDK is 17 MB of what one form post does. Telnyx is cheaper and the same shape, but untested without a webhook, so it can come later as a second file.
7. **Leave it on voicemail.** `DetectMessageEnd` waits for the beep, so a missed call still delivers the message, for $0.0075.
8. **The owner's phone has to let it ring.** A paid account, a bought number, and that number saved as a contact, against trial messages, spam labels, and silenced unknown callers. The how-to says so first.

## 3. Implementation

### The plugin

`plugins/phone/`, version 0.1.0, in fxbot's list, not in **Essentials**:
- `plugin.json`: settings, and `minFxbot` `0.11.0`, the release with `asks`
- `fxbot/server.ts`: the tools, the yeses, and the routes
- `fxbot/twilio.ts`: placing a call and reading how it went, the only file that knows the phone service
- `fxbot/page.jsx`, built to `page.js` with the rolldown command in its README: the card, the call's card, the settings tab, and a bot's section
- `fxbot/migrations/0001_phone.sql`
- `skills/phone/SKILL.md`, `README.md`

### The owner's number

The owner sets it in the plugin's settings tab, with the phone service's account. It isn't used until it's confirmed:
1. **Call me to confirm** places a call that reads a 4-digit code, twice.
2. The owner types the code into the tab. Until then, every call refuses: "The owner's number isn't confirmed yet."
3. Changing the number unconfirms it.

So a typo can't ring a stranger, and the owner hears what a call sounds like before a bot ever makes one (OpenBot confirms a number with a code the same way).

### A yes

A **yes** is the owner's tap on a card: one bot, a reason, a number of calls, and a time it ends. Nothing else gives one: no tool, no rule, and no other plugin.

**`phone_ask({ reason, calls?, by? })`**, `safe` and `idempotent`, keyed by its turn and its input, so a call run again after a crash finds the same card:
- Only in the owner's own turn in the bot's own chat, as Permissions tells them apart: the owner is there to answer. Anywhere else: "The owner isn't here to say yes. Tell them in your chat, and they can ask you again."
- `reason`: up to 200 characters, what the card shows. `calls`: 1 by default, up to 3. `by`: when the yes ends, an ISO time in the next 7 days, 12 hours from now by default.
- It shows a card above the message box, and waits for it, up to 10 minutes:

  > **Bob would like to call you** once, by 07:30 tomorrow: to wake you for your flight.
  > [Allow] [No]

- **Allow:** "The owner said yes: 1 call, by 07:30 tomorrow. Call with phone_call when it's time." **No**, or the owner writing in the chat instead: "The owner said no." Ten minutes with no answer: "The owner didn't answer."

**Without asking,** in a bot's own settings: **May call me without asking**, off by default. When it's on, the bot needs no card, but those calls stay under `perDay` and outside `quiet`. That's for a routine that watches something, such as "call me if the site goes down."

### The call

**`phone_call({ message })`**, `asks: true`, not `idempotent`, since a call run twice rings twice:
1. **Checked first, in one transaction:**
   - the owner's number is confirmed, and the service is set up
   - a yes covers it: the bot's oldest open one with calls left, or **May call me without asking** outside quiet hours
   - the bot is under `perDay` calls today, in the owner's time zone, whatever allowed them
   - no other call of this plugin is ringing

   The call takes one from its yes. With none: "You have no yes for a call. In your chat with the owner, ask with phone_ask, and call when it's time."
2. **What the phone says:** "Hi, it's Bob, from fxbot." Then the message, up to 500 characters, then "Again:" and the message once more, then "That's all. Goodbye." The bot's name comes from its profile, not from the message.
3. **Placed and followed** by the phone service (below), and the tool waits for how it went, up to 3 minutes. It answers in words: "Answered: the call lasted 34 seconds." "Not answered after 30 seconds of ringing." "It went to voicemail." "Busy." "The call failed: <the service's words>." It never calls again by itself: the bot decides, under `perDay`.

A quiet hour stops only calls made without asking. A yes the owner gave for 06:00 is for 06:00.

### The phone service

Twilio, through `fxbot/twilio.ts`, with `fetch` and Basic auth, the API key's SID and secret. Two calls of its API, and nothing that listens:
1. **Place it:** `POST https://api.twilio.com/2010-04-01/Accounts/{account}/Calls.json` with `To` (the owner's number), `From`, `Timeout` (`ring`, 30 seconds), `TimeLimit` (120), `MachineDetection=DetectMessageEnd` when `voicemail` is on, and `Twiml`, with every message XML-escaped:

   ```xml
   <Response>
     <Pause length="1"/>
     <Say voice="…">Hi, it's Bob, from fxbot. The deploy finished, and 3 tests failed.</Say>
     <Pause length="1"/>
     <Say voice="…">Again: The deploy finished, and 3 tests failed.</Say>
     <Say voice="…">That's all. Goodbye.</Say>
   </Response>
   ```

   A message of 500 characters makes about 1,300, well under Twilio's 4,000. An error answer, such as a number the account can't call, becomes the tool's answer in Twilio's own words, and the call row says `failed`.
2. **Follow it:** `GET .../Calls/{sid}.json` every 3 seconds until its `status` is final, then once more for `price`. What the bot hears:

   | Twilio's status | `answered_by` | The outcome |
   | --- | --- | --- |
   | `completed` | a person, or none | answered, with `duration` |
   | `completed` | a machine | voicemail |
   | `no-answer` | | missed |
   | `busy` | | busy |
   | `failed`, `canceled` | | failed |

**After a restart,** a call still `placing` or `ringing` in the table is read once more, and its row gets how it ended. Nothing is placed again.

The service is one small file, so another one, such as Telnyx's TeXML, is a second file when an owner asks for it.

### The page

- **The card** above the message box, with `app.chat`, as Permissions draws its own. `phone_ask`'s card in the chat, `app.toolView("ask")`, tells it to look at once, so it doesn't wait for a timer. While a card is open, it reads `/asks` every 3 seconds, and never when none is.
- **A call's card,** `app.toolView("call")`: the message, then ringing, then how it went and how long.
- **The settings tab,** with `app.settings`: the service's account and number, the owner's number with **Call me to confirm** and the code's box, quiet hours, the day's limit, and the last 20 calls with each one's bot, time, outcome, and length.
- **A bot's section,** with `app.botSettings`: **May call me without asking**, and the bot's open yeses, each with **Remove**.

### The skill

`skills/phone/SKILL.md`, short:
- Call only when the owner asked you to call them, or for what they said is worth a call. Ask with `phone_ask` in that same chat, with the reason in their words and a time that covers when you'll call: "call me when the build finishes" is a yes now, for a call later.
- "Wake me at 7" is a yes now and a routine at 7 whose task is to call.
- A message for the ear: who it's from is said already, so lead with what happened, in a sentence or two. No links, lists, or code.
- After a missed call, say so in the chat. Call again only if the owner said to.

### Data (`0001_phone.sql`)

```sql
create table yeses (
  id bigserial primary key,
  bot text not null,
  session text not null,
  key text unique,                        -- the turn and the input, for phone_ask run again
  reason text not null,
  calls int not null,
  left_calls int not null,
  until timestamptz not null,
  state text not null default 'asked',    -- asked, allowed, refused, unanswered, removed
  asked_at timestamptz not null default now(),
  answered_at timestamptz
);
create table calls (
  id bigserial primary key,
  bot text not null,
  session text not null,
  yes bigint references yeses (id),       -- null for a call made without asking, or the owner's own test
  message text not null,
  sid text,                               -- the phone service's id for it
  status text not null default 'placing', -- placing, ringing, answered, voicemail, missed, busy, failed
  seconds int,
  error text,
  at timestamptz not null default now(),
  ended_at timestamptz
);
create table bots (bot text primary key, without_asking boolean not null default false);
```

The confirmed number is kept with `fx.secrets`, as `confirmed`, and the number is confirmed while `to` matches it, so changing `to` unconfirms it with no code of its own. The code waiting to be typed is kept there too, for 10 minutes. Calls are kept 90 days. Removing the plugin drops the schema.

### Settings (`plugin.json`)

| Setting | What it is | Default |
| --- | --- | --- |
| `account` | The Twilio account's SID | |
| `key` | An API key's SID | |
| `secret` | That key's secret, sealed (`isSecret`) | |
| `from` | The Twilio number calls come from, such as +15551234567 | |
| `to` | The owner's phone, the only number called | |
| `voice` | A Twilio voice by name; empty is Twilio's basic voice, which costs nothing | empty |
| `voicemail` | Leave the message on voicemail when no one answers: `on` or `off`, $0.0075 a call | `on` |
| `ring` | Seconds a call rings, 10 to 60 | `30` |
| `quiet` | Hours no call without asking is made, in the owner's time zone | `22:00-07:00` |
| `perDay` | The most calls one bot makes in a day, 1 to 20 | `5` |

`FXBOT_PHONE_API`, read once at start, points the plugin at another address than Twilio's, for checks only, as the computer reads `FXBOT_COMPUTER_NAME`.

### Cost

- **Each request of each bot it's on for:** two tool definitions, about 300 tokens, cached with the rest, and the skill's line.
- **A call:** one request to place it, one every 3 seconds while it rings and speaks, about 20, and Twilio's bill: a call of a minute is about $0.022 with voicemail detection, plus about $0.04 for 1,300 characters on a Neural voice, or nothing on the basic one. The number is $1.15 a month.
- **Idle:** nothing. A yes ends by its time, read when a call asks, so there's no timer. The page reads `/asks` only while a card is open.

### Not in this phase

- **Talking back on the call,** and a key press: both need a way in or a realtime service ([open question 1](#5-open-questions)).
- **Calling anyone else,** texts, and calls to a bot: the [Phone calls](phone-calls.md) stub, and [Gateways](gateways.md) for texts.
- **Another phone service,** until an owner asks.
- **Recording.** Nothing is recorded: what was said is the message, which the chat already has.

### What changes

- `packages/sdk/src/plugin-api.ts`: `asks` on `PluginTool` and on `tool.before`, documented "Since 0.11.0". `packages/sdk/src/plugins.ts` passes it, as `safe`. It adds and breaks nothing, so no line in `plugin-breaks.json`.
- `plugins/permissions`: a call with `asks` runs as a safe one does, in its README's table too, and a new version.
- `plugins/phone/` (new, 0.1.0), and its entry in `packages/sdk/src/plugins-registry.json`.
- The docs: a how-to, **Let a bot call you**, with the Twilio account, the upgrade, the number, saving it as a contact, the API key, and confirming; `asks` in the plugin API reference; `CHANGELOG.md` under `## Unreleased`.

## 4. Checklist

The plugin's checks run against a fake Twilio, a small local server that answers the two calls and keeps each request, through `FXBOT_PHONE_API`, with a mock model and a disposable fxbot. No check rings a real phone except the last group's.

**The core word**
- [ ] `asks` on `PluginTool` and on `tool.before`, passed by `plugins.ts`, in the plugin API reference. `npm run typecheck` passes.
- [ ] Permissions on `ask`: a tool with `asks` runs with no card, a safe one as before, and any other shows its card.

**The plugin**
- [ ] `plugins/phone/` 0.1.0, with `minFxbot` `0.11.0`, its migration, settings, skill, and README. `page.js` is built from `page.jsx` and committed.
- [ ] Confirming: **Call me to confirm** places a call whose TwiML reads a 4-digit code twice; the right code confirms, a wrong one doesn't, and changing `to` unconfirms. Before it's confirmed, `phone_call` refuses.
- [ ] `phone_ask` in the owner's own turn shows the card above the box at once. **Allow** saves a yes with its calls and end, **No** refuses, writing in the chat refuses, and 10 minutes with no answer says so. In a routine's run it refuses without a card. Run again after a crash, it finds the same card.
- [ ] `phone_call` with no yes refuses, with the words to ask. With one, the request to the fake has `To` the owner's number, `From`, `Timeout`, `TimeLimit`, `MachineDetection`, and the TwiML, escaped: a message with `<`, `&`, and quotes speaks as written. The yes counts down, and a call past it refuses.
- [ ] `perDay` stops the sixth call, a second call while one rings refuses, and **May call me without asking** calls with no card outside quiet hours and refuses inside them. A yes for a time inside quiet hours calls.
- [ ] Each outcome from the fake, answered, voicemail, missed, busy, and failed, and an error answer on placing, comes back in words, and the call's card shows it.
- [ ] A restart while the fake rings: the call isn't placed again, and its row gets how it ended.
- [ ] "Wake me at 7," with the mock model: the owner asks, the bot asks with `phone_ask` and the owner allows, the bot adds a one-time routine, and at its time the run calls under that yes, with Permissions on `ask` and no card.
- [ ] The settings tab and a bot's section: the account, the number and its code, the last calls, **May call me without asking**, and a yes's **Remove**.

**The docs**
- [ ] The how-to, the plugin's README, the plugin API reference, `CHANGELOG.md`, and the README's Phases line. `npm run build-site` passes.

**Only a person can check**
- [ ] On a paid Twilio account, a real call to the owner's phone: it rings from the saved contact, says the bot's name and the message twice in the voice set, and the bot hears "answered."
- [ ] The same call left to ring out lands on voicemail with the whole message after the beep.
- [ ] The phone doesn't label it spam, and an iPhone with **Silence Unknown Callers** on rings for the saved contact.
- [ ] The call's price on Twilio's bill matches the settings tab.

## 5. Open questions

1. **Talking back on the call.** It's the next step, as a phase of its own once this one is in use. It needs a way for the call's audio to reach a model and back. Recommended order:
   - **First, OpenAI's GPT-Live** with client delegation: no way in, and the bot's own model thinks, but the owner needs an OpenAI key and a SIP trunk, the voice is OpenAI's, and the API is new enough that its docs disagreed. Check it again when that phase is planned.
   - **Otherwise, Twilio's ConversationRelay** through one Tailscale Funnel path, as OpenClaw does: Twilio does the speech both ways, and the bot's own turn answers as text, but it opens a public path to fxbot.
   - LiveKit and the hosted agents are heavier, or put another model in the bot's place.
2. **Twilio first, and only Twilio,** with Telnyx as a second file when an owner asks? Recommended: yes.
3. **May call me without asking,** in this phase, off by default, under `perDay` and quiet hours? Recommended: yes, for routines that watch something.
4. **Leave the message on voicemail by default,** for $0.0075 a call and a second or two before a person hears it? Recommended: yes.
5. **`asks` in core,** or no core change and a line in the how-to, "on `ask`, choose **Always allow** for `phone_call` the first time"? Recommended: `asks`. Without it, the first call made at a time the owner set, in `ask` mode, fails while they sleep.
6. **A yes's limits:** up to 3 calls, ending within 7 days? Recommended: as written.
