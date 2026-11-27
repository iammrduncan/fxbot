---
name: web-keiro
description: Use when searching, reading, or researching through Keiro (BrowserFoundry), for its own options: slow search, JSON extraction, deep search, its web agent, and sitemaps.
---

# Keiro (BrowserFoundry)

Keiro Labs, also sold as BrowserFoundry, searches, reads pages, answers, and researches on one key. It bills in credits, and each result says what it cost.

## web_search

- `depth: "quick"` is its lite search, the cheapest. `normal` is its fast search. `deep` is its deep search: it reads every top page and orders them by how likely each is to answer, and takes 15 to 50 seconds.
- `text: true` is its search with content: up to 5 pages, each as Markdown.
- `options: { "route": "slow" }` is its slow search, free on paid plans: use it for work that can wait.
- `options: { "country": "de" }` leans the results to a country.

## web_fetch

`provider: "keiro"` reads a page through Keiro's extract, which gets past many pages that refuse a plain request. Its `options`:

- `"mode": "deep"` renders a page that needs JavaScript, and `"heavy"` tries hardest.
- `"objective": "…"` keeps only the text about that.
- `"json_schema": { … }` pulls structured data out of the page, as JSON, with no extra charge.
- `"expand_content": true` opens "Read more" links first.

## web_research

- `depth: "normal"` is its answer: a short answer with its sources, in a few seconds.
- `depth: "deep"` is its web agent: multi-step research, which takes longer and costs more. Hand it to a subagent if you have them.

## A site's pages

To list a site's pages, read its `/sitemap.xml` with web_fetch.
