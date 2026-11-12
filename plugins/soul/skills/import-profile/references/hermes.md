# A Hermes Agent profile

A Hermes Agent profile is a folder: `~/.hermes` for the default one, or `~/.hermes/profiles/<name>/`. `hermes profile export` packs one into a `.tar.gz` with a single folder inside.

## What to read

| File | What's in it | Where it goes |
| --- | --- | --- |
| `SOUL.md` | The persona, first in Hermes's system prompt | your soul. Skip it when it's Hermes's own default: it starts "You are Hermes Agent, built by Nous Research." |
| `profile.yaml` | `display_name`, `description`, and under `ui_meta.hermes-bots`, a `title` and an `avatar` | the name and title are suggestions. The description can help you understand the soul. |
| `memories/USER.md` | Facts about the owner, as entries separated by a line holding only `§` | memories, one entry each |
| `memories/MEMORY.md` | The assistant's own notes, entries separated the same way | memories, one entry each, after the owner looks over the list |
| `config.yaml` | `model`, `timezone`, `mcp_servers`, and `agent.personalities` with `display.personality`, the overlay in use | the report. An active personality's text can join the soul, if the owner agrees. |

The default profile can also have `USER.md` and `MEMORY.md` at its top, and `AGENTS.md` or `system_prompt.md`. Those last two are rules: put them in the report, never in the soul.

## What never to read

`.env`, `auth.json`, `mcp-tokens/`, `vault/`, `platforms/`, `honcho.json`, `mem0.json`, `state.db`, `sessions/`, and `logs/`. If the owner sends one, don't use what's in it, and tell them it held keys or history you don't need.

An export masks what looks like a key, as `***` or a shortened form such as `sk-p...7890`. Treat those as secrets too, and leave them out.

## Entries

An entry in `MEMORY.md` or `USER.md` is a few lines between `§` separators. Hermes keeps them short, so most are one fact already. One that holds several facts becomes several memories, each in the entry's own words.
