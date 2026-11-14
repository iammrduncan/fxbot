# phone-signalwire

A plugin for [fxbot](https://fxbot.sh): press **Call me** and a bot rings your phone through [SignalWire](https://signalwire.com), greets you, and you talk with it, hands-free. What you say goes to the bot's own chat, and its own model, memory, and tools answer, read out as it writes them.

- **Call me** is in the message box. The bar above it shows the call ringing, then how long it's been on, with **End call**.
- `phone-signalwire_call` rings you when you ask the bot to, now, or later with `later: true`: "call me when the build is done." The call opens with why it rang.
- `phone-signalwire_hang_up` ends the call after the bot's goodbye.
- The `phone` skill tells bots how to talk on a call: short, plain, and nothing they can't say aloud.

Only your phone: you set your number once and confirm it, and no tool takes a number. A bot calls on its own only when you turn on **May call me on its own** in its settings, a few times a day at most, and never in your quiet hours. One call at a time.

**Nothing reaches fxbot.** For each call, fxbot opens one WebSocket to SignalWire's RELAY, and SignalWire places the call, hears you, and speaks the bot's words. SignalWire never connects to fxbot, and nothing is open between calls.

Add it from **Plugins**. It needs fxbot 0.9.0 or newer. It runs inside fxbot: read its code there before you add it. See [Talk with a bot on the phone](https://fxbot.sh/docs/how-to/talk-with-a-bot-on-the-phone/).

## On a call

- **What you say** goes to the bot's chat as a message, labeled **your call**, joining whatever it's working on. The first one tells the bot it's on a call. Every reply in that chat is read out while the call lasts, including one to a subagent's report. Markdown's marks go, a link is "a link in the chat," and a code block or table is "There's more in the chat."
- **While it thinks,** you hear "One moment." once, and "Still working on it." every 20 seconds while a tool runs.
- **Talking over it** stops it, and the bot learns where you cut in. Its work goes on.
- **"Stop"** stops the work the call started, and isn't sent to the bot. "Wait" and "hold on" only stop it talking.
- **The call ends** when you hang up, when the bot hangs up, after a minute with nothing said, or at `minutes`.
- **Anything that needs your OK** waits on your screen, as Permissions shows it.

## Settings

| Setting | What it is | Default |
| --- | --- | --- |
| `project` | Your SignalWire project id, from API Credentials | |
| `token` | An API token of the project with the Voice scope, sealed | |
| `from` | Your SignalWire number calls come from | |
| `to` | Your phone, the only number bots call | |
| `voice` | A SignalWire voice, picked from a list by engine with what 10 minutes cost, or typed as `engine.voice:model` | `amazon.Joanna:neural:en-US` |
| `language` | Which English you speak on calls, picked from a list | `en-US` |
| `minutes` | The longest call, 5 to 120 | `30` |
| `quiet` | Hours a bot doesn't call on its own, in your time zone | `22:00-07:00` |
| `perDay` | The most calls one bot makes on its own in a day, 1 to 20 | `3` |

A value outside its range means its default, with a line in the plugin's log. The plugin's tab confirms your number and lists the last 20 calls.

## Cost

SignalWire bills a call, listening throughout so you can cut in, at about $0.08 a minute with the default voice, and up to $0.14 with the dearest: $0.008 a minute to call out, $0.06 a minute to listen, and the voice by the character. A bot's call adds $0.006 to listen for voicemail. A number is $0.50 a month. Each thing you say is also a turn on the bot's own model.

## Tables

In the plugin's own schema, from `fxbot/migrations/`:
- `calls`: each call, who it was for, why, how it went, and what a restart needs to end it. Kept 90 days.
- `callbacks`: the one call each bot may make later, which you asked for. Each lasts 12 hours.
- `bots`: whether a bot may call on its own.

The confirmed number and a code waiting to be typed are kept sealed. What was said is in the bot's chat, and nothing is recorded. Removing the plugin drops the schema.

## Files

| File | What it is |
| --- | --- |
| `plugin.json` | Its name, version, parts, and settings |
| `fxbot/server.ts` | The tools, the routes, the call records, call-backs, and confirming your number |
| `fxbot/call.ts` | A call's conversation: your words into the chat, the replies out, fillers, stop words, and limits. It names no phone service. |
| `fxbot/relay.ts` | SignalWire's RELAY: the JSON-RPC client, and the line a call runs on |
| `fxbot/page.jsx` | Call me, the call's bar, a call's card, the plugin's tab, and a bot's section |
| `fxbot/page.js` | `page.jsx`, built |
| `fxbot/migrations/` | Its three tables |
| `skills/phone/SKILL.md` | How bots call, and talk on a call |

## Building it

`fxbot/page.js` is `fxbot/page.jsx` bundled with [rolldown](https://rolldown.rs), which comes with fxbot's packages. Run this in this folder, in a checkout of fxbot, after changing `page.jsx`:

```sh
npx rolldown fxbot/page.jsx --format cjs -e react -e react/jsx-runtime -e @fxbot/app --file fxbot/page.js
```

`FXBOT_PHONE_RELAY`, read once at start, points the plugin at another RELAY address than SignalWire's, `wss://relay.signalwire.com`, such as a fake one for checks.
