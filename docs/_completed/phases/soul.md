# Soul

Each bot gets a soul: a short brief, in its own words, of who it is, how it sounds, and how it helps its owner.
- **A new bot gets to know its owner first.** The first time the owner opens a new bot's chat, the bot speaks before they type. From the name it was given, it guesses who it might be and what it could help with, and asks whether that fits and what the owner needs. With the owner's answers, it writes its soul, shows it, and offers to change it.
- **The soul shapes every chat.** It goes first in the bot's instructions, with a line saying the owner's own come first where they differ. It never changes the bot's rules or what it may do.
- **The bot keeps it up.** Asked to change how it is, the bot rewrites its soul and says what changed. The owner reads and edits it on the bot's edit screen, where each version is kept, to go back to.
- **Bring a bot from elsewhere.** A skill, `import-profile`, brings in a soul and memories from a Hermes Agent profile or an OpenClaw agent, from files the owner attaches. For an assistant with no files to export, such as Grok Bot, ChatGPT, or Claude, it gives the owner a prompt to paste there, and reads the answer.

Status: built on 2026-11-12, for 0.10.0, as planned the same day at the owner's word, with the open questions' recommendations. Where the build differs from the plan, [What the build changed](#what-the-build-changed) says so. The checklist's boxes are what ran here, against a mock model and a browser; what only a person can check is listed there too. Researched the same day:
- against the research directive's references: eve, OpenBot, OpenDuet, openmuse, OpenDots, Pi, and Grok Bot
- against OpenClaw, Hermes Agent and its agent importers, Letta, and the GPT builder, from source at the commits in [Research](#1-research), and their docs

It replaced a stub.

## What the owner asked

"Do research for the phase soul profile bot details. Allow a bot to edit it's sould, update it when asked etc, and when you create a new bot the first thing it wants to do is get information from you to understand who it is better and how it can help. It will try and infer some ideas from it's name you gave it, and then you confirm it and it writes up a nice brief of itself soul etc... allow a skill with this that you can import hermes profiles etc..." (2026-11-12)

## 0. Core or plugin

**A plugin, `soul`,** as the stub said, with one small change to the page API: an `app.chat` part gets `reload()` ([What the build changed](#what-the-build-changed)). A soul isn't one of the things every bot needs ([Core or plugin](../../../CONVENTIONS.md#core-or-plugin)): a bot runs on its owner's instructions alone, as every bot does today. An owner who wants plain bots leaves it out. The plugin API already has every piece:
- **The `instructions` hook** puts the soul in each chat, as chat rooms puts in who's in a room.
- **A tool of its own,** `soul_save`, writes it.
- **`app.chat`,** the plugin's part of a chat above the message box, starts a new bot's first meeting when the owner first opens its chat (`packages/ui/src/app.tsx:820-824`).
- **`fx.chats.send`** sends that meeting's brief to the bot's chat, marked as the plugin's, with `shown` for what the chat shows (`packages/sdk/src/plugin-api.ts:112`).
- **`app.botSettings`** puts the **Soul** box on the bot's edit screen, after **Instructions** (`app.tsx:559`).
- **`app.toolView`** shows each new soul in the chat.
- **The `skills/` folder** carries `import-profile`, as Pages and Chat rooms carry theirs (`packages/sdk/src/plugins.ts:309`).

A core hook for a new bot (`bot.created`) was the other way to start the meeting. The page is better: the meeting starts when the owner is there to answer, and not for a bot nobody opens.

## 1. Research

### fxbot today

- **A bot has a name, instructions, a provider and model, and a look** (`packages/sdk/src/index.ts:84-99`). The instructions are the owner's, at most 64 KiB, edited on the bot's edit screen (`packages/ui/src/app.tsx:555-556`). The new-bot form, which onboarding uses too, has no instructions: a new bot starts with none.
- **Each chat's instructions,** in order: the bot's instructions, its memories, its skills' catalog, then the plugins' `instructions` hooks, which may add, change, or remove entries (`index.ts:309-324`).
- **Onboarding** ends on the new bot: "Scout is ready", then **Start chatting** opens its chat ([onboarding](onboarding.md#the-flow)).
- **A file the owner sends** goes into the library: images, and Markdown, text, CSV, and JSON documents, which the bot reads (`packages/sdk/src/library.ts:21`).
- **A bot's tools never reach the owner's machine** ([Bots and the owner's machine](../../../CONVENTIONS.md#bots-and-the-owners-machine)). So an import can't open `~/.hermes` or `~/.openclaw`: it works from what the owner sends.
- **Plugin sessions:** a room's turn, a routine's run, and a subagent are sessions of a plugin's own. A tool call knows its session, and each bot's own chat is its `sessionId`.

### The directive's references

Read from source cloned on 2026-11-12: eve at `746a741`, OpenBot at `68fe327`, and Pi at `d78a75e`. Grok Bot's docs were read the same day.
- **eve's personal agent template** hard-codes its persona: "You are **${agent.name}**, a personal AI assistant. You are not a generic chatbot — you have a consistent personality, you know your name, and you stay the same across every conversation and channel" (`apps/templates/personal-agent-template/agent/lib/base-instructions.ts:4-9`). The developer edits it, not the agent.
  - **`save_memory` proposes,** "Requires one user approval" (`agent/tools/save_memory.ts:17`, `:25`).
  - **Its import is a prompt:** the person pastes "Export all of my stored memories and any context you've learned about me … Preserve my words verbatim where possible" into ChatGPT or Claude, and pastes the answer back (`lib/memory/export-prompt.ts:1-25`).
- **OpenBot** gives a Bot a name, a title, a role description, and instructions (`app/src/components/bot-profile/setup.tsx:71`).
  - **Its layering:** "Your role applies in every conversation, and each message sets the task within it. What the person says in the conversation comes before anything remembered about them" (`shared/bot-prompt.ts:453-454`).
  - **It drafts, the person saves:** a Bot writes a skill "with you in the conversation, and saves it only when you press the button on the card" (`README.md:399`).
  - **Its onboarding** asks the person's name, not the Bot's identity.
- **OpenDuet** is OpenBot's code. **openmuse and OpenDots** have no persona file or first meeting.
- **Pi** has `SYSTEM.md`, which "Replaces Pi's default system prompt", and `APPEND_SYSTEM.md`, which "Adds instructions" (`packages/coding-agent/docs/configuration.md:19-20`). No persona, onboarding, or self-editing.
- **Grok Bot** ([bots](https://docs.x.ai/grok-bot/bots)): a Bot is made with a name and a picture. "In your first message, give the Bot its job, sources, and approval boundaries, and ask it to remember them." "Personal Bots no longer have a description or a **Bot settings** page": "to change what a Bot does, tell it in chat." Its role lives in its memory.

### OpenClaw

Source at `56eb6f3`, cloned 2026-11-11.
- **Five files go in every turn, in a fixed order** (`src/agents/system-prompt-context-files.ts:7-15`):
  1. `AGENTS.md`, operating rules: "Personality and tone belong in `SOUL.md`" (`docs/reference/templates/AGENTS.md:10`)
  2. `SOUL.md`, the voice, framed with one line: "SOUL.md: persona/tone. Follow it unless higher-priority instructions override" (`system-prompt-context-files.ts:79`)
  3. `IDENTITY.md`: name, creature, vibe, emoji, and avatar, as `- Name:` lines it parses (`src/agents/identity-file.ts:18-33`)
  4. `USER.md`: rules about the person, each starting `Always`, `Never`, or `Prefer`, in at most 4,000 characters
  5. `MEMORY.md`
- **Limits:** 20,000 characters a file, and 60,000 in all (`docs/concepts/system-prompt.md:191-198`).
- **What a soul is:** "tone, opinions, brevity, humor, boundaries, default level of bluntness". "Do **not** turn it into a life story, a changelog, a security policy dump … Short beats long. Sharp beats vague." "Keep `AGENTS.md` for operating rules; keep `SOUL.md` for voice, stance, and style" (`docs/concepts/soul.md:16-20`, `:66-69`).
- **The agent edits it with its file tools,** under one rule: "**If you change this file, tell the user — it's your soul, and they should know.**" (`docs/reference/templates/SOUL.md:40`). The documented way to change a soul is to ask the agent to rewrite it (`docs/concepts/soul.md:38-53`).
- **The first run is `BOOTSTRAP.md`,** a ritual the agent deletes when it's done:
  - "**The user's request always comes first.** If the first message asks for real work, do that work completely … This file is a ritual, not a gate."
  - "Complete these four beats … Do not turn them into a questionnaire or a long biography" (`docs/reference/templates/BOOTSTRAP.md:14-21`).
  - **Its beats:** what to call it, "one short soul/vibe line … The user can veto or adjust it once", an avatar, and which apps to add.
  - **Its first beat changed.** The older template opened with "Who am I? Who are you?" and offered names (`test/fixtures/bootstrap/2026.6.1.md`). The current one says "**Do not choose, invent, or suggest a name for yourself.**" (`BOOTSTRAP.md:23-27`). No changelog entry says why.
- **What went wrong:**
  - **The first run swallowed real requests,** until "request always comes first".
  - **Saving identity early** ended the ritual midway, since a changed identity file marks the workspace as set up (`BOOTSTRAP.md:35-36`).
  - **A stale `BOOTSTRAP.md`** and greetings while one was pending needed fixes (CHANGELOG 2026.4.18, 2026.4.23).
  - **Weak models** didn't read the file, so it now goes in the user's turn (`docs/start/bootstrapping.md:56-61`).
- **The soul was attacked.**
  - **"soul-evil":** OpenClaw shipped a hook that swapped in another persona at random, removed after issue #8776 called it a "[Security Risk]" ("Security: remove bundled soul-evil hook. (#14757)", CHANGELOG 2026.2.12).
  - **Zenity Labs** showed a prompt injection whose scheduled task "periodically modifies SOUL.md" so the agent kept fetching an attacker's instructions, because the soul "is injected into the agent's context during every interaction" (labs.zenity.io, "OpenClaw or OpenDoor?", read 2026-11-12).

### Hermes Agent

Source at `e7212db`, and its official agent importers at `8b5b629`.
- **`SOUL.md` is first in the system prompt,** "replacing the hardcoded default identity", read only from the profile's home (`website/docs/user-guide/features/personality.md:9`, `:32-36`). Its guide: "Add 4–8 lines that clearly define tone and defaults" (`guides/use-soul-with-hermes.md:232`). "If it should follow you everywhere, it belongs in `SOUL.md`; if it belongs to a project, it belongs in `AGENTS.md`."
- **The soul is scanned for prompt injection.** A hit in the person's own soul warns and still loads, since "a user who *documents* "ignore previous instructions" in their security guidance must not lose their whole identity file". A soul from a downloaded distribution is blocked (`agent/prompt_builder.py:84-110`). Patterns such as `you are now a` also catch ordinary personas.
- **A profile is a folder** (`website/docs/user-guide/profiles.md:11`, `hermes_cli/profiles.py`):

  ```text
  <profile>/
    config.yaml       model, provider, personalities, time zone, MCP servers
    .env, auth.json   keys and logins                         (secret)
    SOUL.md           the persona
    profile.yaml      display_name, description, title, avatar
    memories/MEMORY.md, memories/USER.md   entries split by "\n§\n"
    skills/<category>/<name>/SKILL.md
    cron/jobs.json    scheduled jobs
  ```

  - **`hermes profile export`** writes one `.tar.gz` with one folder (`profiles.py:2152-2196`). It leaves out `.env`, `auth.json`, and the other credential stores by name, and masks what looks like a key. But "nothing scans skills, memories, or your persona for anything personal … Credentials are filtered by filename; content is not" (`profile-distributions.md:689-703`).
- **Bot Mode makes a Bot from three fields,** "**Name**, **Title**, **Description** — and the Bot exists in seconds, introducing itself as the first message of its new Bot Chat" (`website/docs/user-guide/bot-mode.md:61`).
- **Its OpenClaw import** (`hermes import-agent openclaw`, with a preview first):
  - **Copies `SOUL.md`,** but over Hermes's own default soul only. Otherwise it's a conflict, unless the person says to overwrite (`openclaw_to_hermes.py:1294-1301`).
  - **Splits `MEMORY.md` and `USER.md` into entries,** up to its caps. What's left over goes to a file of its own.
  - **Archives what has no home:** `IDENTITY.md`, `TOOLS.md`, `HEARTBEAT.md`, and `BOOTSTRAP.md`.
  - **Brings keys over only when asked,** with `--migrate-secrets`.
  - **Rewrites "OpenClaw" as "Hermes"** inside the imported soul and memories, without a word (`:527-565`).
- **Its Grok Bot import has no file to read:** "the user pastes `EXPORT_PROMPT` into a Bot's chat, and the Bot writes its own setup as one JSON document". The prompt says "never guess or fill it in from memory" and "Never include passwords, API keys, tokens" (`grok_bot.py:1-110`).

### Letta, and the GPT builder

- **Letta** keeps a `persona` block and a `human` block in the system prompt, and the agent edits them with tools such as `memory_replace` (Letta archive `56ba9c2`, `letta/functions/function_sets/base.py:263-342`). Letta Code's rules for changing them (`ed08ddc`, `src/skills/builtin/maintaining-core-memory/SKILL.md:6`, `:65-69`):
  - "Treat each change as a revision of that prompt, not an append to a log."
  - "Update only from a pattern or an explicit instruction, not a single ambiguous event."
  - "Write in plain language without all-caps or absolute emphasis. Overstated instructions get overapplied."

  Its persona prompt adds: "Honoring an explicit user request for a specific response (tone, format, level of detail) is not an identity deviation and needs no memory change" (`src/agent/prompts/letta_root_memfs.md:78-91`).
- **Letta's onboarding** is a checklist the agent deletes when it's done, and "Treat any decline — "skip", "pass", "next", "no thanks", "rather not", "later" … as a request to move on" (`src/agent/prompts/onboarding.mdx`).
- **ChatGPT's GPT builder** proposes and the person confirms. OpenAI's pages refused every fetch, so this is from secondary sources, one of them a leaked prompt not shown to be real: "You must provide a suggested name for the user to confirm", and "You will only ask one question at a time".

## 2. Key takeaways

1. **A soul is short, and apart from the rules.** Every system splits the persona from the operating rules, and frames the persona as "follow it unless higher-priority instructions override". fxbot has the split already: the owner's instructions are the rules, and the bot can't change them. The soul is the bot's own text beside them, at most 4,000 characters, as OpenClaw caps `USER.md`, and in practice 4 to 10 lines, as Hermes advises.
2. **Propose, then confirm.** The GPT builder proposes a name, and OpenClaw's vibe line can be vetoed once. fxbot's bot starts from the name the owner gave it and guesses who it is from it: a role, a voice, what it could help with. It offers that once, takes the owner's word, and writes. It never renames itself: OpenClaw's newest ritual forbids the agent choosing its own name.
3. **A meeting, not a gate.** OpenClaw learned that a first-run ritual must never swallow a real request. The bot asks a few things at once, at most three, and if the owner skips, or asks for something else, it does that, and doesn't bring the meeting up again.
4. **The meeting starts once, and records that it did.** OpenClaw fixed stale rituals and greetings that fired again. The plugin marks a bot as met in one statement, before it sends anything, so the meeting can't run twice.
5. **The brief goes in the turn.** OpenClaw moved its ritual into the user's turn, because weak models didn't read a file. Here the meeting's brief is the message that starts it.
6. **The bot edits its soul only when asked, and says so.** OpenClaw says "tell the user". Letta changes the persona only on an explicit ask or a pattern, and not for one reply's tone. The tool says the same, and the chat shows each new soul.
7. **The soul is an attack surface.** Zenity's injection rewrote a soul from a scheduled task. A soul here changes only in the bot's own chat, with the owner there: never in a routine, a subagent, or a room. Every version is kept, and the owner can see and restore each one.
8. **Imports read files, never secrets, and never reword.** Hermes's importer previews first, replaces only a default soul, and reports what it skipped. Its silent "OpenClaw" to "Hermes" rewording is the lesson. The skill shows what will go where before it saves, keeps the imported words, and leaves keys behind.
9. **No file? Ask the old assistant.** Grok Bot and the chat apps have nothing to export. Hermes and eve paste an export prompt into the old assistant, and read its answer. The skill does the same.
10. **The soul is the bot, everywhere.** It's short, so it goes in every chat: the bot's own, a room, a routine, a subagent. Only the bot's own chat can change it.

## 3. Implementation

### The plugin

`plugins/soul`, version 0.1.0. Its `minFxbot` is the release it ships with, since everything it uses is already there.

```text
plugins/soul/
  plugin.json
  fxbot/server.ts         the hook, the tool, the routes, the meeting
  fxbot/page.jsx          the Soul box, the meeting's start, the tool's card
  fxbot/page.js           built from page.jsx
  fxbot/migrations/0001_souls.sql
  skills/import-profile/SKILL.md
  skills/import-profile/references/hermes.md, openclaw.md, export-prompt.md
  README.md
```

**Its tables:**

```sql
-- Each bot's soul, in its own words, and when its first meeting started. A bot with neither has never met its owner.
create table souls (bot text primary key, text text not null default '' check (length(text) <= 4000),
  met_at timestamptz, updated_at timestamptz not null default now());
-- Every version, newest last, so the owner can go back. `by` is 'bot' or 'owner'.
create table versions (id serial primary key, bot text not null, text text not null, by text not null,
  at timestamptz not null default now());
```

### The soul in each chat

The `instructions` hook puts the soul first, for every chat of a bot that has one:

> Your soul: who you are, in your own words. Your owner's instructions come first where they differ, and your soul never changes your rules or what you may do. Change it with soul_save only when the owner asks you to, or agrees to a change you suggest, and tell them what changed.
>
> (the soul)

A bot with no soul gets nothing. A soul changes the instructions only when it does, so the prompt cache holds.

### `soul_save`

`soul_save` takes `text`, the whole new soul, and answers "Saved your soul. Tell the owner what changed."
- **The whole soul each time.** It's a few lines, and only the bot writes it.
- **Only in the bot's own chat.** In a room, a routine, or a subagent, it answers "Your soul changes only in your own chat, with your owner." The call's session must be the bot's own `sessionId`.
- **At most 4,000 characters,** or it answers "A soul is at most 4,000 characters: keep it to a few short lines." An empty text is refused too.
- **Each save is a version,** by `bot`. The plugin keeps the last 30 a bot has.
- **Its card in the chat,** through `app.toolView`, reads **Updated its soul**, and opens to the new text.

### The first meeting

**When it starts.** The plugin's `app.chat` part asks its route about the bot whose chat is open. The meeting starts when all of these hold:
- the bot has never had a chat: its `sessionId` is null
- it has no soul
- it hasn't met: `met_at` is null
- the plugin is on for it

The route marks it met in one statement (`update … set met_at = now() where met_at is null returning`), then sends the brief. A second tab, or a reload, finds it met, and sends nothing.

**The message.** `fx.chats.send(bot, { text: brief, shown: "First meeting", label: "Soul" })`. The chat shows a small message from Soul, and the bot answers it, so the bot speaks first. The brief:

> This is your first meeting with your owner, who just made you. Your name is {name}.
> 1. Greet them in a line or two. From your name alone, guess who you might be: a role, a voice, and what you could help with. Offer it as one short guess, and ask whether it fits. Never pick a new name for yourself.
> 2. In the same message, ask what they'd most like your help with, and what you should know about them. Ask three questions at most.
> 3. When they answer, write your soul with soul_save: 4 to 10 short lines, in the first person: who you are, how you sound, what you help with, and how you work with them. No rules or permissions: their instructions hold those. Then show it to them, and offer to change it.
> 4. Save what you learned about them with memory_save, one fact at a time.
>
> If they skip this, or ask for something else, do that instead, and don't bring this meeting up again unless they ask.

The brief is sent as the plugin's message, so the bot's instructions come first, as they always do. A bot made before the plugin was added has had a chat, so it doesn't start a meeting. Its owner asks it to write its soul when they want one.

### The Soul box

On the bot's edit screen, after **Instructions**, through `app.botSettings`:

```text
Soul
Written by Scout, with you. Your instructions above come first.
┌──────────────────────────────────────────────┐
│ I'm Scout. I find things out: I read widely,  │
│ check my sources, and come back with what     │
│ matters first…                                │
└──────────────────────────────────────────────┘
Saved by Scout, Nov 12                [ History ]
```

- **The owner edits the soul in place,** and **Save** saves it as a version by `owner`.
- **History** lists the versions, newest first, each with who saved it and when. **Restore** saves that text again, as a new version.
- **Empty,** it says: "Scout hasn't written its soul yet. Ask it to, in its chat, or write one here."
- **Routes:** `GET`, `PUT /souls/:bot`, `GET /souls/:bot/versions`, `POST /souls/:bot/versions/:id/restore`, and `POST /souls/:bot/meet`.

### The `import-profile` skill

The skill is instructions for the bot, with the details in its references. A bot uses it when the owner says something like "bring in my Hermes profile", or sends its files.
- **What to ask for:**
  - **Hermes Agent:** `SOUL.md`, `profile.yaml`, `memories/MEMORY.md`, `memories/USER.md`, and `config.yaml`, from the profile's folder, or from inside the archive `hermes profile export` writes. Never `.env` or `auth.json`.
  - **OpenClaw:** `SOUL.md`, `IDENTITY.md`, `USER.md`, and `MEMORY.md`, from its workspace. Never its `.env` or `credentials/`.
  - **Grok Bot, ChatGPT, Claude, or another app with nothing to export:** the export prompt in `references/export-prompt.md`, to paste there. It asks the assistant for its role, its instructions, what it knows about the owner, and its routines, in its own words, "never guessed", and never keys or passwords. The owner pastes the answer back.
- **Where each goes:**

  | From | To |
  | --- | --- |
  | `SOUL.md`; with OpenClaw, `IDENTITY.md`'s creature and vibe too | the soul, word for word, cut to fit 4,000 characters only with the owner's yes. The skill skips Hermes's own default soul and placeholder text such as "(pick something you like)" |
  | `profile.yaml`'s `display_name` and `description`, or `IDENTITY.md`'s name | a suggestion only: the bot keeps the name the owner gave it, and offers the old one |
  | `USER.md` entries (`§`-separated in Hermes, `Always`/`Never`/`Prefer` lines in OpenClaw) | memories about the owner, one fact each |
  | `MEMORY.md` entries | memories, one fact each, after the owner looks over the list |
  | `config.yaml`'s model, time zone, MCP servers, skills, and scheduled jobs | a report of what came with it, and where it goes in fxbot: the bot's settings, **Settings** › **General**, **Skills**, or a routine |
  | `AGENTS.md`, `system_prompt.md`, and other rules | a report. The owner may add them to the bot's instructions. They never go in the soul. |

- **Show, then save.** Before saving anything, the bot shows the soul it would write, and the count of memories. If the bot has a soul already, it shows both, and asks which to keep, or how to merge them.
- **Word for word.** The bot keeps the imported text, and says when it changes any. No renaming "Hermes" or "OpenClaw" inside it.
- **Never a secret.** A value that looks like a key, a token, or a password, or one an export masked, such as `***` or `sk-p...7890`, is left out, and the report says so.
- **Then a report:** what came in, what was skipped, and why.

An archive (`.tar.gz`) can't be attached: the library takes text and images. So the skill asks for the files inside it ([Question 3](#5-open-questions)).

### Docs

- **A how-to,** `how-to/give-a-bot-a-soul.md`: the first meeting, changing the soul, the Soul box, and bringing in a Hermes or OpenClaw bot.
- **`explanation/bots-and-chats.md`:** a soul beside instructions and memories, and which comes first.
- **The plugin's README,** its line in `plugins-registry.json`, and `## Unreleased`.

### Not in this phase

- **An archive upload,** which the plugin would unpack into the files the skill reads ([Question 3](#5-open-questions)).
- **Importing skills, routines, and MCP servers.** The report says what came, and the owner adds them where they live.
- **A user file,** OpenClaw's `USER.md`: what the bot knows about its owner stays in memories.
- **An avatar from the meeting.** The bot's look is the owner's choice, in the picker.
- **Scanning a soul for injection.** Hermes's patterns catch ordinary personas. The soul is short, the owner sees each version, and only the bot's own chat changes it.

### Size

| Where | Lines, about |
| --- | --- |
| `server.ts`: tables, hook, tool, routes, meeting | 180 |
| `page.jsx`: the Soul box, its history, the meeting's start, the card | 160 |
| The skill and its references | 150 of Markdown |
| Docs | 80 |

## 4. Checklist

Against a disposable fxbot and a mock model that logs each request, with the plugin added and on:
- [x] Making a bot and opening its chat starts one meeting: the chat shows "First meeting" from Soul, and the bot's answer. The mock's request carries the brief with the bot's name. A reload, a second tab, and opening the chat again send nothing more.
- [x] A bot that has chatted before the plugin was added, and a bot the plugin is off for, start no meeting.
- [x] `soul_save` in the bot's own chat saves the soul and a version, and the card shows **Updated its soul**. The next turn's instructions open with the soul and its framing line. A bot with no soul gets no such line.
- [x] `soul_save` refuses in a room, a routine's run, and a subagent, a text over 4,000 characters, and an empty one.
- [x] The Soul box shows the soul. The owner's edit saves a version by the owner, and the next turn carries it. **History** lists the versions, and **Restore** brings one back as a new version.
- [x] After 31 saves, a bot keeps 30 versions.
- [x] Removing the plugin removes its tables, and every bot's chat opens without a soul.

The skill, with the mock model scripted, and by reading:
- [x] `import-profile` reaches the bot's catalog, and its references name what to read and what never to read, for Hermes and OpenClaw, and hold the export prompt.

The rest:
- [x] Docs as above, `npm run typecheck`, the plugin's page built with its README's command, `npm run build-site`, and `git diff --check`.

Only a person can check, with a real model:
- [ ] A new bot named "Scout" guesses a role from the name, asks at most three questions, and after the owner answers writes a soul of a few lines and shows it.
- [ ] An owner who answers the meeting with "can you summarize this link?" gets the summary, and no more of the meeting.
- [ ] "Be more blunt" in one reply changes that reply, not the soul. "From now on, be blunt with me" changes the soul, and the bot says so.
- [ ] A Hermes profile's `SOUL.md`, `USER.md`, and `MEMORY.md`, attached, come in as the skill says, with a preview first and a report after. The same for an OpenClaw workspace's files, and for Grok Bot's answer to the export prompt.

## 5. Open questions

Taken as recommended at the build, on 2026-11-12: the soul first, no archive upload, and the meeting saves to the bot's own memories, since team memories aren't built. The owner answered the first after the build: "yes soul is essentials" (2026-11-12).

1. **In Essentials?** A first meeting is a good first impression, and onboarding's first bot would start one. Recommended: yes, after it's been tried on a few new bots. Answered on 2026-11-12: yes, it's in **Essentials**, so onboarding's first bot meets its owner.
2. **The soul first, or after the owner's instructions?** Hermes puts the soul first, and OpenClaw puts the rules before it. Recommended: first, with the line that the owner's instructions come first where they differ. The hook can't tell an empty instructions entry from the rest, so first is also the simplest.
3. **An archive upload for Hermes's export?** The owner would send the `.tar.gz` from the Soul box, and the plugin would unpack only the files the skill reads, about 80 lines. Recommended: not at first. The skill takes the files, and asks for the archive's contents.
4. **The owner's name, and other facts every bot needs.** The meeting saves what it learns to the bot's own memories. With [team memories](memories-v2.md), facts such as the owner's name could be the team's. Recommended: the bot asks before it saves one to the team.

## What the build changed

- **`app.chat` parts get `reload()`** (`packages/ui/src/app.tsx`, `plugins.tsx`). The plan said the plugin API had every piece. It didn't: a chat reads its bot once, and follows a stream only once the bot has a session, so a meeting the plugin started in a new bot's chat didn't show until a reload. `reload` reads the bot again, as the chat already does after a start-over, and the meeting's part calls it once the meeting has started. It's added, so `plugin-breaks.json` gets no line. The plugin's `minFxbot` is 0.10.0 for it.
- **The card is a card of its own.** A plugin can't change a tool step's title, so the step still reads **Ran soul_save**. The plugin's view is open, `app.toolView("save", …, { open: true })`, so **Updated its soul** is a card under it, folded, opening to the new text. A refused call has no card: its step's result says why.
- **The owner's button is Save soul.** The edit screen has its own **Save**, for the bot's form, so the box's own says what it saves. It's off until the text changes.
- **The owner can clear the soul.** Saving the box empty leaves the bot with no soul, and no line in its instructions. The empty version is kept, as "(empty)", so it can be undone. The bot can't save an empty soul.
- **A failed meeting tries again.** The bot is marked met before the brief is sent. When the send fails, such as on a provider with no model, it's unmarked, and the next open of the chat tries again. The page asks only for a bot with a provider and no chat yet, so a bot without a provider doesn't ask.
- **Saving the same text adds no version.** Each save locks the bot's row, and compares, in one transaction.
- **The checks:** 37 against the server and the scripted mock model, 16 in Chromium against the built page, and 5 for removing the plugin, all on a fresh check world.
  - **Where `soul_save` was tried:** a room, a routine's run, and a subagent.
  - **Turning the plugin off for one bot:** a plugin on for **all** bots can't be. That check set it to **Choose** first.
  - **The check server said 0.9.0,** since `package.json` trails the release branch, and ran the plugin as a local one.
- **Size:** 125 lines of server code, 118 of page code, a 7-line migration, 137 lines of skill and references, and 9 changed in the app. Under the plan's 340 and 150.
