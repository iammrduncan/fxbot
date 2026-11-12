# soul

A plugin for [fxbot](https://fxbot.sh): each bot writes a soul, a short brief in its own words of who it is, how it sounds, and how it helps you. A new bot writes it in a first meeting with you, and rewrites it when you ask. You read and edit it on the bot's edit screen, where every version is kept.

Add it from **Plugins**, where fxbot's list has it. It runs inside fxbot: read its code there before you add it. It needs fxbot 0.10.0 or newer, so a chat follows the meeting it starts. See [Give a bot a soul](https://fxbot.sh/docs/how-to/give-a-bot-a-soul/).

## The first meeting

The first time you open a new bot's chat, the bot speaks first. The meeting starts for a bot the plugin is on for that has a provider, has never had a chat, and has no soul.
- **Its message:** "First meeting", from Soul. The bot gets a brief, `brief()` in `fxbot/server.ts`. From its name alone, it guesses who it might be, asks whether that fits, and asks what you'd like help with, at most three questions. With your answers, it writes its soul and shows it to you.
- **Once only:** the bot is marked met before anything is sent, so a second tab or a reload sends nothing more. A send that fails, such as with no model, unmarks it, and the next open tries again.
- **Not a gate:** if you skip it, or ask for something else, the bot does that instead, and doesn't bring the meeting up again.

A bot that had a chat before you added the plugin doesn't start a meeting. Ask it to write its soul when you want one.

## The soul in each chat

The soul goes first in every chat of the bot: its own, a room, a routine's run, and a subagent. A line before it says your instructions come first where they differ, and that the soul never changes the bot's rules or what it may do. A bot with no soul gets nothing.

## `soul_save`

The bot rewrites its soul with `soul_save`, the whole text each time.
- **Only in its own chat:** in a room, a routine, or a subagent, it answers "Your soul changes only in your own chat, with your owner."
- **Only when you ask,** or agree to a change it suggests. A request about one reply's tone isn't one.
- **At most 4,000 characters.** An empty text is refused.

Each save is a version, and its card in the chat reads **Updated its soul**, opening to the new text.

## The Soul box

On the bot's edit screen, after **Instructions**: the soul, which you edit in place and save with **Save soul**, who saved it last, and **History**. Each version shows who saved it and when. **Restore** saves an earlier one again, as your newest. A bot keeps its last 30 versions.

## Bringing a bot from elsewhere

The skill `import-profile` brings a soul and memories over from another assistant:
- **Hermes Agent:** a profile's `SOUL.md`, `profile.yaml`, `memories/MEMORY.md`, `memories/USER.md`, and `config.yaml`, sent in the chat
- **OpenClaw:** a workspace's `SOUL.md`, `IDENTITY.md`, `USER.md`, and `MEMORY.md`
- **Grok Bot, ChatGPT, or Claude:** an export prompt, which you paste there, and its answer, which you paste back

The bot shows what it will save before it saves, keeps the imported words, and never brings keys over. Bots can't read your machine's folders, so you send the files.

## Tables

In the plugin's own schema, `plugin_soul`, from `fxbot/migrations/0001_souls.sql`:
- `souls`: each bot's soul, and when its first meeting started
- `versions`: each version, by the bot or by you

Removing the plugin removes them, and every bot's chats open without a soul.

## Files

- `plugin.json`: the plugin's name, version, and what fxbot loads
- `fxbot/server.ts`: the instructions hook, `soul_save`, the meeting, and the routes the page calls
- `fxbot/page.jsx`: the meeting's start, the Soul box, and the card, built into `fxbot/page.js`
- `skills/import-profile/`: the import skill, with a reference for Hermes Agent, one for OpenClaw, and the export prompt

## Building it

`fxbot/page.js` is `fxbot/page.jsx` bundled with [rolldown](https://rolldown.rs), which comes with fxbot's packages. Run this in this folder, in a checkout of fxbot, after changing `page.jsx`:

```sh
npx rolldown fxbot/page.jsx --format cjs -e react -e react/jsx-runtime -e @fxbot/app --file fxbot/page.js
```

Commit both.
