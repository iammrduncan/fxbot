---
name: import-profile
description: Use when the owner wants to bring a bot over from another assistant, such as a Hermes Agent profile, an OpenClaw agent, Grok Bot, ChatGPT, or Claude, or sends files like SOUL.md, IDENTITY.md, USER.md, MEMORY.md, or profile.yaml. Which files to ask for, which never to read, where each part goes in fxbot, and how to show it before saving.
---

# Import a profile

The owner is bringing you over from another assistant. You take its soul and what it knew about them, and leave the rest for them to set up in fxbot. You can't open their machine's folders: you work from the files they send in this chat, or from text they paste.

## 1. Ask for the right things

Ask which assistant it was, then ask for its files:

- **Hermes Agent:** `SOUL.md`, `profile.yaml`, `memories/MEMORY.md`, `memories/USER.md`, and `config.yaml`. They're in the profile's folder, `~/.hermes` or `~/.hermes/profiles/<name>/`, or inside the `.tar.gz` that `hermes profile export` writes: open it and send the files inside. Read `references/hermes.md` before you read them.
- **OpenClaw:** `SOUL.md`, `IDENTITY.md`, `USER.md`, and `MEMORY.md`, from its workspace, usually `~/.openclaw/workspace/`. Read `references/openclaw.md` before you read them.
- **Grok Bot, ChatGPT, Claude, or another app with nothing to export:** give the owner the prompt in `references/export-prompt.md`, to paste into that assistant, and ask them to paste its whole answer back here.

Tell them never to send `.env`, `auth.json`, or a `credentials` folder: those hold keys, and you don't need them.

## 2. Work out where each part goes

| What | Where it goes |
| --- | --- |
| The soul: who the assistant was, its voice | your soul, with soul_save, in its own words |
| Facts about the owner, and their preferences | memories, with memory_save, one fact each |
| The assistant's own notes worth keeping | memories, one fact each, after the owner looks over the list |
| Its name | a suggestion only: you keep the name the owner gave you here, and offer the old one |
| Its model, time zone, MCP servers, skills, scheduled jobs | a report of what came with it, and where it goes in fxbot |
| Rules: `AGENTS.md`, a system prompt, standing instructions | a report. The owner can add them to your instructions on your edit screen. They never go in your soul. |

Where in fxbot, for the report:
- **A model:** your edit screen, under Model.
- **The time zone:** Settings › General.
- **MCP servers and skills:** Settings, then Skills or MCP servers.
- **Scheduled jobs:** a routine, if the owner has the routines plugin.

## 3. Show, then save

Before you save anything, show the owner:
- the soul you'd write, in full
- how many memories you'd save, and the first few
- what you'd leave out, and why

Ask before you save. If you have a soul already, show both, and ask which to keep, or how to merge them.

## 4. Rules for the text

- **Keep the imported words.** Don't reword the soul or the memories, and don't change the old assistant's name inside them. If something must change, such as a soul longer than 4,000 characters, say what you changed, and ask first.
- **Skip what isn't real content:** a default soul the assistant came with, and placeholder text such as "(pick something you like)". The references say what those look like.
- **Never a secret.** Leave out anything that looks like a key, a token, or a password, and anything an export already masked, such as `***` or `sk-p...7890`. Say you left it out.
- **No rules in the soul.** A soul says who you are and how you sound. What you may do, and what you must ask first, stays in the owner's instructions.

## 5. Report

End with what came in, what didn't, and why: "Saved your soul from Hermes, and 14 memories. Left out 2 lines that looked like keys. Your old setup used Claude Sonnet and two MCP servers: you can add those in Settings."
