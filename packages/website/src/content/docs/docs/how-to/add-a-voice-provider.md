---
title: "Add a voice provider"
description: "Pick how bots hear you and speak on a call in the app: ElevenLabs or Deepgram with a key, a login you already have, a speech server on your machine, or the browser's own speech."
---

A call in the app, **Talk** in a bot's message box, needs something to hear you and something to speak. The phone plugin picks one of each in its tab, under **Voice**. Each can be:

- **A voice service with a key:** ElevenLabs or Deepgram, added from **Settings** › **Providers**.
- **A login you already have** for a bot's model: Mistral, Groq, OpenAI, Cloudflare, and other providers that serve OpenAI's audio endpoints.
- **A speech server on your machine,** such as Speaches. See [Run speech on your machine](/docs/how-to/run-speech-on-your-machine/).
- **This device:** the browser's own speech, with nothing to add.

## Add ElevenLabs or Deepgram

1. Add **phone** from **Plugins**, on **Browse**. Phone 0.2.0 needs fxbot 0.12.0 or newer.
2. Open **Settings** › **Providers**, and choose **Add provider**. Under **For phone**, pick **ElevenLabs** or **Deepgram**.
3. Make a key on the service's site, as the card says, and paste it. fxbot checks it with the service, and keeps it sealed on the server. The page never gets it back.

| Service | What it does on a call | The key |
| --- | --- | --- |
| **ElevenLabs** | Listens with Scribe, as you speak, and speaks with Flash in any of your voices, cloned ones too | **Create API key**, with Text to Speech, Speech to Text, and Voices read access |
| **Deepgram** | Listens with Flux, which hears when you've finished, and speaks with Aura | **API Keys** › **Create a New API Key** |

A voice provider serves no chat model, so no bot or default offers it. **Settings** › **Providers** lists it with "For phone".

## Use a login you have

A provider a bot already uses may hear you too, with no new key:

| Provider | Listening | Speaking |
| --- | --- | --- |
| Mistral | Voxtral, as you speak | No |
| Cloudflare | Deepgram's Flux, as you speak | No |
| OpenAI, Azure, Groq, Together, DeepInfra, OpenRouter, LiteLLM, or a custom server | One stretch at a time | Yes, except vLLM |
| vLLM | One stretch at a time | No |

**One stretch at a time** means the phone plugin sends what you said once you pause, and you cut the bot off by talking over it for most of a second. A listener that hears as you speak stops the bot at your second word.

## Pick the voice

In **Settings** › **Plugins** › **phone**, under **Voice**:

1. **Listening:** what hears you. With nothing picked, it's ElevenLabs, else Deepgram or Cloudflare, else Mistral, else one of the others, else This device.
2. **Speaking:** what speaks. ElevenLabs, then Deepgram, then the others.
3. **Voice:** the speaker's voice for every bot. To give one bot a voice of its own, pick it under **Voice** in that bot's **Phone** section. In a room, a bot with none gets one no other bot there has.

The model boxes under each say which model it uses. Leave them as they are unless you know you want another.

## This device

**This device** listens and speaks in the browser, with no service. Speaking works everywhere. Listening needs the browser's speech recognition, which Chrome, Edge, and Safari have, and Firefox doesn't, so Firefox doesn't offer it.

Chrome listens on your computer when it has your language there. Otherwise it would send what you say to Google, so a call says why it can't listen, until you turn on phone's `googleListening` setting. An iPhone app added to the home screen has no speech recognition: pick a service there.
