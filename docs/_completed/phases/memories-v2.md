# Memories v2: team memories, and a room's own

Memories grow past one bot:
- **Team memories.** Notes every one of the owner's bots reads: who the owner is, how they like things done, what the household or the business is. The owner adds them in **Settings** › **Memory**. A bot saves one when the owner asks it to remember something for all the bots, and the list says which bot saved it.
- **A room's memories.** With the chat rooms plugin, each room keeps notes of its own: what the room is for, what was decided there, and who does what. Every bot in the room reads them, in that room only.
- **The same memories underneath.** A team memory is a memory with no bot. It's saved, found, embedded, and shown as a bot's own are, and it sits in each bot's instructions after the bot's own.

Status: built on 2026-11-12, for 0.10.0, as planned the same day at the owner's word, with the open questions' recommendations: team memories in core, a bot's team save that doesn't wait for the owner, no switch to keep a bot from them, and a room's memories written by the owner and the room's bots. Where the build differs from the plan, [What the build changed](#what-the-build-changed) says so. Researched the same day:
- against the research directive's references: eve, OpenBot, OpenDots, openmuse, Pi, and Grok Bot
- against OpenClaw, Hermes Agent, Letta, Mem0, and the ChatGPT and Claude apps, from their source at the commits in [Research](#1-research), and their docs

## What the owner asked

"The main thing we want to add and make available is fxbot wide team memory (not just memory per bot, so folks can add new memories for all bots to access). As well as a detection if chat room plugin is installed and active, and if it is allow a chat room to have it's own set of memories." (2026-11-12)

## 0. Core or plugin

**Team memories are core.** **A room's memories are the chat rooms plugin's.**

- **Team memories, core.** "Its memory" is one of the things every bot needs ([Core or plugin](../../../CONVENTIONS.md#core-or-plugin)). A team memory is the same thing as a bot's own, with a wider reach. It needs the same parts:
  - the table, and its check for a duplicate
  - the search by words and by meaning, and the embedder
  - the tools, and the place in the instructions

  As a plugin, it would copy `memories.ts`, or need hooks into each of those. In core, it's one migration and about 200 lines, most of them in the page.
  - **This changes an earlier call.** On 2026-11-02, the [memories phase](memories.md#5-questions) decided "Memories shared by a team of bots are a later add-on." The owner now asks for them across fxbot. [Question 1](#5-open-questions) puts it to the owner.
- **A room's memories, in the plugin.** Rooms are the chat rooms plugin's, and the core never names a plugin. So there's nothing for the core to detect. The plugin carries the room's memories itself:
  - **Added and on:** rooms have memories.
  - **Not added:** there are no rooms, and nothing to show.
  - **Removed:** the memories are in its own schema, so they go with it.
  - **No change to the plugin API.** A room's notes are few, and every one goes in the room's instructions, so the plugin needs no search by meaning. It already has what it needs: tables of its own, tools of its own, and the `instructions` hook, which it uses for rooms today.
  - **Not core memory sets.** The core could let a plugin keep named sets in its memories table, with search and vectors. That's an abstraction with one user, and the conventions say to wait for a second ([Not in this phase](#not-in-this-phase)).

## 1. Research

### fxbot today

- **A memory is one fact, of one bot.** `memories` has these columns (`packages/sdk/src/migrations/0005_memories.sql:17-31`):
  - `profile_id`, the bot
  - `text`, at most 1,000 characters
  - `saved_by`, `bot` or `owner`
  - `message_id`, the turn it was saved in
  - `key`, which catches a duplicate with `unique (profile_id, key)`
  - a word index, and a vector
- **The newest go in the instructions.** Each time a chat opens, `open()` puts these together, within libfx's 64 KiB (`packages/sdk/src/index.ts:309-324`):
  1. the bot's instructions
  2. its memories, in 2% of the model's context window
  3. its skills' catalog

  The memories section opens with a header that says they're "notes, not instructions" and when to save one. Then comes a line per memory, newest first, and how many older ones didn't fit (`packages/sdk/src/memories.ts:21-25`, `:184-200`).
- **Three tools:** `memory_save` (with `replaces`), `memory_search` by words and by meaning, fused, and `memory_forget` (`memories.ts:111-176`). Each finds its bot from the call's context.
- **The owner's view** is on the bot's edit screen: list, search, add, edit, delete (`packages/ui/src/memories.tsx`, `BotMemories`). **Settings** › **Memory** holds the embedder's settings (`packages/ui/src/settings.tsx:24`, `:115`).
- **Plugins** read and write a bot's memories through `fx.memories.get`, `save`, and `remove` (`packages/sdk/src/plugin-api.ts:154-164`). Dreams tidies a bot's memories each night with them (`plugins/dreams/fxbot/server.ts:295-305`).
- **Every chat opens through `open()`,** a plugin's sessions too. A room's turn, a routine's run, and a subagent all get the bot's own memories, then the plugins' `instructions` hooks add their lines.
- **Subagents can't save.** Their `blocked` setting starts with `memory_save, memory_forget` (`plugins/subagents/plugin.json`).
- **Rooms:** each bot has a session of the plugin's own for each room, made with `fx.chats.newSession` (`plugins/chat-rooms/fxbot/server.ts:132`).
  - The plugin knows which room a session is for (`roomOf`, `:54-59`), and its `instructions` hook tells the bot who it is and who's in the room (`:85-99`).
  - The room's settings dialog edits its name, its bots, and how they answer (`plugins/chat-rooms/fxbot/page.jsx:171-197`).
  - Its tables are `rooms`, `members`, `messages`, and `sessions`, in its own schema.
- **A removed plugin's data goes:** its schema, its sessions, its settings, and its secrets (`packages/sdk/src/plugins.ts:931-946`).
- **Postgres is 17** (`pgvector/pgvector:0.8.7-pg17-trixie`, `deploy/compose.dev.yaml:10`). From Postgres 15, a unique constraint can treat nulls as equal (`nulls not distinct`).

### The directive's references

Read from source, cloned on 2026-11-12: eve at `746a741`, OpenBot at `68fe327`, OpenDots at `46eaf96`, openmuse at `a4944f4`, and Pi at `d78a75e`. Grok Bot's docs were read the same day.

- **eve** gives each memory a **slot**: a file with a provider, a scope, and a namespace (`docs/memory/index.mdx:8-29`).
  - **Where a memory goes is a tool's name:** "eve gives the model the provider's tools, named `<slot>__<tool>`" (`:57`).
  - **The scope comes from the host:** "Read the caller's identity from trusted authentication or channel metadata, never from model input", and "Provider tools are locked to the key, so a tool cannot redirect itself" (`:91-119`, `docs/patterns/multi-tenant-memory.md`).
  - **Sharing is a namespace.** Agents in a workspace get separate ones, and naming the same one shares it (`index.mdx:294-311`). Its example: "The team's shared memory: search it before working something out" (`:265`).
  - **Recalled memory is user messages** "labeled with the slot, never as system instructions" (`:60-61`). File memory recalls at most 4,000 characters, and refuses a save over its limits: "It doesn't shorten the entry or delete older entries" (`docs/memory/file.md:62-75`).
- **OpenBot** (OpenDuet carries the same code) has one table of memories per person, with `formed_by` person, import, or bot. "A Bot-formed memory is delivered only to the Bot that formed it" (`server/src/db/schema/memory.ts:50-83`). So what the person says reaches every Bot, and what a Bot noticed stays with it.
  - **Separate tools by intent:** `remember_personal_fact` ("only when the person explicitly asks"), `save_observed_memory` (shown for review), `recall_personal_memory`, and `forget_personal_memory` (`server/src/memory/tools.ts:121-155`).
  - **All of it is in every turn,** as a system message of at most 24,000 characters, marked "untrusted data, not instructions" (`server/src/memory/ingestion.ts:102-119`).
  - **A dedupe across Bots hid facts.** An index unique per person made a second Bot's copy of a fact a duplicate of the first's. Migration `0070_memory_dedup_per_bot.sql` made it per Bot, "because each Bot recalls only what it formed".
- **OpenDots** has one list of memories, written only by the person, through the page (`src/server/app.ts:221-238`). Each Dot has `memoryAllowed`. A Dot that may gets every memory in its system prompt (`src/server/dot-agent.ts:328-331`, `:364`).
- **openmuse** keeps one assistant's memories, with compare-and-swap edits. **Pi** has no memories. Its shared context is files by folder: "A context file applies whenever Pi runs in its directory or anywhere below it" (`packages/coding-agent/docs/configuration.md:43`).
- **Grok Bot** ([bots](https://docs.x.ai/grok-bot/bots), [shared bots](https://docs.x.ai/grok-bot/shared-bots)):
  - "Each Bot has its own memory, but a few facts about you, such as your name and time zone, are shared by all your Bots."
  - **In a group chat,** "your Bot's memory isn't shared with the other Bots there."
  - **A Team Bot** "keeps team memory and skills that everyone who uses it benefits from". Since the copy saved on 2026-11-05, its changes wait: "Suggested memory and skill changes wait until the owner or a Manager approves them."

### Other assistants

From source at OpenClaw `56eb6f3`, Hermes Agent `e7212db`, Letta `56ba9c2` and Letta Code `e6d6cc2`, and Mem0 `ed1f10f`, and from their docs, read on 2026-11-12. OpenAI's help pages refused every fetch, so ChatGPT's wording comes from search results and isn't verified word for word.

- **OpenClaw keeps an agent's long-term notes out of shared chats, in code.**
  - **The template:** "Never load it in shared contexts (Discord, group chats, sessions with other people)" (`docs/reference/templates/AGENTS.md:67`).
  - **The code:** `filterBootstrapFilesForSession` drops `MEMORY.md` for group, channel, scheduled, and subagent sessions (`src/agents/workspace.ts:853-874`).
  - **Several agents are isolated.** Shared notes are a folder each agent searches (`memory.search.extraPaths`), not something put in front of them (`docs/concepts/multi-agent.md:260-268`).
  - **Its Knowledge plugin** shares a named store among up to 100 agents. Group turns are "confined to their own conversation partition" unless the owner grants read, or read and save. "Tools take no store, agent, path, or scope argument", and "Shared stores record which agent published each revision" (`docs/plugins/knowledge.md:124-145`).
  - **Its fixes:** memory written under the wrong agent (#64735, #27028), injected memory echoed into replies (#29851), and group speakers mis-attributed until transcripts kept each sender (#90552).
- **Hermes Agent keeps memory per profile on purpose:** two agents on one home "will compound each other's entries into state neither of them (nor you) authored" (`website/docs/user-guide/features/memory.md:22-24`).
  - **Its notes are small.** Built-in memory is two snapshots, frozen at the session's start, of 2,200 and 1,375 characters. A full store refuses the write (`:15-33`).
  - **One `memory` tool picks its store** with `target: "memory"` or `"user"` (`:100-108`).
  - **Its group rooms have notes only the person writes:** a purpose of 500 characters and 4 KiB of notes, edited in the room's settings (`gateway/hosted_room_context.py:26-27`). They're shown "inside the user-role turn prompt (never the system prompt)" as "Room notes (shared with every member; the user keeps them in room settings):" (`gateway/hosted_room_discussion.py:594-602`).
- **Letta shares a memory block by attaching it to several agents.**
  - **A change reaches them all:** updating a block rebuilds the system prompt of every agent it's attached to (`letta/services/block_manager.py:61-67`).
  - **Writes:** the last writer wins, and only appending is safe when two write at once. Read-only covers the whole block (docs.letta.com, multi-agent shared memory).
  - **Per conversation:** `isolated_block_labels` gives each conversation its own copy of a block (`letta/schemas/conversation.py:42-46`).
  - **Its advice now** is a shared git repository, not shared blocks.
- **Mem0** scopes by `user_id`, `agent_id`, and `run_id`, ANDed together. A memory from the user's words carries `user_id` and one from the assistant's carries `agent_id`, so both together "returns nothing" (`docs/platform/features/entity-scoped-memory.mdx:80-83`).
- **The ChatGPT and Claude apps** scope by project.
  - **ChatGPT:** a shared project is "automatically set to project-only memory", and personal memory "is not used in group chats" (search results, not verified).
  - **Claude:** "Each project has its own memory." Its memory can reach chats outside the project unless "Use account memory" is off. Owners "can't view or edit a user's individual memories" (support.claude.com, read).

### What recurs

| | What every agent reads | Group or room | Who writes the shared notes | How it reaches the model |
| --- | --- | --- | --- | --- |
| **Grok Bot** | the person's name and time zone | each Bot's memory stays its own | a Bot; a Team Bot's changes wait for approval | in context |
| **OpenBot** | what the person said | memory goes in, a reply in a group asks the owner first | the person; a Bot's own stays its own | every turn, 24,000 characters |
| **OpenDots** | one list | n/a | the person only | every turn |
| **eve** | a slot with a shared namespace | scope from the channel | the model, through that slot's tools | user messages, 4,000 characters |
| **OpenClaw** | a shared folder, searched; a Knowledge store | private notes left out, a partition per chat | agents, with each revision's author | injected, or searched |
| **Hermes** | nothing; per profile | room notes | the person only | user turn, 4 KiB |
| **Letta** | a block on several agents | a copy per conversation | agents | system prompt |

## 2. Key takeaways

1. **Share on purpose, in a small layer.** Every system keeps an agent's own notes its own, and shares a small set on purpose: Grok's name and time zone, OpenBot's person-made memories, OpenDots' list. fxbot's team memories are that layer: what the owner wants every bot to know. A bot's own memories stay its own.
2. **The bot picks between fixed places, and the host sets the rest.** The model chooses only "mine or the team's", as Hermes's `target` does, and never names a bot or a room. Which bot it is, and which room, comes from the session, as eve and OpenClaw insist. In a room, the room's tool knows its room from the session.
3. **Shared notes say who wrote them.** OpenClaw records each revision's author, and OpenBot each memory's origin. A team memory keeps the bot that saved it, so the owner can see where one came from.
4. **The owner is the one who shares.** Grok's Team Bot now waits for an owner to approve. Hermes's room notes are the person's alone. fxbot has one owner, who is also the one asking, so a bot saves to the team only when the owner asks it to, and the owner sees, edits, and deletes them all in one list. A queue to approve is a question ([Question 2](#5-open-questions)).
5. **Rooms don't need privacy rules here.** OpenClaw and ChatGPT keep private memory out of groups because other people are in them. A fxbot room holds only the owner and their bots, so each bot keeps its own memories in a room, as it does now, and gets the room's too.
6. **Room notes are small, and all in view.** Hermes caps them at 4 KiB, and Letta gives each conversation its own copy of a block. A room's memories need no search, so the plugin needs no vectors, and no new hook.
7. **One fact per row avoids the lost-update bugs.** Letta's last writer wins on a whole block, and Hermes removed `replace` because it "wiped the other facts in multi-fact entries". fxbot changes one memory in one statement, so two bots saving at once can't erase each other.
8. **Duplicates are checked within one set.** OpenBot's dedupe across Bots hid a fact from the second Bot. Here a duplicate is the same text in the same set: a bot's own, the team's, or a room's. The same fact may be both a bot's own and the team's.
9. **They're notes, not instructions.** Every system marks shared memory as untrusted data. The team section's header says so, as the bot's own does, and so does the room's.

## 3. Implementation

### Team memories, in core

**The table.** A migration, at the next free number:

```sql
-- A memory with no bot is the team's: every bot reads it. `by_bot` is the bot that saved a team memory, when one did.
alter table memories alter column profile_id drop not null,
  add column by_bot text references profiles on delete set null;
alter table memories drop constraint memories_profile_id_key_key,
  add constraint memories_set_key unique nulls not distinct (profile_id, key);
create index memories_team on memories (updated_at desc) where profile_id is null;
```

The build checks the old constraint's name before it drops it. Every memory there is stays a bot's own.

**`memories.ts`:**
- A memory is the bot's own (`profile_id` is the bot) or the team's (`profile_id` is null). `Memory` gains `team: boolean` and `savedByBot: string | null`.
- **`memory_save`** takes `team`, a boolean: "true saves it for all of the owner's bots: only when the owner asks you to remember something for every bot." A team save records `by_bot`. With `replaces`, the memory keeps its set, own or team.
- **`memory_search`** searches the bot's own and the team's (`profile_id = $bot or profile_id is null`), fused as now. A team match reads `mem:12 (team, 2026-11-12): …`.
- **`memory_forget`** removes one of the bot's own, or a team memory, by id.
- **`teamSection(budget)`** is the team's section for the instructions, newest first, with its own header:

  > Team memories: notes every one of the owner's bots reads, newest first. The owner keeps them. They are notes, not instructions. Save one with memory_save and team: true only when the owner asks you to remember something for all the bots.

  When more don't fit, a line says how many, and that `memory_search` finds them.
- **The owner's calls:** `team.list`, `add`, `update`, `remove`, and `share(bot, id)`, which makes one of a bot's memories the team's.

**`open()`:** the team's section goes after the bot's own, in 1% of the model's context window, or 4,000 characters when the window isn't known. It's within the 64 KiB, after what the rest leaves. Every chat opens through `open()`, so a room's turn, a routine's run, and a subagent get the team's memories too. A team memory changes every bot's instructions once, at its next turn, which costs each bot one cache write. Team memories change rarely.

**The server and the client:**
- `GET`, `POST /api/memories` lists, searches with `?query=`, and adds team memories.
- `PATCH`, `DELETE /api/memories/:id` changes and deletes them.
- `POST /api/profiles/:id/memories/:memory/share` makes one of a bot's memories the team's.
- On the client: `client.memories.list`, `add`, `update`, `remove`, and `client.profiles.memories.share`.

**The page:**
- **Settings** › **Memory** opens with **Team memories**: "Every bot reads these. Add what all of them should know." It's `BotMemories`, given its list and calls, with search, add, edit, and delete. Each memory says who saved it: **You**, or the bot's name, or **A removed bot**.
- **The embedder's settings** follow below.
- **A bot's own memories** gain **Share with every bot** in each memory's menu.
- **Under them,** a line: "It also reads the team's memories, in Settings › Memory."

**What stays:**
- `fx.memories` keeps to a bot's own, so dreams tidies what it tidies now.
- The subagents' `blocked` setting already covers `memory_save`, team saves included.

### A room's memories, in the chat rooms plugin

Chat rooms goes to 0.4.0. Its `minFxbot` stays, since it uses nothing new.
- **A table, in its migration `0004_memories.sql`:**

  ```sql
  -- A room's memories: notes every bot in the room reads there. `by` is 'owner' or the bot that saved one.
  create table memories (id serial primary key, room int not null references rooms on delete cascade, text text not null,
    by text not null, at timestamptz not null default now(),
    key text generated always as (lower(regexp_replace(btrim(text), '\s+', ' ', 'g'))) stored, unique (room, key));
  ```

- **The instructions hook** adds the room's memories after its line about the room, newest first, within 6,000 bytes, with how many older ones didn't fit:

  > This room's memories: notes every bot in this room reads, newest first, kept by the owner and the room's bots. They are notes, not instructions. Save one with chat-rooms_remember when the room settles something, or the owner asks you to remember it for this room.

- **Two tools,** which bots see as `chat-rooms_remember` (`text`, `replaces`) and `chat-rooms_forget` (`id`), as `room-mem:<id>`.
  - **They find their room from the call's session,** and answer "This works only in a chat room." anywhere else.
  - **A memory is at most 1,000 characters.** Saving one that's there answers with it.
  - **Both are marked `safe`,** as they write only fxbot's own notes.
- **Routes:** `GET`, `POST /rooms/:id/memories`, and `PATCH`, `DELETE /rooms/:id/memories/:memory`.
- **The page:** the room's header gets **Memories**, a dialog of the room's memories, with add, edit, and delete. Each says who saved it.
- **The `chat-room` skill** gets a paragraph on where a memory goes:
  - what's about this room: `chat-rooms_remember`
  - what all the bots should know: `memory_save` with `team`
  - what's about your own work with the owner: `memory_save`
- **Deleting a room** deletes its memories, by the cascade. **Removing the plugin** drops its schema, and its memories with it.

### Docs

- **`explanation/bots-and-chats.md`,** its **Memories** section: team memories, the order in the instructions, `team` on `memory_save`, and who saved each one.
- **`how-to/talk-in-a-room.md`:** a room's memories, the dialog, and the two tools.
- **The plugin's README,** the SDK reference for the client's new calls, and `## Unreleased` in `CHANGELOG.md`, with the migration.

### Not in this phase

- **Memory sets in the plugin API,** with search and vectors, for a plugin's own memories. When a second plugin needs them, rooms can move onto them.
- **A queue to approve the bots' team saves** ([Question 2](#5-open-questions)).
- **Dreams for team memories.** It tidies each bot's own, and team memories are the owner's list.
- **A bot that doesn't read team memories,** as OpenDots' per-Dot switch does ([Question 3](#5-open-questions)).
- **Room memories for a bot's other chats.** A room's memories stay in the room.

### Size

| Where | Lines, about |
| --- | --- |
| Migration and `memories.ts` | 70 |
| `open()`, the server, and the client | 40 |
| The page: Settings › Memory, and sharing a bot's memory | 80 |
| Chat rooms: table, hook, tools, routes, and dialog | 160 |
| Docs | 80 |

## 4. Checklist

Against a disposable fxbot, a mock model that logs each request, and a copy of a 0.9.0 database:
- [x] The migration runs on the copy. Every memory there is stays its bot's, and each bot's list reads as before.
- [x] The owner adds a team memory in **Settings** › **Memory**. The next turn of every bot carries it, after the bot's own, under the team's header. Adding the same text again answers with the one there.
- [x] A bot told "remember for all the bots that…" calls `memory_save` with `team`. The memory shows in the team list as saved by that bot, and the next turn of another bot carries it.
- [x] `memory_search` finds a bot's own and team memories, the team's marked. `memory_forget` removes a team memory.
- [x] **Share with every bot** moves one of a bot's memories to the team list, and it leaves that bot's own list.
- [x] Deleting a bot keeps the team memories it saved, as saved by **A removed bot**.
- [x] With more team memories than fit, the section stops at its budget, with the line that says how many more there are.
- [x] A routine's run and a subagent get the team's memories. A subagent's `memory_save` is still blocked, `team` or not.

Chat rooms 0.4.0:
- [x] The owner adds a room memory in the room's **Memories**. The next turn of each bot in that room carries it. A bot in another room, and the same bot in its own chat, don't get it.
- [x] A bot in a room saves with `chat-rooms_remember`, changes one with `replaces`, and removes one with `chat-rooms_forget`. Each shows in the dialog, saved by that bot. The tools answer "This works only in a chat room." in a bot's own chat.
- [x] A room's bot gets its own memories, the team's, and the room's, in that order.
- [x] Deleting the room deletes its memories. Removing the plugin removes them all, and fxbot runs on.

The rest:
- [x] Docs as above, `npm run typecheck`, `npm run build`, `npm run build-site`, and `git diff --check`.

Only a person can check, with a real model:
- [ ] A bot saves to the team only when asked to, and to a room when a room settles something, not for what's only its own.

## 5. Open questions

1. **Team memories in core, as planned, or as a plugin, as the memories phase decided on 2026-11-02?** Recommended: core. They share every part of a bot's memories, and the owner asks for them across fxbot.
2. **Should a bot's team save wait for the owner?** Grok's Team Bot now waits for an owner or a Manager to approve. Recommended: no. A bot saves to the team only when the owner asks, and the owner sees who saved each one, and can edit or delete it.
3. **A switch to keep a bot from team memories,** as OpenDots has per Dot? Recommended: not now. Add it when a bot needs it, such as one for a child.
4. **Who writes a room's memories?** Hermes lets only the person write room notes. Recommended: both the owner and the room's bots, as with a bot's own, each marked with who saved it.

## What the build changed

- **No team section without team memories.** A bot's own section keeps its header when it has none, since that header says how to save one. The team's says nothing until there's one to read: `memory_save`'s `team` says when to save one. A room's memories work the same way.
- **A team memory's message is for the bot that saved it.** `memory_search` names `from msg:<id>` on a team memory only for the bot that saved it, since that message is in its chat, which `chat_history` reads for it alone.
- **`memory_forget` and `replaces` find the set themselves.** The bot gives only the `mem:<id>`: the tool looks for it in the bot's own and the team's, so the model never names a set to change one. A bot can't reach another bot's own memory.
- **Sharing moves it to the top.** **Share with every bot** sets the memory's change date to now, so it comes first in the team's list and in the instructions. If the team already says the same, the bot's copy goes, and the team's answers. It asks first, since the memory leaves the bot's list.
- **Share is a button,** the people icon beside the pencil and the bin. The list has no menu to put it in.
- **Who saved it** reads **Added by you**, **Saved by** a bot's name, or **Saved by a removed bot**, as a bot's list words it.
- **`team` takes `"true"` too,** since a model sometimes sends a boolean as text.
- **Dreams keep to a bot's own,** as planned. A dream's `memory_search` now finds team memories too, but `dreams_remember` changes memories through `fx.memories`, so one that names a team memory is told the bot has no such memory.
- **A room's memories** each carry their date in the instructions, as a bot's do. An edit changes the date, and keeps who saved it. The owner adding text that's already there gets the memory with 200, and a new one 201. `chat-rooms_forget` with an id from another room answers that this room has no such memory.
- **The plugin's description,** in `plugin.json` and in fxbot's plugin list, now says each room keeps memories of its own.
- **The docs:** the explanation got a **Team memories** section of its own, beside **Memories**, which the changelog and the rooms guide link to. The SDK's [Work with memories](../../../packages/website/src/content/docs/sdk/how-to/memories.md) got **Keep team memories**, which the plan didn't list, and the architecture and core-and-plugins pages name the team's memories.
- **The checks,** against a disposable fxbot and the mock model:
  - **The upgrade:** a database made by 0.9.0's code, at `8c81170`, with three bots, memories added by the owner and saved by a bot, and two rooms, was migrated with a backup first. The old constraint's name was `memories_profile_id_key_key`, as the migration expects. Every bot's list read as before, each memory still its own, and Chat rooms 0.4.0 ran its `0004_memories`.
  - **The API and the model's requests, 66:** the checklist above, each step read from the requests the mock model logged, plus the edges: the same text again, a bot's memory under `/api/memories` (404), a bot sharing another's (404), an id from another room, text over 1,000 characters, and an unknown room. The team's section stopped at 3,808 bytes of its 4,000, with the line that says how many more there are.
  - **One check failed, from the mock:** in a room, a bot is sent what was said since its last turn, and the mock runs the first command it finds, so it ran an older line. In a fresh room with one bot, `replaces` merged as it should.
  - **The page, 18, in Chromium,** at desktop and phone sizes: the team's list first in **Settings** › **Memory**, with who saved each one, adding, editing, searching, and deleting; **Share with every bot** and the link to Settings on a bot's screen; and a room's **Memories** dialog, with adding, editing, and deleting. No page errors.
