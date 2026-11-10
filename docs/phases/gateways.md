# Gateways

The owner talks to their bots from the chat apps they already use, such as Telegram, Discord, Slack, WhatsApp, Signal, or email, and the conversation is the same one the app shows.

**Plugins,** one for each chat app, each a gateway. What they all do is the same, so this stub sets it out once, and each gateway's own phase only adds what its app needs:
- **Only the owner gets in.** fxbot has no login, so a gateway pairs the owner's account in that app once, with a code fxbot shows, and answers no one else.
- **One conversation.** A message from the chat app goes to the bot's own chat as the owner's, marked with where it came from, and the reply goes back. The app shows both, and the bot's memory, tools, and computer are the same.
- **A chat or channel for each bot,** or one where the owner names the bot.
- **The reply as it's written,** where the app lets a message be edited, and files and images both ways.
- **What waits for the owner,** such as a permissions card or a page's request, comes as buttons where the app has them, or a reply to answer. **Stop** ends a turn.
- **No way in from outside.** Each gateway uses the app's own outgoing connection, such as long polling or a WebSocket, so nothing on the machine is opened to the internet.

The smallest core hook they likely share: a message into the bot's own chat as the owner's, from a plugin, marked with where it came from. Today a plugin's `fx.chats.send` shows as "From <plugin>." The reply already comes from `turn.end` and `fx.chats.stream`.

Why: every product people compare fxbot with leads with chat apps. OpenClaw names 29 channels, Hermes Agent's first feature is "Telegram, Discord, Slack, WhatsApp, Signal, Email," and eve adds them with `/add`. People asked the owner for Discord and Telegram ([first impressions](first-impressions.md)). fxbot's own app stays the place for what a chat app can't show: pages, the computer, subagents, and settings.

The first two gateways: [Telegram and Discord](telegram-and-discord.md).

Not planned yet.
