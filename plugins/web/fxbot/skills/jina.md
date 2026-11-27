---
name: web-jina
description: Use when reading pages or searching through Jina, for its own options: what part of a page to keep, waiting for it, and images.
---

# Jina

Jina's Reader turns any page into Markdown, and its search gives five results, each with its page's text. Each call spends tokens from the owner's key.

## web_search

Five results at most, whatever `depth` says, each with its page's text, which `text: true` shows. `domains` and `exclude` go into the query as `site:`.

## web_fetch

`provider: "jina"` reads a page through its Reader, which runs JavaScript. Its `options` are its headers:

- `"x-target-selector": "article"` keeps only that part of the page, and `"x-remove-selector": "nav, .ads"` drops parts.
- `"x-wait-for-selector": "#content"` waits for part of a page to load.
- `"x-with-generated-alt": "true"` describes the page's images.
- `"x-no-cache": "true"` reads it fresh.

Jina doesn't research here.
