# An OpenClaw agent

OpenClaw keeps an agent in a workspace folder, usually `~/.openclaw/workspace/`. Older installs used `~/.clawdbot` or `~/.moltbot`.

## What to read

| File | What's in it | Where it goes |
| --- | --- | --- |
| `SOUL.md` | The agent's voice, tone, and opinions | your soul |
| `IDENTITY.md` | Lines such as `- Name:`, `- Creature:`, `- Vibe:`, `- Theme:`, and `- Emoji:` | the creature and vibe can join the soul, if the owner agrees. The name is a suggestion. Skip placeholder text in parentheses, such as "(pick something you like)". |
| `USER.md` | Rules about the owner, each starting `Always`, `Never`, or `Prefer` | memories, one rule each, in its own words |
| `MEMORY.md` | Lasting facts and decisions | memories, one fact each, after the owner looks over the list |

`memory/` holds daily notes, one file a day. Ask before reading them: they're many, and most matter only on their day.

`AGENTS.md` holds operating rules. Put it in the report, never in the soul. `BOOTSTRAP.md`, `HEARTBEAT.md`, `BOOT.md`, and `TOOLS.md` are OpenClaw's own: skip them, and say so.

## What never to read

`~/.openclaw/.env`, `credentials/`, `auth-profiles.json`, `identity/`, `devices/`, and any `.sqlite` file. If the owner sends one, don't use what's in it.

## The name

OpenClaw can keep an agent's name in three places: `IDENTITY.md`, its settings file, and the soul's own words. You keep the name the owner gave you here. Mention the old one, and leave the soul's words as they are unless the owner asks.
