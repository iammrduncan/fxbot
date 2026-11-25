---
title: "Talk with a bot on the phone"
description: "Press Call me and a bot rings your phone, greets you, and you talk with it, hands-free: its own model, memory, and tools answer. SignalWire carries the call."
---

With the phone plugin, **Call me** in a bot's message box rings your phone. Answer and the bot says "Hey, this is your fxbot Bob. How can I help today?" Then you talk, as you'd chat by text: what you say goes to the bot's own chat, and its own model, memory, and tools answer, read out to you. The chat keeps the whole conversation.

A provider plugin carries the call. The one today is **phone-signalwire**: fxbot opens a connection to SignalWire for each call, and SignalWire places the call, hears you, and speaks the bot's words. SignalWire never connects to fxbot.

1. Set up SignalWire, below.
2. Add **phone**, then **phone-signalwire**, from **Plugins**, on **Browse**. They aren't in **Essentials**. They need fxbot 0.9.0 or newer.
3. Fill in phone-signalwire's settings, then phone's, and confirm your number in phone's tab.
4. Press **Call me** in a bot's message box.

## Set up SignalWire

1. Sign up at [signalwire.com](https://signalwire.com).
2. In your space's **API Credentials**, copy the **Project ID**, all 36 characters, and make an **API token** with the **Voice** scope.
3. Buy a phone number, $0.50 a month in the US. Calls come from it.
4. A trial account calls only numbers you've verified. Verify your own phone there, and you can try it before paying. Adding $5 ends the trial.

## Fill in the settings

In **Settings** › **phone-signalwire**:

| Setting | What to put |
| --- | --- |
| `project` | The Project ID |
| `token` | The API token, which fxbot keeps sealed |
| `from` | The number you bought, such as `+15551234567` |

In **Settings** › **phone**:

| Setting | What to put |
| --- | --- |
| `to` | Your phone, such as `+15557654321` |

phone's tab lists **Ways to call**, with SignalWire ready once its settings are in. Then press **Call me to confirm** there. Your phone rings and reads a 4-digit code, twice. Type it in the tab. Until then, no call goes out, so a typo can't ring someone else. Changing `to` asks you to confirm again.

Save the number you bought as a contact on your phone, such as "Bob (fxbot)". Then it rings when **Silence Unknown Callers** is on, it's less likely to be marked as spam, and your car says who's calling.

## On a call

- **Talk as you would to a person.** Keep going after the bot's greeting. It answers in a sentence or two, with nothing it can't say aloud: a link is "a link in the chat," and a code block is "There's more in the chat."
- **Its tools work as in the chat,** and each one it runs shows in the chat, under what you said. It's told to check how something stands now with them, rather than answer from what's earlier in the chat.
- **While it thinks,** you hear "One moment.", and "Still working on it." while a tool runs. Long work goes to a subagent, if the bot has the subagents plugin, and its report is read out when it's back, if you're still on.
- **Talk over it** to cut it off, after its greeting, which plays to the end. Its work goes on, and it knows where you stopped listening. Its own voice coming back, as from a speakerphone or a watch, isn't taken as yours.
- **Say "stop"** to stop the work the call started. "Wait" or "hold on" only stops it talking.
- **Anything that needs your OK** waits on your screen. Answer it when you can look.
- **Say goodbye** and the bot hangs up, or hang up yourself. A call ends too after a minute with nothing said, and at `minutes`, 30 by default.

The bar above the message box shows the call, ringing and then on, with **End call**.

## Let a bot call you

Ask it: "Call me." Or "Call me when the build is done": the bot keeps one call-back, for 12 hours, and rings you when it's done, with why it called.

Each bot's settings have a **Phone** section with what it gets:
- **Call me**, the button in its message box, on by default.
- **Calls when you ask**, now or later, on by default.
- **Calls on its own**, when the bot decides to, off by default. It calls at most `perDay` times a day, 3 by default, and never in your quiet hours, 22:00 to 07:00 by default. A call it makes listens for voicemail first, and leaves a short message there.

phone's `minutes`, `quiet`, and `perDay` settings change those limits.

## Pick a voice

**voice**, in phone-signalwire's settings, lists SignalWire's English voices by engine, and under each engine what a 10-minute call costs. Joanna, on Amazon Polly Neural, is the default. The lists need fxbot 0.11.0 or newer; an older one has a box to type a voice's name in. To give one bot a voice of its own, pick it under **Voice** in the bot's **Phone** section. **language** says which English you speak, for SignalWire to hear. To use a voice the list doesn't have, pick **Another, typed in…** and type its ID from SignalWire's [voices](https://signalwire.com/docs/platform/voice/tts) page, as `engine.voice:model`. SignalWire plays its own default voice for an ID it doesn't know.

SignalWire bills a call, listening throughout so you can cut in:

| Voices | 10 minutes |
| --- | --- |
| Amazon Polly Neural and Generative, and Google Neural2 | about $0.79 |
| ElevenLabs Flash, Cartesia Sonic 3, OpenAI, Deepgram Aura-1, Azure, Grok, Groq, and Inworld | about $1.02 |
| Deepgram Aura-2 and Google Chirp 3 HD | about $1.19 |
| Rime Coda | about $1.36 |

That's $0.008 a minute to call out, $0.06 a minute to listen, and the voice by the character, for about 3,400 characters in 10 minutes. Each thing you say is also a turn on the bot's own model.

SignalWire hears the call, as any phone service does. fxbot records nothing: what was said is in the bot's chat.
