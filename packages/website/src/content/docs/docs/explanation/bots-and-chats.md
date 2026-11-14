---
title: "Bots, chats, memories, and the library"
description: "A bot in fxbot is meant to be talked to for months, not for one task. This page is about what that asks of a bot, its chat, what it remembers, and the files it keeps."
---

A bot in fxbot is meant to be talked to for months, not for one task. This page is about what that asks of a bot, its chat, what it remembers, and the files it keeps.

## A bot is a profile

A bot is a name, instructions, a provider and a model, with how hard the model [thinks](/docs/how-to/choose-how-hard-a-bot-thinks/), and a look: one of 32 shapes in one of eleven colors, with a feeling, and something on its head, its face, and its body. It blinks and watches the pointer, hops while it works, looks at you while a call waits on an answer, smiles when it finishes, and sleeps when it has no provider. Up to three bots can be pinned to the top of the list.

<img class="shot dark:sl-hidden" src="/shots/look-desktop-light.png" width="1280" height="800" alt="The New bot screen: a green bunny in a beanie, with the Shape tab open" />
<img class="shot light:sl-hidden" src="/shots/look-desktop-dark.png" width="1280" height="800" alt="The New bot screen: a green bunny in a beanie, with the Shape tab open" />

## One chat that lasts

Each bot has one long-running chat, a durable libfx session on the server. The page only shows it, so the chat survives a reload, a closed app, and a server restart, and a reply carries on while nobody watches.

Everything in a chat is also kept in Postgres: what you and other bots said, the bot's replies, its thinking, and its tool calls with their results. Each bot has a `chat_history` tool that searches all of that, across all its chats, and reads it in full around a match, in the order it happened. So a bot can look up what was said in an earlier chat, or long ago, and what it did about it. Each result says who it's from, so another bot's words don't read as yours. It reaches only its own chats. Thinking and tool calls are kept since 0.6.0, each up to 64 KiB.

## A message to a working bot

You don't wait for a bot to finish. A message you write while it works joins what it's doing: a reply it's writing is cut short, and it goes on with your words in mind. While a tool runs, your message waits for the tool, then joins, so the chat shows it where the bot took it in, among its steps. If nothing is running, it's an ordinary turn.

Some messages don't join:

- A picture of yours ends the running turn and runs next, since it's usually a change of course. What the bot had done stays.
- A turn that only passes something on, such as a routine's result, takes no messages. A message waits for it, for the few seconds it takes.

Up to 32 turns run at once, across all your bots, and a bot waiting on a long command holds its place. Past that, a turn waits for one to end. **Turns at once** in **Settings** › **General** changes it, from the next time fxbot starts.

To end a turn instead, press **Stop**, where the send button is while the box is empty. It doesn't wait for a running tool, and a command on the bot's computer stops too. Anything you sent that the bot hadn't read runs next, so nothing you wrote is lost.

## The sidebar

The sidebar lists your bots, with up to three pinned on top, larger. Drag a bot to move it, with a mouse, or with a finger after a moment's hold, so a swipe still scrolls. Pinned bots move among themselves, and a bot you pin or unpin goes to the end of its group. Right-click a bot, or hold it on a phone, for its menu: **Edit**, **Pin** or **Unpin**, **Default bot**, and **Delete**.

<img class="shot dark:sl-hidden" src="/shots/menu-desktop-light.png" width="1280" height="800" alt="A bot's menu in the sidebar: Edit, Pin, Default bot, and Delete" />
<img class="shot light:sl-hidden" src="/shots/menu-desktop-dark.png" width="1280" height="800" alt="A bot's menu in the sidebar: Edit, Pin, Default bot, and Delete" />

## The default bot

One bot can be the default, picked in **Settings** › **General**, or with **Default bot** in its menu in the sidebar, where it wears a small star. Opening fxbot at its address then opens that bot's chat, where it left off, instead of the list of bots. A link to another screen opens that screen, and a reload stays where it was. Deleting the bot clears the choice.

## Memories

