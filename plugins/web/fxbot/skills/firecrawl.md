---
name: web-firecrawl
description: Use when searching or reading pages through Firecrawl, for its own options: page formats, waiting for a page, and acting on it before reading.
---

# Firecrawl

Firecrawl searches and scrapes pages to Markdown, in its cloud or on the owner's own server. It bills in credits: a scrape is 1, a search 2 for each 10 results.

## web_search

- One kind of search, whatever the depth. `text: true` scrapes each result to Markdown too, which costs a credit a page.
- `recency` works. `domains` and `exclude` go into the query as `site:`.
- `options: { "sources": ["news"] }` searches news, and `["images"]` images.

## web_fetch

`provider: "firecrawl"` reads a page through Firecrawl's scrape, which runs JavaScript and gets past many pages that refuse a plain request. Its `options`:

- `"waitFor": 3000` waits that many milliseconds before reading.
- `"onlyMainContent": false` keeps the whole page, menus and all.
- `"formats": ["markdown", "links"]` adds the page's links.
- `"actions": [{ "type": "click", "selector": "#more" }]` acts on the page before it's read.

Firecrawl doesn't research here. For a whole site, read its `/sitemap.xml` with web_fetch.
