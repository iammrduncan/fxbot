---
title: "Talk with a bot on the phone"
description: "Press Call me and a bot rings your phone through SignalWire, greets you, and you talk with it, hands-free: its own model, memory, and tools answer."
---

With the phone-signalwire plugin, **Call me** in a bot's message box rings your phone. Answer and the bot says "Hey, this is your fxbot Bob. How can I help today?" Then you talk, as you'd chat by text: what you say goes to the bot's own chat, and its own model, memory, and tools answer, read out to you. The chat keeps the whole conversation.

fxbot opens a connection to SignalWire for each call, and SignalWire places the call, hears you, and speaks the bot's words. SignalWire never connects to fxbot.

1. Set up SignalWire, below.
2. Add **phone-signalwire** from **Plugins**, on **Browse**. It isn't in **Essentials**. It needs fxbot 0.9.0 or newer.
3. Fill in its settings, in **Settings** › **phone-signalwire**, and confirm your number there.
4. Press **Call me** in a bot's message box.

## Set up SignalWire

1. Sign up at [signalwire.com](https://signalwire.com), and pick your space's name: your space is `<name>.signalwire.com`.
2. In the space's **API Credentials**, copy the **Project ID**, and make an **API token** with the **Voice** scope.
3. Buy a phone number, $0.50 a month in the US. Calls come from it.
4. A trial account calls only numbers you've verified. Verify your own phone there, and you can try it before paying. Adding $5 ends the trial.

## Fill in the plugin's settings

| Setting | What to put |
| --- | --- |
| `space` | Your space, such as `example.signalwire.com` |
| `project` | The Project ID |
| `token` | The API token, which fxbot keeps sealed |
| `from` | The number you bought, such as `+15551234567` |
| `to` | Your phone, such as `+15557654321` |

Then press **Call me to confirm** in the plugin's tab. Your phone rings and reads a 4-digit code, twice. Type it in the tab. Until then, no call goes out, so a typo can't ring someone else. Changing `to` asks you to confirm again.

Save the number you bought as a contact on your phone, such as "Bob (fxbot)". Then it rings when **Silence Unknown Callers** is on, it's less likely to be marked as spam, and your car says who's calling.

## On a call

- **Talk as you would to a person.** Keep going after the bot's greeting. It answers in a sentence or two, with nothing it can't say aloud: a link is "a link in the chat," and a code block is "There's more in the chat."
- **While it thinks,** you hear "One moment.", and "Still working on it." while a tool runs. Long work goes to a subagent, if the bot has the subagents plugin, and its report is read out when it's back, if you're still on.
- **Talk over it** to cut it off. Its work goes on, and it knows where you stopped listening.
- **Say "stop"** to stop the work the call started. "Wait" or "hold on" only stops it talking.
- **Anything that needs your OK** waits on your screen. Answer it when you can look.
- **Say goodbye** and the bot hangs up, or hang up yourself. A call ends too after a minute with nothing said, and at `minutes`, 30 by default.

The bar above the message box shows the call, ringing and then on, with **End call**.

## Let a bot call you

Ask it: "Call me." Or "Call me when the build is done": the bot keeps one call-back, for 12 hours, and rings you when it's done, with why it called.

To let a bot call when it decides to, turn on **May call me on its own** in its settings, under **Phone**. It calls at most `perDay` times a day, 3 by default, and never in your quiet hours, 22:00 to 07:00 by default. A call it makes listens for voicemail first, and leaves a short message there.

## Voices and what a call costs

`voice` is a SignalWire voice, as `engine.voice:model`. SignalWire bills a call, listening throughout so you can cut in:

| Voice | Example | 10 minutes |
| --- | --- | --- |
| Amazon Polly Neural, the default | `amazon.Joanna:neural:en-US` | about $0.79 |
| ElevenLabs Flash, or Cartesia Sonic | `elevenlabs.Rachel:eleven_flash_v2_5` | about $1.01 |

That's $0.008 a minute to call out, $0.06 a minute to listen, and the voice by the character. SignalWire's [voices](https://signalwire.com/docs/platform/voice/tts) page lists them all. Each thing you say is also a turn on the bot's own model.

SignalWire hears the call, as any phone service does. fxbot records nothing: what was said is in the bot's chat.
