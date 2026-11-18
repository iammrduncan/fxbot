# Phone in the app

Talk with a bot by voice in fxbot's own page, with no phone network: the app's microphone and speaker, over the connection the page already has, through web pairing too. It's a call as [Phone](phone.md) has them, with the same tools, rules, and conversation.

**Plugins:**
- **`phone`** gains the in-app call: a socket of its own for the page's audio, a call bar with the microphone, and a `cascade.ts`, which makes a line from audio and a speech provider. That file:
  - takes turns
  - cuts the bot off when the owner talks
  - keeps track of what was heard
  - keeps the bot's own voice from cutting it off
- **A speech provider plugin** turns audio into text and back, over WebSockets fxbot opens, such as `phone-elevenlabs`, with ElevenLabs' realtime speech to text and its voices. Deepgram and Cartesia would be others. It needs `phone` with a `speech` block of its own, beside the `line` that [Phone: SignalWire](../_completed/phases/phone-signalwire.md) fills.

The owner asked for it on 2026-11-18: "Not all phone setups require actual SIP/outboudn calling. some can be just in app call (data only). Configured in the provider, and phone you select your default provider etc."

**Open before planning:**
- **Where audio goes:** the browser's echo cancellation, and whether 16 kHz audio over the page's WebSocket and web pairing's data channel keeps up.
- **Which speech provider first,** by price and how soon it hears the owner has finished.
- **Sharing `cascade.ts`:** whether [Phone: Telnyx](phone-telnyx.md)'s softphone uses the same file with the same speech providers.

Not planned yet.