A bot keeps what it learns as memories: what you prefer, facts about you and your work, decisions, and corrections. Each memory is one fact, in a sentence that stands on its own, of at most 1,000 characters. Memories belong to one bot, not to a chat, so a new chat, or a move to another provider, keeps them. Deleting the bot deletes them. [Team memories](#team-memories) are every bot's.

The bot saves them on its own, during its turns, with three tools. The chat shows each as a sentence:

- `memory_save` saves a fact, as **Saved a memory**. Given `replaces` and a memory's `mem:<id>`, it changes that memory instead. Saving what is already saved, in other case or spacing, answers with the memory that's there. A change that says what another memory says merges the two.
- `memory_search` finds memories, as **Searched memories**.
- `memory_forget` removes one that is wrong or no longer true, as **Forgot a memory**.

A memory the bot saves records the message of the turn it was saved in. `memory_search` names that message, and `chat_history` reads it, with what came before and after.

The newest memories are in the bot's instructions, which fxbot sends on every turn: newest first, each with its `mem:<id>` and date. They take at most 2% of the model's context window, at 4 characters a token, or 8,000 characters when the window isn't known. All the instructions together stay within libfx's 64 KiB, so very long bot instructions leave less room for memories. When more memories don't fit, a line says how many, and asks the bot to merge or forget ones that overlap. `memory_search` finds the rest. The section calls them notes, not instructions.

The section changes only when a memory is saved, changed, or removed, not when one is searched, so the model's prompt cache holds between changes. And since the instructions go with every turn, a memory saved in a long chat reaches that chat on its next turn.

You see a bot's memories under **Memories** on its edit screen, which **Edit** in its panel opens: newest first, each with its date, and **Saved by** the bot or **Added by you**. Search them there, add one with **Add a memory**, change one with its pencil button, or delete one. The bot sees your change on its next turn.

## Team memories

Team memories are notes every one of your bots reads: who you are, how you like things done, and what your household or business is. They work as a bot's own memories do, with a wider reach.

- **You keep them** in **Settings** › **Memory**, under **Team memories**, to search, add, edit, and delete, as on a bot's screen. Each says who saved it: you, a bot, or **a removed bot**, once that bot is deleted. Deleting a bot keeps the team memories it saved.
- **A bot saves one** with `memory_save` and `team`, when you ask it to remember something for all your bots. Its `memory_search` finds the team's with its own, marked `team`, and `memory_forget` removes one.
- **To share one of a bot's own,** choose **Share with every bot**, the people button beside it on the bot's screen. It moves to the team's list.
- **In the instructions,** the team's newest go after the bot's own, under a header that calls them notes, not instructions. They take up to 1% of the model's context window, or 4,000 characters when the window isn't known. A change reaches every bot on its next turn, and a room, a routine's run, and a subagent get them too.

The same fact can be both a bot's own and the team's. Saving what the team already has answers with the one there.

With the chat rooms plugin, each room keeps memories of its own as well: see [Give a room memories](/docs/how-to/talk-in-a-room/#give-a-room-memories).

## A soul, with the soul plugin

With the [soul plugin](/docs/how-to/give-a-bot-a-soul/), each bot also has a soul: a few lines, in its own words, of who it is, how it sounds, and how it helps you. It writes it in a first meeting with you, and rewrites it when you ask.

The soul goes first in the bot's instructions, in every chat: its own, a room, a routine's run, and a subagent. A line before it says your instructions come first where they differ, and that the soul never changes the bot's rules or what it may do. So the split is:
- **Instructions** are yours: the rules, which the bot can't change.
- **The soul** is the bot's: its voice and its idea of its job, which it keeps up with you, in its own chat only.
- **Memories** are facts: about you, your work, and what was decided.

## Search by words and by meaning

`memory_search` and `chat_history` find matches in two ways at once:

- **By words.** Any word of the search counts, also as the start of a longer word, and more matches rank higher.
- **By meaning.** An embedding model turns each memory and message into a vector: a list of numbers that puts texts of close meaning close together. The search's own vector finds the nearest. How close the nearest one is varies from search to search, so only matches within 0.05, in cosine distance, of the nearest count.

The two lists are fused with reciprocal rank fusion, so a match in both ranks above a match in one. When there is no embedder, or it doesn't answer within 5 seconds, search uses words alone, and still answers.

The vectors come from a local embedder on the machine, on its CPU by default or on a GPU, or from a provider's embedding model. How to choose: [Choose where memory search's vectors come from](/docs/how-to/memory-search/). One loop in the server fills in the vectors that are missing, memories first, then messages, newest first, and the chat never waits for it. Each model has vectors of its own, so a new model means new vectors for everything. Until they are done, search uses the vectors the current model has made, and words.

Vectors are kept in Postgres, with pgvector, beside the rows they belong to. A search compares the query with each of the bot's vectors, with no index, since an index takes vectors of one size and each model has its own. Over 100,000 messages of one bot, that took about a quarter of a second when measured.

## Starting a chat over

A chat starts over three ways, and all work the same. A model writes a summary of the chat so far, and the bot starts a new chat from it. The earlier messages show above a card with the summary, and stay searchable with `chat_history`. Pages open on the chat follow it to the new one.
- **Moving a bot to another provider.** A session can't move between agents, and fxbot runs one agent per provider, so a move starts a new chat. The old provider writes the summary, or the new one when the old can't. The card says **Continued from** the old provider.
- **`/fresh`,** built in since 0.10.0. A summary aimed at what you write next keeps what bears on it, and your message goes to the new chat. The card says **Started over**. See [Start a chat over with /fresh](/docs/how-to/start-fresh/).
- **Idle compaction,** since 0.10.0. A long chat that sits with no message for 30 minutes is summarized while you're away, so your next message starts fast: the bot reads the summary, not the whole chat again. The card says **Compacted while idle**, with a link to turn it off.

### Idle compaction

Every minute, fxbot looks for a bot whose own chat has had no message for the time set in **Settings** › **General** › **Idle compaction**: 30 minutes, unless you choose 15, an hour, 2 hours, or **Off**. It compacts that chat only when all of these are true:
- **It's long:** its text is at least the size under **Idle compaction** › **Only chats**: over 30,000 tokens, about 120 KB, unless you pick another, from 5,000 to 100,000. It counts what was said, thought, and called, and the documents you sent, at about 4 characters a token. Images don't count. A short chat starts fast anyway.
- **Nothing runs:** no turn of the bot's is running, and it isn't waiting on you.
- **It's new since:** it hasn't been tried since its last message. A summary that failed isn't tried again until a new message comes, and a compacted chat isn't compacted again until it grows.

Only the bot's own chat counts and is compacted here. A room, a routine's run, or a subagent doesn't keep it awake, and isn't compacted with it. fxbot compacts one bot at a time, so many idle bots don't send a burst of requests.

A chat room is compacted too, with chat rooms 0.5.0, by the same setting and the same rules, as a whole: one summary for the room, which its lead writes, unless **Summarize with** names a model. Each bot's next turn there starts from it. See [Start a room over](/docs/how-to/talk-in-a-room/#start-a-room-over).

What the bot keeps, in its own chat's instructions, in place of the chat. Its rooms, routines, and subagents don't get it:
- the summary, which keeps your requests and instructions in your words, what was decided and why, facts about you and your work, and each open task
- the last messages word for word, up to 6,000 characters
- a line that says the summary is for reference, and not to act on it alone

**Summarize with**, under it, picks the model that writes the summary: each bot's own, or a cheaper one you choose. A model on the bot's provider reads the chat as the bot does; one on another provider reads its stored messages. When the model you chose has a window smaller than the chat, the bot's own model writes the summary, and fxbot's log says so.

A message you send while a summary is being written calls it off, and goes to the chat as it was. A summary that fails changes nothing.

## The library

Chats hold files: images, PDFs, and text files you send, and documents bots save. A bot reads a PDF as the text fxbot finds in it, page by page: up to 60,000 characters in your message, and the rest with `library_read`. A PDF of scanned pages has no text to read. The library keeps one copy of each, by the SHA-256 of its bytes, so the same file sent twice, or by two bots, is one item. Each item is tagged with every bot and chat that saved it, which leads it back to where it came from, and it outlives a deleted bot.

You see it two ways: across every bot, from the button beside Settings, and per bot, in the panel beside its chat. Bots reach it through three tools, `library_search`, `library_read`, and `library_save`, and only items tagged for them. A bot is tagged onto an item only by saving its exact bytes, so nothing passes from one bot to another through the library.

Deleting an item removes fxbot's copy for every bot. A chat that read a document keeps its text, and libfx keeps its own copy of an image until it ages out.

## Tools from MCP servers

An MCP server gives its tools to all bots, or to the bots you choose. libfx fixes an agent's tools when it is made, and one agent serves every bot on a provider. So each allowed tool goes to every agent, named after its server, and refuses to run inside a bot that wasn't chosen. Adding a server, or changing its tools, rebuilds the agents.

How to add one is in [Add an MCP server](/docs/how-to/add-an-mcp-server/).
