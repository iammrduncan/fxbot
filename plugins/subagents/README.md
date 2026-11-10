# subagents

A plugin for [fxbot](https://fxbot.sh): a bot hands work to subagents, helpers that run in the background while it carries on, and hears back from them together.

- **A subagent is the bot, run again, on one task.** It works in a session of its own, with the bot's instructions, tools, computer, skills, and memories, but not its chat, so the task carries everything it needs.
- **The bot starts one with `subagents_start`,** a title and a task, and gets its name and id at once, such as Curie (s:12): a scientist's name, at random, that none in the bot's list has, as Codex names its agents, and a color of its own too, on its name in the panel. The bot can start several, for parallel work, and keep talking with you.
- **With the plugin on, a bot hands work that takes a lot of digging to subagents** by itself, and tells you it'll come back with the results. `handOff` turns that off.
- **A subagent and the bot's chat talk while it works.** It tells the chat what can't wait, a question or a finding, and the bot answers it, or changes its task, by name.
- **Their reports come back together.** Once every subagent one turn started has ended, one message from **Subagents** reaches the bot's chat with all their reports. It joins the bot's turn if one is running, or starts its next one, and the bot tells you what matters.
- **You watch them work.** The bot's panel, on the right of its chat, lists its subagents, working and recent, with the tool each is in and its calls. A click opens one's thread: its task, each step, and how it ended, live. **Stop** ends one.
- **Its skill, `subagents`, says when to hand work off and when not,** how to split it and write a task a subagent can do alone, with an example, and what to do while they work and when they report.
- **On the computer, they work together,** with the [computer](https://fxbot.sh/docs/how-to/give-bots-a-computer/) 0.4.0 or newer: each has its name and arrow on the computer's screen, such as "Ann · Curie", its own browser tab, and turns at the desktop and the terminal.

Add it from **Plugins**, or with **Essentials**, which has it. It runs inside fxbot: read its code there before you add it. It needs fxbot 0.9.0 or newer. See [Hand work to subagents](https://fxbot.sh/docs/how-to/hand-work-to-subagents/).

## The tools

- **`subagents_start({ title, task })`:** starts one, only in the bot's own chat with you, not in a room or a routine's run. The same call twice in one turn, as libfx runs a call a restart cut off, finds the subagent the first one started.
- **`subagents_list()`:** the bot's subagents working now, and those that ended in the last day, for when you ask how they're going. A second call in the same turn answers that their reports come on their own, so a bot doesn't wait by polling.
- **`subagents_stop({ id })`:** stops one, by name or id. A batch the bot stopped entirely sends no report.
- **`subagents_message({ to, text })`:** from the bot's chat, sends a working subagent an answer or a change, which reaches it at its next step, while it works.
- **`subagents_tell({ text })`:** only in a subagent: tells the bot's chat what can't wait for its report. It joins the chat's turn, or wakes it, as a message from the subagent's name, and the subagent carries on. At most five times a subagent.

## What a subagent can't do

- **Start a subagent of its own.** There's one level. Its only `subagents_*` tool is `subagents_tell`.
- **The tools in the `blocked` setting,** which are by default what the bot's chat decides: `memory_save`, `memory_forget`, `messages_send`, `routines_add`, `routines_change`, `routines_remove`, and `computer_ask_owner`. It says in its report what it would do instead.
- **Ask you anything.** Nobody watches a subagent, though it can tell the bot's chat. A call that needs your OK waits at a card in the bot's chat, from [Permissions](https://fxbot.sh/docs/how-to/choose-what-a-bot-can-do-alone/), as background work does.

## Its limits

In its tab in **Settings**. A bot can't change them.

| Setting | What it is | Default |
| --- | --- | --- |
| `atOnce` | The most subagents a bot has working at one time, 1 to 10 | 4 |
| `perAsk` | The most subagents one request from you leads to, through every turn their reports wake, 1 to 50 | 10 |
| `minutes` | The most minutes one subagent works, 1 to 240 | 60 |
| `calls` | The most tool calls one subagent makes, 1 to 1,000 | 100 |
| `handOff` | `on`: the bot hands work that takes a lot of digging to subagents, and tells you it'll come back with the results. `off`: it starts one only when it decides to | `on` |
| `keepDays` | How many days an ended subagent and its thread are kept before they're deleted, 1 to 90. The list shows those that ended in the last day. | 30 |
| `blocked` | Tools a subagent can't call, comma-separated | as above |

A value outside its range means its default, with one line in the plugin's log.

## Endings

- **Done:** its last message is its report.
- **Failed:** its provider answered with an error, or it ran past `minutes`.
- **Stopped:** by you, in the panel or on its thread; by the bot; when the plugin is turned off for the bot; or when fxbot or the plugin restarted, since a subagent cut off by a restart isn't run again. Its tools may have done half the work, so the bot hears it stopped and can start it again.
- A report that can't be sent, such as to a bot with no provider, is tried again every 30 seconds, and dropped, with a line in the log, a day after its batch ended.

## What it costs

- **A subagent's requests** carry the bot's instructions and tools, its rules, about 1.5 KB, and the task, but no chat. In a check with a small bot, its first request was 7.4 KB, against 5.9 KB for that bot's first message in a new chat. A real chat's requests are larger by its history. They run on the bot's provider, which counts their usage.
- **In every request:** the five `subagents_*` tools' definitions, about 550 tokens, on every bot, as every plugin's tools reach every bot. In a bot's own chat, the hand-off line, about 140 tokens, unless `handOff` is off. Both are cached with the rest.
- **The skill:** its line in each bot's list of skills, about 80 tokens, and about 1,100 when the bot reads it.
- **One turn in the bot's chat for each batch,** at the chat's full context, to pass the reports on. That's why reports come together.
- **At once,** up to `atOnce` turns of a bot, which share fxbot's turns at once with every other bot.
- **Storage:** about 260 bytes a subagent in the plugin's table, and its session, kept as any chat's is.
- **The page:** the list reads the bot's subagents every 5 seconds while one works and the panel is open, and every 30 seconds otherwise. A thread streams while it's open. A closed panel asks nothing.

## Building it

`fxbot/page.js` is `fxbot/page.jsx` bundled with [rolldown](https://rolldown.rs), which comes with fxbot's packages. Run this in this folder, in a checkout of fxbot, after changing `page.jsx`:

```sh
npx rolldown fxbot/page.jsx --format cjs -e react -e react/jsx-runtime -e @fxbot/app --file fxbot/page.js
```

Commit both.
