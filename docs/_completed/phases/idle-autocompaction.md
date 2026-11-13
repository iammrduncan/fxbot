# Idle compaction

When a bot's chat has sat idle for a while, fxbot compacts it, so the owner's next message starts fast:
- **After 30 minutes with no message,** by default, fxbot summarizes a long chat and starts it afresh from that summary, with the last few messages word for word. The bot goes on as before. Its next request is the summary, not the whole chat, so it doesn't wait for the provider to read everything again.
- **The chat says so.** A card at the top of the compacted chat reads **Compacted while idle**, and opens to the summary. The messages before it stay above it, and the bot can still search them.
- **The owner chooses.** **Settings** › **General** has **Idle compaction**: off, or after 15 minutes, 30, an hour, or 2 hours. Beside it is the model that writes the summary: the bot's own, or a cheaper one the owner picks.
- **Only when it's worth it.** A short chat isn't compacted, a chat is compacted once per idle spell, and a message that comes in while the summary is being written goes ahead without it.

Status: built on 2026-11-12, for 0.10.0, as planned the same day at the owner's word, with the open questions' recommendations: each bot's own model by default, 120 KB of checkpoint, one setting in **Settings** › **General**, on at 30 minutes, and the comment for libfx written for the owner to post. Where the build differs from the plan, [What the build changed](#what-the-build-changed) says so. Researched the same day:
- against libfx 0.0.16 as installed, and fx's source at `v0.0.16` and `8352e0c`
- against Claude Code, Hermes Agent, OpenClaw, Pi, Codex, and eve, from source and changelogs at the commits in [Research](#1-research)
- against the providers' documentation on how long their prompt caches last

## What the owner asked

"Auto compaction. After sitting idle for a while a bot should auto compact (note it in the chat it auto compacted). That way when someone comes back after a while and sends a message it doesn't have to prefill the current context back into the api and recache it etc which can take a long time. This is a core functionality, configurable by toggle, timeout and in settings etc. Default should probably be 30 minutes or something. You can set the model you want to use for timeout like luna or haiku or something cheap or use same model as main bot." (2026-11-12)

## 0. Core or plugin

**Core,** as the owner said. "Context that fits the model" is one of the things every bot needs ([Core or plugin](../../../CONVENTIONS.md#core-or-plugin)), and this is the context's size over time. It's built on what core already has:
- `startOver`, which summarizes a chat and starts it again from the summary (`packages/sdk/src/index.ts:587`)
- the page's card for a chat that started over
- the settings row

The [context management](../../phases/context-management.md) stub, compaction as a chat nears its model's window, stays a phase of its own. It will use the same pieces.

Nothing changes in the plugin API. A plugin's sessions aren't compacted here ([Not in this phase](#not-in-this-phase)).

## 1. Research

### fxbot today

- **`startOver` is fxbot's own compaction** (`packages/sdk/src/index.ts:583-615`). It works in four steps:
  1. It cancels a running turn.
  2. It summarizes the chat with `summarize()`, a tool-free request (`packages/sdk/src/history.ts:185-204`): from the session's libfx checkpoint, in a throwaway engine on the chat's provider, or else from the stored transcript.
  3. It makes a new session, and saves the summary as the bot's `handoff`.
  4. It moves every open stream of the chat to the new session.

  The handoff goes in the bot's instructions on every open, with "Search earlier messages with chat_history." (`index.ts:288-290`). A provider switch uses it, and so does fresh's `{ startOver: { ask } }` (`index.ts:701-720`).
- **While it runs, the chat is held** (`hold`, `index.ts:576`): a message sent meanwhile waits for it. Fresh found a summary takes 10 to 60 seconds ([fresh](fresh.md#0-core-or-plugin)).
- **The page shows the handoff** as a folded card at the top of the new chat, **Started over** or **Continued from** a provider (`Handoff`, `packages/ui/src/app.tsx:1086`).
- **Core already sweeps on a timer:** every 30 seconds for turns stuck on a refusing provider (`index.ts:413`). The catalog and the registry are read hourly.
- **What's running is known:** `withBusy` marks a bot `busy` while a turn runs and `waiting` while it waits on the owner (`index.ts:118`).
- **No token counts are stored.** A turn's `turn_end` carries libfx's usage, but fxbot doesn't keep it. So fxbot doesn't know how big a chat's context is. A session's checkpoint, read without changing it, is the nearest measure.
- **Settings** are one row (`packages/sdk/src/store.ts:86`), shown in **Settings** › **General**, as **Turns at once** is (`packages/ui/src/settings.tsx:93-101`).

### libfx

From the installed 0.0.16 and fx's source. The compactor's code is the same at `v0.0.16` and at `8352e0c`.
- **A host can't compact a session.** `FxSession` has `prompt`, `resume`, `stream`, `steer`, `cancel`, and `checkpoint`, and no compaction. Its options are `context`, `model`, and `instructions` (`types/libfx.d.cts:758-766`, `:865-889`).
  - **Only the CLI has one:** `/compact` is the fx CLI's (`src/core/app/app_agent_runtime.zig:1255-1330`), and ACP offers no method for it (`src/acp/server.zig:69-116`).
- **It compacts by itself only inside a turn,** just before a model request reaches 80% of the model's usable input, or after the provider says it's too long (`src/core/agent/runtime/orchestrator.zig:8198`, `src/core/compactor/settings.zig:6-10`). For a libfx host, the 80% is fixed (`src/core/app/app_lifecycle.zig:575-597`). So a long chat compacts at the start of the owner's next message, and the owner waits for it.
- **It summarizes with the chat's own model,** "with the least reasoning it accepts" (`compactor/model.zig:1-3`). Mid-turn, the request goes after the conversation, so the provider reads it from its cache (`orchestrator.zig:8266-8270`). A host can't pick another model.
- **It keeps more, word for word.** "Every turn a compaction adds keeps its user messages and its final reply word for word", and the newest four turns stay whole, reasoning and all (`compactor/summarize.zig:9-15`, `compactor/window.zig:21-27`). A chat of long messages shrinks little.
- **It tells the host nothing.** No stream line says a compaction happened. Only libfx's hooks show a model call whose `purpose` is `"compaction"` (`libfx.d.cts:390-408`), and fxbot passes no hooks.
- **A checkpoint loads under another model,** with a `checkpoint.mismatch` event (`README.md:133`). That's how `summarize()` can run a cheaper model of the same provider on a chat's checkpoint.
- **Keeping Claude's cache warm** (fx #1575: a one-token request every 4.5 minutes, for up to 30 minutes) was merged after 0.0.16. It's off for libfx hosts in source: "a libfx host owns its sessions' lifetimes, so its kernel sends no requests of its own" (`src/acp/prompt.zig:1926-1932`).
- **Upstream:** no issue or pull request asks for a compaction call for hosts. The smallest one is `session.compact({ model? })`: the manual path exists, and it can already call another model (`src/core/agent/runtime/text_completion.zig:206-210`).

### Other assistants

| | Compacts when idle | How it's set | How it says so |
| --- | --- | --- | --- |
| **Claude Code** | Yes, by default since 2.1.299: "a 200K+ token conversation left idle for about 54 minutes is compacted before its one-hour prompt cache expires" | `"idleCompaction": false`, and a token threshold, 200,000 by default | "Compacted while idle, before the prompt cache expired" |
| **Hermes Agent** | Opt-in: `compression.idle_compact_after_seconds`, default 0, "Example: … 1800 compacts after 30 minutes idle". It runs when the next message arrives, so the person waits | A separate summary model, `auxiliary.compression` | "💤 Resumed after {idle_seconds}s idle — compacting ~{tokens:,} tokens before continuing." |
| **OpenClaw** | No. A timer was merged (#178021) and reverted 4 minutes later (#178425) | `compaction.model`. Session resets are off by default since 2026.8.1 | "🧹 Compaction complete", off by default |
| **Pi** | No: it keeps the cache warm, only when that's expected to save $0.05 or more (`packages/ai/src/cache-warming.ts:30-49`) | | "Compacted from N tokens" |
| **Codex** | No | | "Context compacted · {elapsed}" |
| **eve** | No: it offers a 1-hour cache instead | `compaction.model` | `context.settled` events |

Sources: Claude Code's [changelog](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md) and [settings reference](https://code.claude.com/docs/en/settings-reference.md), read 2026-11-12. Hermes Agent at `e7212db` (`website/docs/user-guide/configuration.md:1132`, `agent/conversation_compression.py:112-114`). OpenClaw at `56eb6f3`, Pi at `d78a75e`, Codex at `c0cc9fc`, and eve at `746a741`.

**What went wrong for them:**
- **Context lost, with no notice and no way out.**
  - Claude Code #98747: "7 of those sessions were compacted while idle. None was close to the context limit … my exact instructions, the reasoning behind decisions, and the methods we'd agreed on were gone." A setting followed in 2.1.290.
  - #102260: it was turned on "with no notice or opt-in".
  - #102666: it fired while the model "had just presented a decision and was waiting for the user's answer".
- **Never firing, firing again, and firing in a loop.**
  - Hermes #79357: the gateway reset the time the idle check read, so it never fired.
  - Hermes #97239: it summarized an unchanged chat on every resume. The fix: the transcript "must gain a floor's worth of NEW content first".
  - Hermes #143897: it ran 64 times in a day during a provider outage.
- **A summary taken as a task.** Hermes's summary now says "If no user message appears AFTER this summary, do nothing: do not resume, wrap up, or continue work" (`agent/context_compressor.py:259-281`), after models resumed stale tasks (#80622, #41607).
- **A summary model too small.** Hermes: "The summary model **must** have a context window at least as large as your main agent model's … the middle turns are **dropped without a summary**" (`configuration.md:1195-1197`).
- **A failed summary must change nothing.** eve: "the session keeps its previous history". Pi: "A length stop contains partial text and must not become a session checkpoint." (`compaction.ts:581-593`)

### Prompt caches

From each provider's docs, read 2026-11-12:

| Provider | How long a cached prompt lasts |
| --- | --- |
| Anthropic | 5 minutes, renewed by each read; 1 hour at twice the write price |
| OpenAI, GPT-5.6 and later | 30 minutes at least |
| Kimi | 5 minutes, renewed by each read |
| DeepSeek | "a few hours to a few days" |
| Gemini, xAI | not documented ("Cache entries can be evicted at any time", xAI) |
| Ollama, llama.cpp, and other local servers | as long as the server keeps it |

- **A cached prompt starts much faster only when it's long:** Anthropic measured 11.5 seconds uncached against 2.4 seconds cached for 100,000 tokens. OpenAI says 67% faster at 150,000 tokens and more, and 7% at 1,024. These are the providers' own figures, and old.
- **So at 30 minutes, Anthropic's and Kimi's caches are already gone.** The summary request reads the whole chat uncached, whichever model writes it. What compaction buys is the owner's next message, which reads only the summary, and every turn after it, which is shorter.

## 2. Key takeaways

1. **fxbot does it itself, with `startOver`.** libfx can't compact on request, compacts only mid-turn, and can't use a cheaper model. `startOver` runs now, on any model fxbot can reach, and the page already shows its card.
2. **The owner's wait moves to an idle moment.** libfx would compact at the start of the owner's next message. Compacting while they're away is the only way to keep that wait off it.
3. **Keep the last words.** libfx keeps user messages and replies word for word, and Claude Code's users lost "my exact instructions". The handoff carries the summary and then the last few messages as they were.
4. **A cheaper model must hold the chat.** It never reads the bot's cache, so it pays a full read at its own low rate, and its window must take the whole chat, or Hermes's middle turns get dropped. When it can't, the bot's own model writes the summary, as it does by default.
5. **Gates, so it runs only when it helps.**
   - **Big enough:** a short chat starts fast anyway, which is why Claude Code waits for 200,000 tokens.
   - **Grown since:** never compact an unchanged chat, after Hermes #97239.
   - **Once per idle spell, with no retry after a failure,** after Hermes #143897.
   - **Never while busy:** not while a turn runs, or while the bot waits on the owner, after Claude Code #102666.
6. **The owner's message wins.** A message that arrives while the summary is being written cancels it, and goes to the chat as it was, as OpenClaw's reverted design did. Fresh's way, holding the message until the summary is done, would make the owner wait for exactly what this saves.
7. **Say so, and let it be turned off.** Claude Code's complaints were about no notice and no way out. The card says what happened, and **Settings** has **Off**.
8. **The summary is for reference.** It goes in the instructions, never as a message, and says not to act on it alone, as Hermes's does.
9. **30 minutes is a fine default, and not a cache trick.** fxbot's summary request is tool-free, so it can't read the bot's cache however soon it runs. Compacting just before a cache expires, as Claude Code does, would need libfx's own call. One setting serves every provider. An owner on DeepSeek, whose cache lasts hours, can turn it off.

## 3. Implementation

### The settings

A migration, at the next free number, adds to `settings`:

```sql
-- Idle compaction: minutes a bot's own chat is idle before it's compacted (0 is off), and the model that writes the
-- summary, when it isn't the bot's own.
alter table settings add column idle_compact_minutes int not null default 30
    check (idle_compact_minutes = 0 or idle_compact_minutes between 5 and 1440),
  add column compact_provider text references providers on delete set null,
  add column compact_model text not null default '';
```

- `idleCompactMinutes`, `compactProvider`, and `compactModel` go through the settings calls, the server, and the client, as `turnsAtOnce` does.
- **The page:** **Settings** › **General** gets a row:

  ```text
  Idle compaction    [ After 30 minutes ▾ ]    Off · 15 minutes · 30 minutes · 1 hour · 2 hours
  Summarize with     [ Each bot's own model ▾ ]   or a provider's model
  A long chat that sits idle is summarized, so your next message starts fast.
  ```

  A provider removed from Settings sets the model back to **Each bot's own model**, by the foreign key.

### The sweep

A core timer, every minute, unref'd like the stuck-turn sweep. For each bot, it compacts the bot's own chat when all of these hold:
1. **Idle compaction is on.**
2. **Idle long enough:** the newest message in the bot's own session is older than the setting, from `messages`, by `profile_id` and `session_id`. Only that session counts. A room, a routine's run, or a subagent doesn't reset the clock, and doesn't get compacted.
3. **Not busy and not waiting** (`withBusy`), and no start-over running for it (`moving`).
4. **Not tried this spell.** An in-memory map holds the newest message id the bot was last tried at. A failure isn't tried again until a new message arrives. After a restart, a chat may be tried once more.
5. **Big enough.** The session's checkpoint is at least 120 KB, about 30,000 tokens at 4 characters a token. That's an estimate that runs high, since a checkpoint carries its own structure. Reading it doesn't change the session.

The sweep compacts one bot at a time, so a morning of idle bots doesn't send a burst of requests.

### Compacting

`startOver` gains two options:
- `using: { provider, model }`, the model that writes the summary, when it isn't the chat's own
- `signal`, which cancels the summary

**Which model.** With **Each bot's own model**, it's the bot's provider and model, from the checkpoint, as now. With a model the owner picked:
- **On the bot's provider:** that model summarizes the checkpoint, which loads under another model.
- **On another provider:** that model summarizes the stored transcript, as a provider switch does when the old provider can't.
- **When its context window is known and smaller than the chat's estimate,** the bot's own model writes the summary instead, and fxbot's log says why.

**The ask** (`idleAsk`, in `history.ts`, beside `switchAsk`):

> Write a summary of this conversation so far, for yourself, to carry on after a break. Keep the user's requests and instructions in their own words, then what was decided and why, facts about the user and their work, and each open task and where it stands. At most 1,500 words.

**The handoff:**

```text
Earlier conversation, summarized after 30 minutes idle:

(the summary)

The last messages, word for word:
Owner: …
Bot: …

This summary is for reference. Don't act on it by itself: answer the next message.
```

- **The last messages** are the newest exchanges in `messages`, owner's and bot's, up to 6,000 characters, as `history.transcript` reads them.
- **The handoff's heading** is "Earlier conversation, summarized after {n} minutes idle". The page's `Handoff` reads it, and its card says **Compacted while idle**, with the summary folded.

**A message during the summary.**
- The sweep keeps an `AbortController` for each bot it's compacting.
- A send to that bot's own chat aborts it before it waits on `hold`, and the message goes to the chat as it was.
- An aborted or failed summary changes nothing. The session, the handoff, and the streams stay as they were.

**Fresh and the provider switch** keep holding their messages, as now: the owner asked for those.

### What the owner sees

- **The card,** at the top of the compacted chat, folded:

  ```text
  ▸ Compacted while idle · turn off in Settings
    (opens to the summary and the last messages)
  ```

  **Settings** links to **Settings** › **General**.

- **The earlier messages** stay above it, as after a provider switch, and `chat_history` searches them.
- **The bot's next turn** reads its instructions, its memories, and the handoff. It's a fresh request, at the price of a short prompt.

### Docs

- **`explanation/bots-and-chats.md`:** idle compaction, what's kept, and the card.
- **`reference/configuration.mdx`,** or the settings reference: the two settings and their defaults.
- **The SDK reference** for the new settings fields, and `## Unreleased`, with the migration.

### Upstream

Comments for the owner to post on vercel-labs/fx, since this shell can't post to GitHub:
- **`session.compact({ model? })`**, which runs libfx's own compactor between turns, the manual path the CLI has, and a stream line when it compacts. With it, idle compaction keeps libfx's fuller notes, and could run just before a cache expires, on the bot's own model, reading the cache.

### Not in this phase

- **Compaction near the model's window,** in [context management](../../phases/context-management.md). Showing libfx's own compactions in the chat, through its hooks, belongs there too.
- **A plugin's sessions,** such as rooms: a plugin would need a start-over of its own session in the plugin API.
- **A setting for each bot.** One setting serves every bot ([Question 3](#5-open-questions)).
- **Keeping the cache warm,** as Pi and fx do. It pays only for returns within minutes, and libfx sends no requests of its own.
- **A turn that saves memories before compacting,** as OpenClaw's memory flush does. It would read the whole chat on the bot's own model, which is the cost this avoids. Dreams already tidies memories each night.
- **Counting tokens.** Storing `turn_end`'s usage would measure a chat's size exactly, but whether it's one request's or the turn's sum isn't documented.

### Size

| Where | Lines, about |
| --- | --- |
| Migration, settings, server, client | 30 |
| The sweep, the gates, and the abort | 70 |
| `startOver`'s `using` and `signal`, `idleAsk`, the last messages | 40 |
| The page: the settings row and the card's label | 40 |
| Docs | 60 |

## 4. Checklist

Against a disposable fxbot and a mock model that logs each request and can answer slowly, with the idle time set to 5 minutes, or the sweep's clock moved, for the checks:
- [x] The migration runs on a copy of a 0.9.0 database. **Settings** › **General** shows **Idle compaction**, after 30 minutes, and **Each bot's own model**.
- [x] A bot whose chat's checkpoint is over 120 KB, idle past the setting, is compacted once. The mock gets one summary request. The bot's `handoff` starts "Earlier conversation, summarized after", and the chat's top card reads **Compacted while idle**. The bot's next turn sends the handoff, not the old chat.
- [x] The handoff ends with the last messages word for word, within 6,000 characters, and the line about reference.
- [x] A chat under 120 KB, a bot whose turn is running, and a bot waiting on the owner aren't compacted. A compacted chat with no new message isn't compacted again.
- [x] Activity in a room, a routine, or a subagent doesn't count as the bot's chat being active, and doesn't get those sessions compacted.
- [x] A summary that fails isn't tried again until a new message arrives, and the chat is as it was.
- [x] A message sent while the summary is being written cancels it. The message goes to the old chat at once, and there's no card.
- [x] With a model picked on the bot's provider, that model writes the summary from the checkpoint. With one on another provider, it writes it from the transcript. With one whose window is smaller than the chat, the bot's own model writes it, and the log says why.
- [x] Two bots idle at once are compacted one after the other.
- [x] **Off** stops it. Removing the picked model's provider sets **Summarize with** back to each bot's own.

The rest:
- [x] Docs as above, `npm run typecheck`, `npm run build`, `npm run build-site`, and `git diff --check`.
- [x] The upstream comment is written for the owner to post.

Only a person can check, with a real model:
- [ ] A long chat with a real model, compacted while idle: the next message answers fast, and the bot knows what was going on.

## 5. Open questions

1. **Which model by default?** Recommended: each bot's own. Its window holds the chat, and its summary is its best. The owner picks a cheaper one in Settings to save money.
2. **How big must a chat be?** Recommended: 120 KB of checkpoint, about 30,000 tokens. Below that, a fresh read is quick, and a summary loses more than it saves. Claude Code waits for 200,000 tokens, but only for its hour-long cache.
3. **One setting, or one per bot?** Recommended: one, in **Settings** › **General**. Add a bot's own when one needs it.
4. **Default on, at 30 minutes?** The owner suggested it. Claude Code's users objected to compaction they didn't know about. The card, and **Off** beside the setting, answer that. Recommended: on, at 30 minutes, with the card saying where to turn it off.
5. **Ask libfx for `session.compact`?** Recommended: yes. Hand the owner the comment to post.

## What the build changed

- **`startOver` is as it was, and ends in `restart`.** The plan gave `startOver` a `using` and a `signal`, but its fallbacks are a provider switch's. Idle compaction writes its own summary with `summarize`, which gained `signal`, then calls `restart`, the step that begins the chat again, which `startOver` now ends with too.
- **The hold comes first.** The sweep takes the bot's start-over hold before it reads the checkpoint, and reads the bot again under it, so a message that came meanwhile runs, and a message after that calls the summary off. A provider switch calls it off too.
- **What counts as activity** is any row in the bot's own session, its thinking and tool steps too. The routines plugin passes a run's result into the bot's own chat, so that counts, as the owner sees it there. The run's own session doesn't.
- **The last messages say who:** **Owner**, a plugin's message under the plugin's name, such as `routines`, and the bot's own as **You**. A newest message longer than 6,000 characters keeps its last 6,000, after "…".
- **Summarize with picks a provider, then Model.** Picking a provider takes its default model, and **Model**, the app's model picker, changes it. The API does the same: `compactProvider` without `compactModel` takes the provider's default, and fails when the provider has none.
- **The page offers Off, 15, 30, 60, and 120 minutes.** A time set through the API, from 5 to 1,440, shows as itself, such as "After 45 minutes".
- **The card's link sits beside its title,** **Turn off in Settings**, since a link can't be inside the button that opens the card. It opens **Settings** › **General**.
- **An empty summary fails.** libfx ends a turn that has no text with "Done.", which `summarize` took as a summary: a check's empty answer compacted a chat into "Done.". It now counts as empty, for a provider switch and `/fresh` too, and the changelog says so.
- **The sweep starts a minute after fxbot does,** and takes the longest-idle chat first. A summary that hangs holds the sweep for up to its 2 minutes, then the next bot goes. After a restart, a chat may be tried once more, as planned.
- **The docs:** an **Idle compaction** section in the explanation, under **Starting a chat over**, and the three settings in the SDK's settings table and the HTTP API's list. `reference/configuration.mdx` lists environment variables, not settings, so it's unchanged.
- **The checks,** against a disposable fxbot, the mock model, and messages backdated past the 5 minutes set for them:
  - **The upgrade:** a database made by 0.9.0's code, at `8c81170`, with a bot that had chatted, migrated with a backup first, and read 30 minutes and each bot's own model.
  - **The checklist, 52 checks over three runs, 45 passed:**
    - **One sweep:** four chats compacted, and a short one, one with a turn running, and one waiting on the owner left alone.
    - **The handoff:** its heading, its last messages, and its line about reference. The next turn sent 1,481 characters, not the old chat.
    - **Gus's chat** compacted just after a routine's run and a room, whose sessions stayed. A subagent's session is a plugin's session as theirs are, and wasn't run here.
    - **Two summaries of 4 seconds each,** 4,028 ms apart, and none again for an unchanged chat.
    - **A message during a summary** went to the old chat in 42 ms, with no card.
    - **A refused summary and an empty one** changed nothing, and the refused one wasn't tried again until a new message.
    - **The models:** a model on the bot's provider read the checkpoint, one on another provider the transcript, and one with too small a window gave way to the bot's own, with the log line. **Off**, a removed provider, and the edges of the setting.
  - **The other 7 failed from their setup:** an empty reply and a failed turn didn't make a summary fail, since libfx answers "Done." and leaves a failed turn out of its history; a bot kept busy with a slow command was compacted once its turn stopped, and its slow summary held the sweep; and a chat whose newest message was short didn't test the long-message case. Each case was checked again on its own, as above.
  - **The page, 15, in Chromium,** at desktop and phone sizes: the setting's choices and what each saves, **Model** after a provider, and the card, its link, and what it opens to. No page errors.

- **Fixed before the release,** from the release review:
  - **A chat's length is its text, not its checkpoint.** A checkpoint carries its images' bytes, so a short chat with one photo or a few screenshots counted as long, and was compacted after 30 minutes. The sweep now adds up the text history keeps for the session, thinking and tool steps too, and the documents the owner sent in it, a PDF as the 60,000 characters its message carried. Against the mock: a chat with a 2 MiB photo and 47 bytes of text wasn't compacted, one of 135 KB of text was, and one of a few words, a long PDF, and a 70 KB text file was, at 129 KB.
  - **The summary goes only to the bot's own chat.** `open()` put the bot's handoff in every session's instructions, a room's, a routine run's, and a subagent's too, since provider switches made handoffs. Idle compaction makes them common, so each room got a summary of the bot's private chat, and read its whole context again whenever it changed. Against the mock, after a handoff: the bot's own chat sent it, and its room session sent its instructions without it.
  - **Summarize with, on a provider with no default model,** waits on the page for its model, then saves both together. It saved the provider alone, which the server refuses, and the **Model** picker that the error asked for only showed after a save that worked. A save that works now clears an earlier error in Settings. Checked in Chromium.
### Upstream

For the owner to post on vercel-labs/fx, as a new issue:

> **Hosts can't compact a session between turns: could `FxSession` get `compact({ model? })`?**
>
> fxbot runs libfx as a host, one long session per bot. When a long chat sits idle, we compact it, so the owner's next message doesn't wait for the provider to read the whole context again. libfx 0.0.16 compacts only inside a turn, near 80% of the model's usable input, and the CLI's `/compact` isn't reachable from `FxSession` or ACP. So we send a separate tool-free summary request and start a new session from it. That loses what libfx's compactor keeps: the user messages and final replies word for word, and the newest turns whole.
>
> What would let a host do it with libfx's own compactor:
> - `session.compact({ model? })` on `FxSession`, between turns, rejecting while a turn runs, on the same path as the CLI's manual compaction.
> - `model`, to summarize with a cheaper model of the same provider, as the compactor's text completion can already call another model.
> - A stream line, or a hook event, whenever a session compacts, automatic or manual, so the host can show it in the chat.
>
> With these, a host could also compact just before a provider's prompt cache expires, on the bot's own model, reading the cached prefix.
