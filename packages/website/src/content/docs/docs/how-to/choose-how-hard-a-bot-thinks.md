---
title: "Choose how hard a bot thinks"
description: "Set how hard a bot's model thinks before it answers, from the levels that model offers, and the level its subagents think at."
---

A model that reasons thinks before it answers. **Thinking**, on a bot's edit screen, sets how hard: the model's own default, or one of the levels the model offers. A higher level is slower and costs more, and a lower one is quicker and cheaper.

1. Open the bot's edit screen: **Edit** in the panel beside its chat.
2. Under **Model**, choose a level in **Thinking**: **Model's default**, or one the model offers, such as **Low**, **Medium**, **High**, **Extra high**, or **Max**. **Off** turns thinking off, on a model that allows it.
3. Choose **Save**. The bot's next message thinks at that level.

A model that offers no levels shows no **Thinking**. A bot starts at **Model's default**, which sends no level at all, so its chat behaves as before.

## Which levels

Each model offers its own: GPT-5 offers Minimal to High, and Claude Opus 5.5 Low to Max, for example. fxbot reads them from where the bot's provider lists them, and offers only those. The thinking each reply did shows in its steps, as **Thinking**, then **Thought**.

## When the model changes

A bot moved to another model keeps its level. If the new model doesn't offer it, the bot runs at the nearest lower level the model does offer, never at **Off**, and **Thinking** says so, such as "Max: runs as High on this model". With no lower level, the model's own default runs. Your level stays saved, and comes back on a model that offers it.

## Which providers

A bot's level reaches its model through **AI Gateway**, **Vercel**, a **ChatGPT** sign-in, and a **Grok** sign-in now. Every other provider, by key or on your machine, takes it with a coming update of the agent fxbot runs on. Until then, **Thinking** shows for those providers' models, says it takes effect with that update, and sends nothing. See [Providers](/docs/reference/providers/#thinking-levels).

Changing the level in a long chat on Claude costs the chat's prompt cache once, so choose one and keep it.

## For subagents

[Subagents](/docs/how-to/hand-work-to-subagents/) think at their bot's level by default. To have them think harder, or more lightly, open **Settings** › **Subagents**, and set `thinking` to a level, such as `high`, or back to `same`. A level the bot's model doesn't offer runs as the nearest lower one.
