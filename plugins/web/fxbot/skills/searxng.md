---
name: web-searxng
description: Use when searching through the owner's SearXNG, for its own options: engines, categories, and languages.
---

# SearXNG

The owner's own SearXNG asks many search engines at once, on their server, and costs nothing.

## web_search

- One kind of search, whatever the depth.
- `recency` works. `domains` and `exclude` go into the query as `site:`.
- `options: { "categories": "news" }` searches news, and `"science"`, `"it"`, or `"images"` others.
- `options: { "engines": "wikipedia,duckduckgo" }` asks only those engines.
- `options: { "language": "de" }` keeps to a language.

SearXNG doesn't read pages or research: read a result with web_fetch.
