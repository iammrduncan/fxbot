---
name: web-tavily
description: Use when searching, reading, or researching through Tavily, for its own options: news and finance searches, an answer with the results, and research models.
---

# Tavily

Tavily searches, reads, and researches for agents. It bills in credits: a search is 1, or 2 at `deep`.

## web_search

- `depth: "quick"` is its fast search, `normal` basic, and `deep` advanced, which finds several pieces of each page that match.
- `text: true` brings each page as Markdown.
- `recency`, `domains`, and `exclude` all work.
- `options: { "topic": "news" }` searches news, and `"finance"` finance.
- `options: { "include_answer": true }` adds a short answer, which the results don't show: use web_research for one instead.
- `options: { "country": "germany" }` leans general results to a country.

## web_fetch

`provider: "tavily"` reads a page through Tavily's extract. `options: { "extract_depth": "advanced" }` gets tables and pages that load late, for 2 credits.

## web_research

Tavily researches in the background: `normal` uses its mini model, for a narrow question, and `deep` its pro model, for a broad one, which takes minutes and up to 250 credits. Hand that to a subagent if you have them.
