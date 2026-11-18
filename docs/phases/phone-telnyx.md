# Phone: Telnyx

The same call as [Phone: SignalWire](../_completed/phases/phone-signalwire.md), for about a third of the price, with better speech. Press Call me, the bot rings the owner's phone, and they talk, hands-free, with the bot's own turn deciding everything and nothing reaching fxbot.

**Plugin,** `phone-telnyx`, a provider for [Phone](../_completed/phases/phone.md), beside `phone-signalwire`. The owner asked for it on 2026-11-14 as "a more complex but cheaper alternative for folks." phone holds the conversation, its rules, and what each bot gets, so this is only the carrier.

**How:** fxbot is a softphone.
- It signs in to Telnyx over a connection it opens, as a phone app does, and places the call.
- It carries the call's audio, 8 kHz μ-law, so no codec is needed.
- Its speech runs on providers the owner picks, over WebSockets fxbot opens: Deepgram's Flux, which hears when the owner has finished, and ElevenLabs' v4 Turbo, the #2 voice, or Cartesia's Sonic 3.6 or xAI.
- phone's `call.ts` is the same. What's new is the carrier, here, and two parts shared with [Phone in the app](phone-in-app.md), which carries audio too: speech providers as plugins, and a `cascade.ts` in phone, which makes a line from audio and a speech provider. That file takes turns, cuts the bot off when the owner talks, keeps track of what was heard, and keeps the bot's own voice from cutting it off.

Found on 2026-11-14, before planning:
- **Cost:** $0.005 to $0.007 a minute for the phone, and about $0.025 all-in with Flux and v4 Turbo. That's $0.25 to $0.27 for 10 minutes, or $27 to $29 for 18 hours, against SignalWire's $85 to $109.
- **Code:** about 1,050 to 1,500 lines beyond SignalWire's plugin:
  - the carrier, 450 to 650
  - `cascade.ts`, 350 to 500
  - speech to text and text to speech, 240 to 360
- **Calls in for free:** the softphone stays signed in, so the owner could also call the bot, "Hey Siri, call Bob," with nothing public.
- **Two ways to sign in, and one open question: does the audio get back through the owner's router with no port forward?**
  - **Plain SIP over TLS, with encrypted RTP,** to a Telnyx credential connection.
    - Standard protocols, with no terms to worry about. `ringcentral-softphone-ts`, 2,021 lines of TypeScript on Node's own modules, is a working shape to follow.
    - Whether audio returns depends on Telnyx sending it to where fxbot's audio comes from, which Telnyx doesn't document. Telnyx lists a private address in the offer as a reason to refuse a call. A VoIP.ms user behind carrier-grade NAT lost one direction 10 to 15 minutes into calls.
  - **Telnyx's WebRTC,** with werift, which fxbot already bundles for web pairing.
    - Telnyx's relay servers carry the audio through any router, over port 443 if need be.
    - But its signaling is what Telnyx's browser SDK speaks, which Telnyx calls "not a supported API," and its acceptable-use policy bans "reverse-engineering any of the Services." It needs Telnyx's OK in writing first.
    - Telnyx lists one-way audio as an open issue (#487).
    - werift before 0.27 used only the first relay server it was given. Web pairing pins 0.25.2, and should move up too.
- **Measured here:** werift sending phone audio both ways every 20 ms used about 1.5% of one core per end of a call.
- **Before planning, on the owner's network and in the release's container:**
  - a 30-minute call with plain SIP, which shows whether audio stays two-way
  - Telnyx's WebRTC only if it doesn't
  - which way through the router a call takes, and whether Telnyx bills its $0.002 WebRTC fee

Not planned yet.
