# Phone

`phone` is the phone call, apart from any phone service:
- **Everything a call is, in one plugin:** Call me, the bot's tools to call and hang up, who may call and when, the owner's confirmed number, the conversation in the bot's own chat, and the last calls.
- **A provider plugin carries the call,** such as [`phone-signalwire`](phone-signalwire.md). It holds the connection to its service, speaks the bot's words, and gives back what the owner said. It knows nothing of bots.
- **Each bot gets what the owner gives it:** Call me, calls when asked, and calls on its own, each on or off, with a provider and a voice of its own.

Status: planned on 2026-11-18 at the owner's word, and built the same day on `release/0.11.0`, checked against a fake RELAY, a mock model, a check-only second provider, and Chromium ([What the build changed](#what-the-build-changed)). In the owner's own fxbot both plugins run, SignalWire's settings stayed, and the owner's number waits to be typed in phone's settings and confirmed again.

## What the owner asked

- "I want you to split phone-signlawire into two plugins phone and phone-signalwire... Phone plugin is the root one, it requires a provider plugin to work fully. But the phone plugin handles all the hooks, core bits, and converation compaction/management etc, and everything. Then the provider plugins become dumb hooks to federate the voice/text out of the phone plugin to actual providers. So we can also release phone-twilio, phone-elevenlabs, etc... Not all phone setups require actual SIP/outboudn calling. some can be just in app call (data only). Configured in the provider, and phone you select your default provider etc. Phone core plugin is one that decides what bots get waht features, phone-provider plugins just offer new providers to the phone-core." (2026-11-18)
- Asked how much to build: "Split now, in-app next." Asked what a bot's Phone section decides: its provider, whether it may call on its own, its voice, and each call feature on its own.

## 0. Core or plugin

**Two plugins, and no change to fxbot's core or plugin API** ([Core or plugin](../../../CONVENTIONS.md#core-or-plugin)). A phone call isn't what every bot needs, so `phone` is a plugin, and each service is a plugin that needs it.

The plugin API has what this needs since 0.5.0:
- A provider names `phone` under `needs` and offers itself with `fx.provide`.
- `phone` finds its providers in `fx.dependents()`, at each use, and hears when one comes or goes with the `dependents` hook.

The computer plugin finds the plugins that name computers of their own the same way.

## 1. Research

