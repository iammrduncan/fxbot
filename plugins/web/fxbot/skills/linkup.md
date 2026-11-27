---
name: web-linkup
description: Use when searching, reading, or answering through Linkup, for its own options: dates, and pages that need JavaScript.
---

# Linkup

Linkup searches, answers with sources, and reads pages. A search costs half a cent, and a deep one five cents.

## web_search

- `depth: "quick"` is its fast search, `normal` standard, and `deep` deep, which searches over and over until it finds what's asked.
- Each result comes with its content, at no extra cost: `text: true` shows it.
- `recency`, `domains`, and `exclude` all work. `options: { "toDate": "2026-06-30" }` stops at a date.

## web_fetch

`provider: "linkup"` reads a page as Markdown. `options: { "renderJs": true }` runs its JavaScript first.

## web_research

Linkup's sourced answer, from a search at the depth asked.
