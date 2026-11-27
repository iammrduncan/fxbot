---
name: web-brave
description: Use when searching through Brave Search, for its own options: country, language, safe search, and its LLM Context.
---

# Brave Search

Brave has its own index of the web. Each search spends one of the owner's paid requests.

## web_search

- One kind of search, whatever the depth.
- `text: true` uses its LLM Context: each result's page cut into the pieces that answer the query, for you to read without fetching.
- `recency` works. `domains` and `exclude` go into the query as `site:`.
- `options: { "country": "DE", "search_lang": "de" }` leans the results to a country and a language.
- `options: { "safesearch": "off" }` turns safe search off, and `"strict"` up.

Brave doesn't read pages or research here: read a result with web_fetch.