- **[OpenClaw's voice call](https://docs.openclaw.ai/plugins/voice-call.md)** is one plugin with a `provider` setting: Twilio, Telnyx, Plivo, or a mock. The call flow, the tool, and the checks are shared, and each provider has its own block of credentials. Each of the three carriers needs "a public webhook URL", and setup refuses loopback and private addresses.
- **[Home Assistant's Assist](https://contributors.home-assistant.io/core/internals/assist-pipelines/)** splits a voice assistant into stages: wake word, speech to text, the conversation agent, and text to speech. Each stage is its own kind of integration, and "users set up pipelines under Settings > Voice assistants, picking a language and a provider for each step."
- **[Pipecat](https://docs.pipecat.ai/server/services/supported-services)** keeps transports, which "exchange audio and video streams between the user and bot", apart from services, such as speech to text and text to speech. Twilio and Telnyx are serializers on a transport.
- **fxbot today:** `phone-signalwire`'s `call.ts`, the conversation, names no service and holds the call through a `Line` (`place`, `say`, `stop`, `hangUp`, and events for what was heard, cut off, played, and how it ended). `relay.ts` is SignalWire's `Line`. What else knows SignalWire is the settings, what a restart needs to end a call (its id, node, and protocol), and ending one after a restart.

## 2. Key takeaways

- **The line is the boundary.** It's text both ways, and SignalWire does the speech. That's the contract a provider fills now.
- **Providers as plugins, not a setting,** as the owner asked. OpenClaw's one plugin carries every carrier's code. Here each is added only by an owner who wants it, and someone else can write one.
- **Kinds of provider, as Assist and Pipecat have them:** a line that rings a phone and speaks (SignalWire), a line that carries audio only (an in-app call, a Telnyx softphone), and speech to text and back (ElevenLabs, Deepgram, Cartesia). The last two meet in `phone`, in a later phase ([Phone in the app](../../phases/phone-in-app.md)).
- **Twilio needs a way in.** A live conversation over Twilio, by Media Streams or ConversationRelay, has Twilio connect to fxbot, which the owner ruled out: "I want no public endpoint of fxbot." OpenClaw needs a public webhook for Twilio, Telnyx's Call Control, and Plivo alike. So `phone-twilio` isn't planned.

## 3. Implementation

### The contract (`phone/fxbot/line.ts`)

A provider needs `phone` with `{ "line": 1 }` and provides (`{ "line": 2 }` since 0.1.2, below):

```ts
type Provider = {
  label: string;               // "SignalWire", in phone's lists
  missing(): string[];         // its settings still to fill in, by name
  voices(): Voice[];           // what a bot may pick, { value, label, group }; [] for none
  line(events: LineEvents): Line;
};
```

`Line`, `LineEvents`, `Place`, and `Outcome` are as they were in `relay.ts`, with two changes:
- `Place` carries the bot's `voice`, or none for the provider's own.
- What ends a call after a restart is the provider's, not in `Place`.

fxbot's own providers import these types from `phone`; Node erases a type-only import. Someone else's copies them from `phone`'s README. `{ "line": 1 }` names the contract, so a later one can be told apart. Line 2 came with phone 0.1.2: [The bot's own voice](#the-bots-own-voice-012-for-0120).

### `phone`

- **Moved from `phone-signalwire`:**
  - `call.ts`, the conversation, as it was
  - the tools, now `phone_call` and `phone_hang_up`
  - the rules: who asked, call-backs, on its own, quiet hours, a day's most
  - the owner's number and confirming it
  - the last calls
  - the page: Call me, the call's bar, the call's card, the tab, and a bot's section
  - the skill
- **Its settings:** `to`, `minutes`, `quiet`, and `perDay`.
- **The provider a call uses:**
  - **For a bot:** its own, if it runs, or else the default.
  - **The default:** the one the tab picked, if it runs, or else the only one, or the first by name.
  - **What's missing before a call:** phone's own number, then the provider's settings. With no provider, "a provider".
- **A bot's voice** goes to the call only if its provider still lists it, and otherwise the provider's own voice.
- **A bot's three features:**
  - **Call me**, on by default: the button, which hides when it's off.
  - **When asked**, on by default: calls the owner asks for, now or later.
  - **On its own**, off by default, as before.

  The tool refuses what's off, in words for the bot, since a tool can't be hidden from one bot.
- **After a restart,** a call left ringing or on is marked "fxbot restarted.", and its provider ends it.
- **Unloading `phone`** ends a call that's on: "fxbot reloaded the plugin."

**Data (`0001_phone.sql`):**
- `calls`, as before, with its `provider` in place of SignalWire's id, node, and protocol
- `callbacks`, as before
- `bots`: provider, voice, `button`, `asked`, and `own`
- `chosen`: the default provider

**Routes:**
- **`GET /status`** adds each provider's name, label, what it's missing, and whether it's the default.
- **`PUT /provider`** picks the default.
- **`GET` and `PUT /bots/:bot`** carry a bot's features, provider, and voice, and the voices its provider lists.
- **`GET /calls/live`** says whether Call me shows.

**The tab:**
- **Ways to call:** each provider, ready or what it's missing, with a link to its settings, and a default to pick with two or more. With none: "Add a provider plugin, such as phone-signalwire, from Plugins."
- Then confirming the number, and the last calls, as before.

**A bot's section:**
- the three switches
- the provider, with two or more
- the voice, from its provider's list, grouped, or the provider's own

### `phone-signalwire`

- **It needs `phone`.** Its settings are `project`, `token`, `from`, `voice`, and `language`.
- **`server.ts`:**
  - builds SignalWire's settings
  - says what's missing
  - lists the voices from its own `plugin.json`
  - provides `line`
- **Its own table, `kept`:** what ends a call after a restart. A row is saved when SignalWire names a call and deleted when the call ends. At start, each one left is ended from a new connection.
- **Unloading it** ends its calls: "fxbot reloaded phone-signalwire.", which phone's row keeps.
- **`relay.ts`:** as it was, with the types from `phone` and the bot's voice in place of the setting's.
- **`0001_phone.sql` is replaced by `0001_kept.sql`,** since the plugin hasn't shipped in a release. A checkout that ran the old one keeps its tables, unused.

### Not in this phase

- **Calls in the app,** with speech providers, such as `phone-elevenlabs`: [Phone in the app](../../phases/phone-in-app.md).
- **[Phone: Telnyx](../../phases/phone-telnyx.md),** a softphone, becomes a provider of `phone`.
- **A provider's own per-bot settings,** beyond the voice.

### Size

About 300 to 400 new lines: phone's provider choice, a bot's features and voice, the tab's list, and `phone-signalwire`'s new `server.ts`. About 1,200 lines move.

## 4. Checklist

On a disposable fxbot with this branch's `phone`, `phone-signalwire`, `subagents`, and a check-only plugin, against the fake RELAY and a mock model:

- [x] Both load, and `phone` can't be removed while `phone-signalwire` needs it: "phone-signalwire and phone-test need phone. Remove them first.", a 409. fxbot's own check refuses to load a plugin whose need isn't added.
- [x] With no provider running, Call me answers "Phone has no provider", which sends the page to the tab.
- [x] The confirming call, Call me, and a conversation work as before, through `phone-signalwire`, with the tools named `phone_call` and `phone_hang_up`.
- [x] With a second, check-only provider:
  - the default is picked in the tab
  - a bot's own provider carries its calls
  - a missing setting of the default's shows in the tab
- [x] A bot's voice reaches SignalWire's `calling.play`, and one its provider doesn't list falls back to the provider's own.
- [x] Call me off hides the button and refuses the route. When asked off refuses the owner's call now and later, and on its own works as before.
- [x] Reloading `phone` mid-call saves "fxbot reloaded the plugin."; reloading `phone-signalwire` mid-call saves "fxbot reloaded phone-signalwire."
- [x] A restart while ringing and while on: `phone-signalwire` ends the call from a new connection, and phone's row says "fxbot restarted."
- [x] The tab and a bot's section in Chromium, on a desktop in light and a phone in dark, with no page errors and nothing saved.
- [x] `npm run typecheck` and `npm run build-site` pass.

## 5. Open questions

1. **Twilio:** not planned, since a live call over it needs Twilio to reach fxbot. Recommended: leave it out while there's no public endpoint.
2. **The owner's number:** it belongs to `phone`, so moving it means typing it once more and confirming it again in dev, with one short call. Recommended: as is, since nothing has shipped.

## What the build changed

Built on 2026-11-18, on `release/0.11.0`, as planned. The checks ran on a disposable fxbot with this branch's `phone`, `phone-signalwire`, and `subagents`, the check-only waiter, and `phone-test`, a check-only provider whose line answers at once and keeps what it was asked. Every check from [Phone: SignalWire](phone-signalwire.md) ran again on the split, with the tools' new names.

- **`relay.ts` changed least:** its types come from `phone`. It takes what ends a call after a restart as a callback of its own, says null for it once the call is over, and speaks in the bot's voice when `place` carries one. It gained `drop(why)` for the provider's cleanup, and an unanswered call's result keeps that reason too.
- **A provider's line forgets a call that wasn't answered,** so unloading the provider ends only calls still up.
- **A plugin's page gets only the classes the app's own code uses.** A bot's switches first used a grid class the app doesn't have, and each name fell under its switch in Chromium. They use the flex the old section did.
- **Writing any file in a plugin's folder reloads it in a checkout,** a README too. One run of the checks lost a call that way: its row said "fxbot reloaded the plugin." The checks run with the folders left alone.
- **In the owner's dev,** `phone` was added before `phone-signalwire` in `FXBOT_PLUGIN_DIRS`, and the API restarted. `phone-signalwire` kept its id and settings, so SignalWire's project, token, number, and voice stayed. Its old tables stay in its schema, unused.
- **A call's message ids carry when it began (0.11.0, from its prep).** They were the call's row id and a count, `phone-1-1`. libfx skips an id a chat already holds, and phone's calls started over at 1 after the split, so in dev what the owner said on a call could be skipped. They're `phone-<row>-<start>-<count>` now.
- **The bot checks how things stand (0.1.1, for 0.11.1),** from the owner's test call on 2026-11-24: "I can't see the tool calls the agent did during the call." The call had none. Asked for a status, the bot answered from a herdr watch's turn a day and a half old, and asked what it had run, described that turn's two reads as if it had just made them. The call's first message now says its tools work as in the chat, and to check how something stands now with them first, since what's earlier in the chat may be old. A prompt's effect shows only on a real call: not checked.

### The bot's own voice (0.1.2, for 0.12.0)

The owner, on 2026-11-24, after a call to their Apple Watch on speaker: "the phone heard itself talking and interrupted itself." The call lasted 9 seconds. Its first message to Bob was "hey this is": the greeting, "Hey, this is your fxbot Bob. How can I help today?", coming back down the line. Bob answered it ("It cut off, so say it again?"), and that answer, with "One moment.", talked over the owner, whose "take a look at" reached Bob cut short. The log showed a line stopped 158 ms after it was asked to, and Bob's last answer went to a call already over.

- **Why the old check missed it:** phone-signalwire's line compared words heard only with the line playing at that moment, and not with one that had been cut. The recognizer gives words a second or more after their sound, since a second of silence ends them, so an echo arrives after its line has ended, or while the next line plays, and it counted as the owner's. A watch's speaker and microphone sit close together, so its echo canceller lets more through than a phone held to the ear, and more in a call's first seconds.
- **How others do it:**
  - SignalWire's own AI agent doesn't answer what it hears while it talks, for up to 3 seconds (`transparent_barge`), and can make the greeting impossible to cut (`static_greeting_no_barge`). Its [parameters](https://signalwire.com/docs/swml/reference/ai/params.md) have nothing for echo, and RELAY has no echo canceller.
  - Pipecat [mutes the owner](https://docs.pipecat.ai/server/utilities/user-mute-strategies) until the bot's first speech is done, then asks for some words before cutting in.
  - LiveKit [asks for some words](https://docs.livekit.io/agents/logic/turns/tuning/), and resumes when a cut turns out to be nothing.
  - OpenClaw had the same bug ([#159140](https://github.com/openclaw/openclaw/issues/159140)): it drops what's heard while the bot plays and about 400 ms after.
- **The rules moved to phone,** since they're the same for any provider, and [Phone: Telnyx](../../phases/phone-telnyx.md) and [Phone in the app](../../phases/phone-in-app.md) need them too. The contract is line 2:
  - A provider needs phone with `{ "line": 2 }`. Its line gives the words as they come, `hearing(text)`, as well as `heard(text)` once they're finished, and never cuts the bot off itself: phone calls `stop()`.
  - phone still takes a line 1 provider, which cuts the bot off itself and says `interrupted()`. phone drops the echo in its finished words too, so phone 0.1.2 helps with phone-signalwire 0.1.1. But an old provider still cuts the greeting and the next line, so update both.
- **What `call.ts` does now:**
  - It keeps what the bot said that's playing or waiting, and what stopped playing in the last minute, with when. Words heard are the bot's own when most of them are in what was playing as they began, or had stopped up to 1.5 seconds before, the echo's way back from the phone.
  - When the words began is their first `hearing`. With only `heard`, it's about a second of silence and half a second a word before it.
  - Such words neither cut in nor reach the bot. The log says each one it drops, and how long after its line, to tune the 1.5 seconds on real calls.
  - On a line 2, two words of the owner's while the bot speaks cut it off, as before, except during the greeting, which plays to the end. "Stop" and "hold on" still stop it. Words said over the greeting that aren't its echo still reach the bot.
- **The trade-off:** the owner's own words, when most of them are the bot's last line and they start within 1.5 seconds of its end, such as "hey Bob" right after the greeting, are taken as its echo. Said later, they go.
- **Checked** against the fake RELAY, with phone and phone-signalwire 0.1.2, and lines slowed to 40 ms a character:
  - The greeting's echo, and three words of the owner's over it, don't cut it.
  - The greeting's echo as a final, 0.5 seconds after it ended, doesn't reach the bot, and the log says so. Words said over the greeting do.
  - A line's echo that began during it and finished while the next line played doesn't cut that line or reach the bot.
  - Two words of the owner's still cut in on a later line, and words said after a line reach the bot, as does the bot's own last word said 3.5 seconds after its line.
  - The confirm, talk, repeat, deaf, and rules checks pass. The repeat check now waits 3 seconds before saying the bot's last line back, since the mock bot repeats what it's told.
  - **With phone-signalwire 0.1.1,** a line 1: the confirm and talk checks pass, and no echo reached the bot. The old provider still cut the greeting and the next line, as expected. The repeat check's second "Same again." was taken as echo, since with no `hearing` the start of a final is estimated, and the fake gives a final the moment it's asked.
  - **Not checked:** a real call. The log's new lines say how late an echo comes. No call so far logged `start_of_input` during a line, and whether SignalWire sends partial results on a real call isn't known: without them, the line works as with an old provider's finals.
- **If it isn't enough:** a partial could need three words to cut in, as Vapi suggests for noisy calls, and then a setting could make the call take turns. Separately, a pause of a second mid-sentence ended what the owner said, and "One moment." could play while they went on: the call's "take a look at" was likely that. See [Time to think](#time-to-think-012-for-0120).
- **For checks under dev:** fxbot reloads a local plugin's entry file when its files change, but its other files, such as `call.ts` and `relay.ts`, stay as first imported until fxbot restarts. A plugin added from GitHub gets a folder for each commit, so an update isn't affected.

### Time to think (0.1.2, for 0.12.0)

The owner, the same day: "it needs a bit of pause after I speak cause I may stutter, stumble, or brain pause before finishing my statement if I'm talking and thinking at the same time." SignalWire ends what it heard after a second of quiet, so a pause to think sent half a sentence, "take a look at", and the bot answered it.

- **What the owner says is held** until they've been quiet for `pause`, a new setting of 1 to 5 seconds, 2 by default. Words after a shorter pause join it, and go as one message. The pause is phone's, so it's the same with any provider, and the provider keeps its own short wait.
  - Quiet is counted from the owner's last `hearing`, near the end of their speech. With only `heard`, it's counted from about a second before it, the recognizer's own wait.
  - Words begun, a `hearing` with no `heard` yet, hold it up to 2 seconds more.
- **What acts at once:** "wait" and "hold on" stop the bot talking, and what's held still goes after the pause. "Stop" stops the call's work and drops what's held. The owner cutting in still stops the bot at once.
- **"One moment."** waits 1.5 seconds after the words go, as before, and doesn't play if the owner has talked since.
- **Words held when the call ends** still go to the bot, once.
- **The cost:** every answer starts the pause later than before, about a second more with 2 seconds.
- **Checked** against the fake RELAY:
  - Two parts a second apart went as one message, 2.1 seconds after the last. A final alone went about a second after it.
  - "Hold on" stopped the bot at once, and what was held went after it. "Stop" dropped what was held.
  - No "One moment." while the owner talked again, and words held at a hang-up reached the bot once.
  - The confirm, talk, echo, repeat, deaf, and rules checks pass. The talk check's "One moment." now comes at 3.5 seconds, and its steps that speak again wait for the pause first.
  - **Not checked:** a real call, and whether 2 seconds suits the owner. A "stop" said just as held words go may find the bot's turn not started yet, and say "Okay." without stopping it, as before.
