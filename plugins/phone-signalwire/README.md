# phone-signalwire

A carrier for fxbot's [phone](../phone/) plugin: **Call me** rings your phone through [SignalWire](https://signalwire.com), for the same call as in the app, with its audio over your phone line. It gives phone a SIP account on your SignalWire space, and nothing more. phone holds the call: the voice and listening, the conversation and its rules, the bot's tools, who may call and when, and your number.

**Nothing reaches fxbot.** phone signs in to the account as a softphone, over TLS on port 5061, and calls your number from it, with the audio encrypted (SRTP). Every connection goes out, and SignalWire never connects to fxbot.

Add **phone** first, then this, from **Plugins**. It needs phone 0.2.0, which needs fxbot 0.12.0 or newer. It runs inside fxbot: read its code there before you add it. See [Talk with a bot on the phone](https://fxbot.sh/docs/how-to/talk-with-a-bot-on-the-phone/).

## Settings

| Setting | What it is |
| --- | --- |
| `space` | Your SignalWire space's name, as in `<space>.signalwire.com` |
| `project` | Your SignalWire project id, from API Credentials |
| `token` | An API token of the project with the Voice scope, sealed |
| `from` | Your SignalWire number calls come from |

phone's tab says what this still needs.

## The SIP account

With its settings in, it makes a SIP endpoint on your space through SignalWire's API, the first time a call needs one: a user named `fxbot-` and 8 characters, a random password it keeps sealed, calling as `from`, with encryption required, PCMU, and calls passed straight to the phone network. phone signs in at your space's SIP domain, from its SIP profile, such as `<space>-<12 characters>.sip.signalwire.com`. It makes a new endpoint, and deletes the old one, when the space, the project, or the number changes. It shows in SignalWire's dashboard under **SIP**, and stays there if you remove the plugin: delete it there.

## Cost

SignalWire bills the minutes of each call to your phone, and a number is $0.50 a month in the US: see its pricing for yours. What hears you and the bot's voice are billed by the providers in phone's **Voice**, as on a call in the app. Each thing you say is also a turn on the bot's own model.

## Files

| File | What it is |
| --- | --- |
| `plugin.json` | Its name, version, its need of phone, and settings |
| `fxbot/server.ts` | What it offers phone: what's missing, and the SIP account |
| `fxbot/migrations/` | `0001_kept.sql`, a table 0.1 kept for RELAY calls, and `0002_no_relay.sql`, which drops it |

Before 0.2.0, the plugin placed calls through SignalWire's RELAY, which spoke and listened itself, with SignalWire's voices.
