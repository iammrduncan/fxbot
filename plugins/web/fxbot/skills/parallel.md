---
name: web-parallel
description: Use when searching, reading, or researching through Parallel with a key, for its own options: objectives, several queries, and research processors.
---

# Parallel

Parallel searches its own index for agents, reads pages, and runs research tasks.

## web_search

- `depth: "quick"` is its turbo mode, `normal` fast, and `deep` advanced, the slowest and best.
- Each result comes with excerpts from the page that match, at no extra cost: `text: true` shows them.
- `domains` and `exclude` work. `recency` doesn't: say how new in the query.
- `options: { "objective": "…" }` says, in a sentence, what you're trying to find, which helps it most. `options: { "search_queries": ["…", "…"] }` searches several ways at once.

## web_fetch

`provider: "parallel"` reads a page's full content as Markdown, PDFs and pages that need JavaScript too.

## web_research

A Task run, which researches in the background: `quick` is its lite processor, `normal` base, and `deep` core, which takes minutes. Hand that to a subagent if you have them.

## Its free search

With no search provider added, web_search uses Parallel's free search, which needs no key. It has limits, enough for one person: if it says it's limiting searches, wait, or ask the owner to add a provider.
