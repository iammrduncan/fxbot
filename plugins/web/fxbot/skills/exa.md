---
name: web-exa
description: Use when searching, reading, or answering through Exa, for its own options: categories such as papers, companies, and people, and its summaries.
---

# Exa

Exa searches by meaning: describe the page you want, as you'd describe it to a person who knows the web, and it finds pages like that. It bills in dollars, and each result says what it cost.

## web_search

- `depth: "quick"` is its fast search, `normal` auto, and `deep` its deep search, which looks harder and costs more.
- `text: true` brings each page's text, up to 10,000 characters each.
- `recency`, `domains`, and `exclude` all work.
- `options: { "category": "research paper" }` keeps to one kind of page: `company`, `research paper`, `news`, `pdf`, `github`, `personal site`, `linkedin profile`, or `financial report`.
- `options: { "contents": { "summary": true } }` adds a summary of each page.

## web_fetch

`provider: "exa"` reads a page from Exa's index, which is fast and often has pages that refuse a plain request.

## web_research

Exa's answer: a short answer with its citations, in a few seconds. It's not multi-step research.
