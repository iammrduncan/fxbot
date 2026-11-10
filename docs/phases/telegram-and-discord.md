# Telegram and Discord

The owner messages their bots from Telegram or Discord, as from fxbot's own app.

**Plugins,** `telegram` and `discord`, the first two [gateways](gateways.md), on the hook they share:
- **Telegram:** the owner makes a bot with Telegram's @BotFather and pastes its token in the plugin's settings. "Just a bot token," as OpenClaw puts it, makes it the quickest to set up. The plugin long-polls Telegram's Bot API, so it needs only outgoing connections. A reply grows by editing its message, and a card that waits for the owner comes as inline buttons.
- **Discord:** the owner makes an application with a bot user in Discord's developer portal and pastes its token. The plugin holds Discord's gateway, an outgoing WebSocket. The owner talks to their bots in direct messages, or in a private server with a channel for each bot.
- **Pairing:** each pairs the owner's own account with a code from fxbot, and answers no one else, as [Gateways](gateways.md) sets out.

Not planned yet.
