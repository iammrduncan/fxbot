# phone

A plugin for [fxbot](https://fxbot.sh): talk with a bot by voice. **In-app call** starts a call in the app, and **Call me** rings your phone, greets you, and you talk with it, hands-free. Its own model, memory, and tools answer, read out as it writes them. A call is a side conversation, with a chat of its own, and when it ends the bot's summary is a pill in the middle of its chat, **Phone call · 4 min**, which the bot reads from then on.

- **The phone** at the top of a bot's chat offers both. **Call me** shows while a phone-line plugin, such as phone-signalwire, is added and on. A [chat room](../chat-rooms/) has the phone too, with **In-app call** for all its bots. See In-app calls, below.
- **The bar** above the message box shows a call ringing, then how long it's been on, with **End call**.
- `phone_call` rings you when you ask the bot to, now, or later with `later: true`: "call me when the build is done." The call opens with why it rang.
- `phone_hang_up` ends the call after the bot's goodbye.
- The `phone` skill tells bots how to talk on a call: short, plain, and nothing they can't say aloud.

**A provider plugin carries the call,** such as [phone-signalwire](../phone-signalwire/). phone holds everything else: the tools, who may call and when, your number, the conversation, and the last calls. Add phone first, then a provider. With two or more, the plugin's tab picks the one calls go through, and a bot can have its own.

Only your phone: you set your number once and confirm it, and no tool takes a number. One call at a time.

Add it from **Plugins**. It needs fxbot 0.12.0 or newer. It runs inside fxbot: read its code there before you add it. See [Talk with a bot on the phone](https://fxbot.sh/docs/how-to/talk-with-a-bot-on-the-phone/).

## A call's own chat

A call runs in a session of its own for the bot (`fx.chats.newSession`), kept on its row, not in the bot's chat. While it's on, the bot's instructions there say how to talk on a call, and hold a recap of its chat: the last turns and pills, about 6,000 characters. Neither is ever a message. It can do anything there it can in its chat, and what lands in its chat during the call isn't read out.

When a call the owner spoke on ends, phone asks the bot in the call's session what its chat should keep of it, up to 6,000 characters, and pins the answer in the middle of the chat with `fx.chats.pill`: **Phone call · 4 min**, in context, so the chat's next turn carries it to the model, and later calls' recaps hold it. The pill opens the call's chat, `/phone/calls/<id>`, on the right: the summary, then the call. **Last calls** open it too, and the bar's button while it's on. The bot finds its calls with `chat_history`.

A subagent started on a call reports into the call while it's on, and to the bot's chat after: phone provides `callOf` and `wake` to subagents.

## In-app calls

phone carries the call's audio itself, over the page's own socket: the microphone, echo-cancelled by the browser, as 16 kHz PCM, and the bot's voice, played as it comes and dropped at once when you cut in. The call is the same conversation as on a phone line, below, and opens with "Hey, what's up?"

- **Cutting in:** with a listener that hears as you speak, two words over the bot stop it mid-sentence. With one that hears one stretch at a time, a voice detector in phone cuts the stretch, and most of a second of your voice over the bot stops it.
- **A sidekick:** the call's note tells the bot to say what it's doing first, in its own words, and hand anything that takes more than a moment to a subagent or a herdr agent, then come straight back to you. Nothing is refused on a call. A call's turns think at `callThinking`; its subagents keep the bot's own level. A subagent's report waits for your pause, and is never said over you.
- **In a room:** the phone at the top of a room, with chat rooms 0.6.0, calls its bots, in a call room chat rooms makes for the call, left out of the list. The bots start it with what the room said before, and the room call's note in their instructions while it's on. Your words go to the call room as from **your call**, with a bot named at their start or end tagged, and the call room decides who answers, as in text. When it ends, the lead writes the summary there, and the room gets the pill, opening the call room. Each bot speaks in its own voice, one at a time, and its tags are said as names. Cutting in drops every reply waiting, and the next message says who you cut off.
- **The bar** shows the call, who's speaking, the subagents working, a button that opens the call's chat, Mute, and End. The call ends when the app goes to the background.

## Voice

phone's tab has **Voice**: what listens, what speaks, and the voice, with a model for each, and **Hear it**, a line in that voice from `GET /voice/sample`. Each is a provider the owner added, or **This device**, the browser's own speech.

phone brings three entries to **Add provider**, under **For phone**: ElevenLabs and Deepgram, with a key, and **Speech server**, an address on your machine. A provider added for a bot's model serves too, when phone has an adapter for its kind:

| Adapter | Listens | Speaks |
| --- | --- | --- |
| `speech/elevenlabs.ts` | Scribe realtime, as you speak | Flash v2, Multilingual v2, or Flash v2.5, multi-context, in any of your voices; v4 Turbo, v3 Conversational, v4, and v3 over the Text to Dialogue WebSocket |
| `speech/deepgram.ts` | Flux, which ends your turns, from Deepgram or Cloudflare | Aura, Deepgram's only |
| `speech/mistral.ts` | Voxtral realtime, as you speak | |
| `speech/openai.ts` | OpenAI's `/audio/transcriptions`, one stretch at a time: OpenAI, Azure, Groq, Together, DeepInfra, OpenRouter, LiteLLM, vLLM, a custom server, and the speech server | OpenAI's `/audio/speech`, a sentence at a time: the same, but vLLM |

Requests go through `fx.providers`, so keys stay with fxbot. With nothing picked, phone listens and speaks with the first it finds in the adapters' order, or This device. A bot's own voice, in its **Phone** section, comes from the speaker picked here.

## On a call

- **What you say** goes to the call's chat once you've been quiet for `pause`, 2 seconds by default, so you can think or stumble mid-sentence: words after a shorter pause join it. "Wait", "hold on", and "stop" act at once. It goes as a message, labeled **your call**, joining whatever it's working on. Every reply in the call's chat is read out while the call lasts, including one to a subagent's report. Markdown's marks go, a link is "a link in the chat," and a code block or table is "There's more in the chat."
- **While it thinks,** the bot's own words come first. If nothing was said 3 seconds after your words went, you hear "One moment." once, and "Still working on it." every 20 seconds while a tool runs.
- **Talking over it** stops it, after the greeting, which plays to the end, and the bot learns where you cut in. Its work goes on. Its own voice coming back, as from a speakerphone or a watch, isn't taken as yours: words that are mostly what it was saying as they began, or had said up to 1.5 seconds before, aren't sent, and the log says so. A word heard one letter off, or with two letters swapped, as "quite" for "quiet", counts as what it said. The log names each cut: what cut the bot off, and what it was saying.
- **"Stop"** stops the work the call started, and isn't sent to the bot. "Wait" and "hold on" only stop it talking.
- **The call ends** when you hang up, when the bot hangs up, after a minute with nothing said, or at `minutes`.
- **Anything that needs your OK** waits on your screen, as Permissions shows it.

## What each bot gets

A bot's settings have a **Phone** section:
- **Call me:** in the phone at the top of its chat. On by default.
- **Calls when you ask:** calls you ask for, now or later. On by default.
- **Calls on its own:** calls the bot decides to make, a few times a day at most, and never in your quiet hours. Off by default.
- **Calls go through:** with two or more providers, the bot's own, or the default.
- **Voice:** one of its provider's voices, or the one in the provider's settings.

## Settings

| Setting | What it is | Default |
| --- | --- | --- |
| `to` | Your phone, the only number bots call | |
| `minutes` | The longest call, 5 to 120 | `30` |
| `quiet` | Hours a bot doesn't call on its own, in your time zone | `22:00-07:00` |
| `perDay` | The most calls one bot makes on its own in a day, 1 to 20 | `3` |
| `pause` | How long you can go quiet on a call before the bot answers, 1 to 5 seconds. A listener that ends your turns itself, such as Flux, holds nothing more. | `2` |
| `callThinking` | How hard a bot thinks on a call: `low`, `medium`, `high`, or `same`, the bot's own. Its subagents keep their own. | `low` |
| `googleListening` | Whether Chrome may send what you say to Google, when This device listens and Chrome has no language on the device | `off` |

A value outside its range means its default, with a line in the plugin's log. The plugin's tab lists the providers and what each still needs, confirms your number with a call through the default, and lists the last 20 calls.

## Tables

In the plugin's own schema, from `fxbot/migrations/`:
- `calls`: each call, who it was for, or which room, why, the provider that carried it, or the app, how it went, its own session or call room, and the bot's summary of it. Kept 90 days.
- `voice`: what listens and speaks on a call in the app, with their models and the voice.
- `callbacks`: the one call each bot may make later, which you asked for. Each lasts 12 hours.
- `bots`: what each bot gets, and its provider and voice.
- `chosen`: the provider calls go through unless a bot has its own.

The confirmed number and a code waiting to be typed are kept sealed. What was said is in the call's chat, and nothing is recorded. Removing the plugin drops the schema.

## Writing a provider

A provider is a plugin that needs phone with `{ "line": 2 }`:

```json
"needs": { "phone": { "line": 2 } }
```

phone still takes `{ "line": 1 }`, the contract before phone 0.1.2, where the provider decides what cuts the bot off, stops it, and says `interrupted()`.

It offers phone one object with `fx.provide`, and phone finds it with `fx.dependents()`. `fxbot/line.ts` has the types:

```ts
type Provider = {
  label: string;                  // its name in phone's lists
  missing(): string[];            // its own settings still to fill in, by name
  voices(): { value: string; label: string; group?: string }[];  // what a bot may pick, or none
  line(events: LineEvents): Line; // a line for one call
};
```

- **`line(events)`** gives a `Line` for one call: `place(call)` rings `call.to` and resolves once the owner answers, or doesn't. `say(text)` speaks after whatever is playing or waiting, and `stop()` cuts it off. `hangUp(now)` ends the call, and `speaking` says whether something plays or waits.
- **`events`** are what the provider says back: `hearing(text)` with the words of what the owner is saying so far, as they come, `heard(text)` when they finished something they said, `played(text)` for words played to the end, and `ended(how)` once the call is over: `"hung up"`, or what ended it, which the call's row keeps. phone decides from what it hears what's the bot's own voice coming back and what cuts the bot off, and calls `stop()`: a provider never cuts it off itself.
- **`place` carries** the greeting to play on answer, a line for voicemail on a call the bot makes, words to expect such as the bot's name, `quiet` for a call that only speaks, and the bot's `voice`, one of `voices()`, or none for the provider's own.
- **The provider ends its own calls** when it unloads, and after a restart, any its last process left up.

The text goes both ways: the provider does the speech. phone-signalwire's `fxbot/server.ts` is a short example.

## Files

| File | What it is |
| --- | --- |
| `plugin.json` | Its name, version, parts, and settings |
| `fxbot/server.ts` | The tools, the routes, the providers, what each bot gets, call records, call-backs, and confirming your number |
| `fxbot/call.ts` | A call's conversation: your words into the call's session, the replies out, the call's note, fillers, stop words, echoes, and limits. It names no phone service. |
| `fxbot/line.ts` | What a provider offers |
| `fxbot/voice.ts` | The voice loop of a call in the app: listening, the voice detector, cutting in, and speaking each sentence in order, one voice at a time |
| `fxbot/talk.ts` | The page's socket: the microphone in, the voice out, and the marks that say what played |
| `fxbot/room.ts` | A call in a room: names as tags, tags said as names, and each bot's voice |
| `fxbot/audio.ts`, `fxbot/speech.ts`, `fxbot/speech/` | The adapters, and what they share |
| `fxbot/page.jsx`, `fxbot/talk.jsx` | The phone at the top of a chat, the calls' bars, a call's card, a call's chat on the right, the plugin's tab with Voice, and a bot's section |
| `fxbot/page.js` | `page.jsx`, built |
| `fxbot/migrations/` | Its five tables |
| `skills/phone/SKILL.md` | How bots call, and talk on a call |

## Building it

`fxbot/page.js` is `fxbot/page.jsx` bundled with [rolldown](https://rolldown.rs), which comes with fxbot's packages. Run this in this folder, in a checkout of fxbot, after changing `page.jsx`:

```sh
npx rolldown fxbot/page.jsx --format cjs -e react -e react/jsx-runtime -e @fxbot/app --file fxbot/page.js
```
