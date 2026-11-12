---
title: "Give a bot a soul"
description: "The soul plugin has each bot write a short brief of who it is, how it sounds, and how it helps you: in a first meeting when you make it, again when you ask, or brought over from Hermes Agent or OpenClaw."
---

The soul plugin gives each bot a soul: a few lines, in its own words, of who it is, how it sounds, and how it helps you. It goes first in every chat of the bot. Your instructions still come first where the two differ, and the soul never changes what the bot may do.

1. Add **soul** from **Plugins**, on **Browse**, or with **Essentials**, which has it. It needs fxbot 0.10.0 or newer.
2. Make a bot, with **New bot** at the top of the sidebar, and open its chat.
3. The bot speaks first. From its name, it guesses who it might be, and asks whether that fits and what you'd like help with.
4. Answer it. It writes its soul, shows it to you, and offers to change it.

## The first meeting

The meeting starts once, the first time you open a new bot's chat. The chat shows "First meeting", from Soul, then the bot's greeting. It asks three questions at most.

If you'd rather get straight to work, ask for what you need. The bot does it, and doesn't bring the meeting up again. A bot you made before adding the plugin has no meeting: ask it to write its soul whenever you like.

## Change a soul

- **In the chat:** tell the bot, such as "From now on, be blunter with me." It rewrites its soul, and says what changed. The chat shows **Updated its soul**, which opens to the new text. A request about one reply, such as "keep this one short", changes that reply, not the soul.
- **On its edit screen:** open the bot's settings. **Soul** is under **Instructions**. Edit it there, and choose **Save soul**. Clearing it and saving leaves the bot with no soul.

The bot changes its soul only in its own chat, with you. In a room, a routine, or a subagent's work, it can't.

## Go back to an earlier soul

Under **Soul**, choose **History**. Each version shows who saved it, the bot or you, and when. **Restore** saves that one again, as the newest. A bot keeps its last 30 versions.

## Bring a bot from elsewhere

The plugin comes with a skill, `import-profile`, for bringing a bot over from another assistant. Tell the bot where you're coming from, and send what it asks for:
- **Hermes Agent:** the profile's `SOUL.md`, `profile.yaml`, `memories/MEMORY.md`, `memories/USER.md`, and `config.yaml`. They're in `~/.hermes`, or `~/.hermes/profiles/<name>/`, or inside the archive `hermes profile export` writes: open it, and send the files inside.
- **OpenClaw:** the workspace's `SOUL.md`, `IDENTITY.md`, `USER.md`, and `MEMORY.md`, usually in `~/.openclaw/workspace/`.
- **Grok Bot, ChatGPT, or Claude:** the bot gives you a prompt to paste there. Paste its whole answer back.

Never send `.env`, `auth.json`, or a credentials folder: they hold keys, and the bot doesn't need them.

Before it saves anything, the bot shows you the soul it would write and the memories it would keep, and what it left out. It keeps the imported words as they were. Your old assistant's model, connections, and schedules aren't brought over: the bot tells you where each goes in fxbot.

## Only some bots

The soul plugin is on for every bot once added. To give only some bots a soul, open **Settings** › **Soul**, and under **Bots** choose **Choose**, then switch it on for each one. A bot it's off for keeps its soul, but doesn't use it.
