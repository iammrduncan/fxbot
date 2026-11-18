# phone-signalwire

A provider for fxbot's [phone](../phone/) plugin: a bot rings your phone through [SignalWire](https://signalwire.com), and SignalWire hears you and speaks the bot's words. phone holds the rest: **Call me**, the bot's tools, who may call and when, your number, and the conversation.

**Nothing reaches fxbot.** For each call, fxbot opens one WebSocket to SignalWire's RELAY, and SignalWire places the call, hears you, and speaks the bot's words. SignalWire never connects to fxbot, and nothing is open between calls.

Add **phone** first, then this, from **Plugins**. It needs fxbot 0.9.0 or newer. It runs inside fxbot: read its code there before you add it. See [Talk with a bot on the phone](https://fxbot.sh/docs/how-to/talk-with-a-bot-on-the-phone/).

## Settings

| Setting | What it is | Default |
| --- | --- | --- |
| `project` | Your SignalWire project id, from API Credentials | |
| `token` | An API token of the project with the Voice scope, sealed | |
| `from` | Your SignalWire number calls come from | |
| `voice` | A SignalWire voice, picked from a list by engine with what 10 minutes cost, or typed as `engine.voice:model` | `amazon.Joanna:neural:en-US` |
| `language` | Which English you speak on calls, picked from a list | `en-US` |

A bot can have a voice of its own from the same list, in its **Phone** section. phone's tab says what this still needs.

## Cost

SignalWire bills a call, listening throughout so you can cut in, at about $0.08 a minute with the default voice, and up to $0.14 with the dearest: $0.008 a minute to call out, $0.06 a minute to listen, and the voice by the character. A bot's call adds $0.006 to listen for voicemail. A number is $0.50 a month. Each thing you say is also a turn on the bot's own model.

## Tables

In the plugin's own schema, from `fxbot/migrations/`, `kept`: what ends a call SignalWire may still hold up after a restart, its id, node, and connection's protocol. A row lasts as long as its call. Removing the plugin drops the schema.

## Files

| File | What it is |
| --- | --- |
| `plugin.json` | Its name, version, its need of phone, and settings |
| `fxbot/server.ts` | What it offers phone: what's missing, the voices, and a line for each call, and ending calls a restart left up |
| `fxbot/relay.ts` | SignalWire's RELAY: the JSON-RPC client, and the line a call runs on |
| `fxbot/migrations/` | Its one table |

`FXBOT_PHONE_RELAY`, read once at start, points the plugin at another RELAY address than SignalWire's, `wss://relay.signalwire.com`, such as a fake one for checks.
