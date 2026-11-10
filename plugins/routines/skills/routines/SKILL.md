---
name: routines
description: Use when the owner asks for something done on a schedule or at a later time, such as every morning, each Friday, or tomorrow at 9, or to change, pause, or remove a routine. How to write a task that runs with no one there, and its schedule.
---

# Routines

A routine is a task you run on a schedule, in a session of your own, with everything you have: your tools, computer, skills, memories, and library. The last message of each run goes to the owner, in your chat, under the routine's name. Routines are made only in your own chat with the owner.

## When to make one

- Something regular: "every weekday at 8, summarize my mail", or "each Friday, check the backups".
- Something later, once: "tomorrow at 9, remind me to call the vet".
- Something to watch: "every hour, check the price, and tell me only if it drops".

Not for something to do now: do it now. A routine runs at most every 15 minutes, unless the owner changed that.

When what they asked is clear, save it: the reply in the chat shows when it runs, with **Remove**. Ask first only when you can't tell, such as a time with no day.

## Writing the task

A run has no chat and no one to ask. The task is all it knows, and it's the owner's say-so for what it names, and for nothing else. Write it to stand alone, in up to 2,000 characters:

- **What to do,** in order, with where to look: which inbox, which site, which file in your library.
- **What to tell the owner,** and how: a short list, a few lines, or a page for a long report.
- **When to stay quiet,** such as "tell me only if it's under €400". A run with nothing to say replies `(no reply)`, and the owner hears nothing.
- **What it may do that you'd ask about first,** only if the owner said so, such as "send the summary to the team". Leave anything else out, and the run won't do it.

For example, named "Morning mail", on `0 8 * * 1-5`:

> Read my unread mail from the last day. Tell me, in a short list, what needs an answer today and what can wait, with who it's from and a line each. Skip newsletters. If nothing needs me, reply (no reply).

## The schedule

**Repeating:** `cron`, five fields in numbers: minute, hour, day of the month, month, and weekday, where 0 and 7 are Sunday. It's in the owner's time zone.

| They say | `cron` |
| --- | --- |
| Every day at 7 | `0 7 * * *` |
| Weekdays at 8:30 | `30 8 * * 1-5` |
| Fridays at 5 pm | `0 17 * * 5` |
| Mondays and Thursdays at 6 | `0 6 * * 1,4` |
| Every hour | `0 * * * *` |
| Every 2 hours, from 8 to 8 | `0 8-20/2 * * *` |
| The 1st of each month at 9 | `0 9 1 * *` |

**Once:** `at`, a local time, such as `2026-11-14T09:00`. `routines_list` says the time now, so "tomorrow" comes out right.

Some don't fit: "every other Tuesday", "the last day of the month", or "the first Monday". Say so, and offer the nearest that does, such as every Tuesday, or the 28th.

## Changing one

- `routines_list` shows your routines, with ids such as `r:12`, and the time now.
- `routines_change` changes a routine's name, task, or schedule, or pauses it.
- `routines_remove` removes it.
- The owner can also switch one off, run it now, or remove it, in your settings.

## During a run

Your instructions say when you're in a run. Do the task now, since its schedule is set already. Decide rather than ask, and say what you assumed. When a step needs the owner, such as a sign-in, stop there, and say what you need.
