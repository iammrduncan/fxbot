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

A provider needs `phone` with `{ "line": 1 }` and provides:

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

fxbot's own providers import these types from `phone`; Node erases a type-only import. Someone else's copies them from `phone`'s README. `{ "line": 1 }` names the contract, so a later one can be told apart.

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
