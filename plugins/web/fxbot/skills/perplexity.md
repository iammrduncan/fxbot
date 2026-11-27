---
name: web-perplexity
description: Use when searching or reading pages through Perplexity, for its own options: dates, languages, and several queries at once.
---

# Perplexity

Perplexity's Search API gives ranked results, each with the page's text in its snippet, so a search often needs no read after it. A search costs $5 for each 1,000, or $1 at `depth: "quick"`.

## web_search

- `depth: "quick"` is its fast search, and the others its own.
- Each result comes with its page's text, at no extra cost: `text: true` shows it.
- `recency`, `domains`, and `exclude` all work, for up to 20 sites.
- `options: { "search_after_date_filter": "1/1/2026" }` keeps to pages after a date, and `"search_before_date_filter"` before one.
- `options: { "search_language_filter": ["de"] }` keeps to languages.
- `options: { "country": "US" }` leans the results to a country.

## web_fetch

`provider: "perplexity"` reads a page through its Context API, as Markdown.

Perplexity doesn't research here.
