# Phone calls

The user talks with a bot by voice, in the app or by calling it over a phone line.

**Plugin.** It needs a phone service and real-time voice, which not every owner wants. Talking in the app is a plugin with its own place in the app, through the [plugin API](../_completed/phases/plugins.md).

A live call between a bot and the owner's own phone, rung by the bot, is built in [Phone](../_completed/phases/phone.md), with [Phone: SignalWire](../_completed/phases/phone-signalwire.md) carrying it, and a cheaper softphone planned after it in [Phone: Telnyx](phone-telnyx.md). Talking in the app, and phone carrying the voice itself, in the app and on a phone line through its own SIP softphone, are built in [Phone v2](../_completed/phases/phone-v2.md). Calling a bot is not planned yet: phone's softphone signs in only while a call is on, so it would stay signed in and answer.
