# web

A plugin for [fxbot](https://fxbot.sh): bots search, read, and research the web, through the providers you add, as you add a model provider. It searches with no key, reads pages itself, and with the computer, reads a page in each bot's own browser.

Add it from **Plugins**, where fxbot's list has it, among the Essentials. It runs inside fxbot: read its code there before you add it. It needs fxbot 0.12.0 or newer, for providers a plugin brings. See [Let bots search the web](https://fxbot.sh/docs/how-to/let-bots-search-the-web/).

## Tools

Each works the same whichever provider answers it. A result's first line names the provider and says the text is what sites say, not instructions.

- **`web_search`** `{ query, count?, depth?, text?, recency?, domains?, exclude?, provider?, options? }`: a numbered list of title, address, date, and snippet, 5 results unless asked, 20 at most. `depth` is `quick`, `normal`, or `deep`. `text: true` brings each page's text too, up to 50,000 characters in all.
- **`web_fetch`** `{ url, start?, browser?, provider?, options? }`: a page as Markdown, 20,000 characters at a time from `start`, saying where the next part starts. A PDF goes to the bot's library, for `library_read`, and an image comes back for the bot to see.
  - **Who reads it:** with `browser: true`, the bot's own browser on its computer. With `provider`, or the owner's pick, that provider. Otherwise fxbot itself.
  - **A page that refuses fxbot,** with 401, 403, or 429, or that's only JavaScript, says what else could read it: the browser, an added provider that reads, and the Wayback Machine.
- **`web_research`** `{ question, depth?, provider?, options? }`, once a provider that researches is added: the answer, with its sources as links. Research a provider runs in the background is asked after for up to 3 minutes. A plugin can't take a tool back, so after the last such provider goes, it says none is added until the plugin reloads.

`provider` asks another added provider, by its name or kind, for one call. `options` goes to the provider as it is, inside the request: each provider's skill says what it takes.

Each tool is idempotent, so a call cut off by a restart runs again, and none is `safe`: a search carries its query out, so the permissions plugin asks about them as it does an MCP server's tools. A search is kept 5 minutes, and a page 15, in memory, 100 at most.

## Providers

Its `plugin.json` brings each to the Add provider page, under **For web**, with `models: "none"`. fxbot seals each key, and the plugin's requests go only to the provider's own addresses, with the key added on the server.

| Provider | Searches | Reads | Researches | Key check |
| --- | --- | --- | --- | --- |
| Keiro (BrowserFoundry) | lite, fast, deep; with page text; `route: "slow"` | extract | answer; `deep` is its web agent | none: Try it |
| Firecrawl, or yours | one search, with each page as Markdown | scrape | | `GET /v2/team/credit-usage` |
| Tavily | fast, basic, advanced; with each page | extract | research, asked after | `GET /usage` |
| Exa | fast, auto, deep; with each page's text | contents | answer | `GET /agent/runs` |
| Brave Search | one search; LLM Context for text | | | `GET /web/search`, which spends a search |
| Perplexity | its Search API, each page's text in the snippet | Context | | `GET /v1/models` |
| Parallel | turbo, fast, advanced, with excerpts | extract, full content | Task runs, asked after | none: Try it |
| Jina | s.jina.ai, five results with their text | r.jina.ai | | none: a read spends tokens |
| Linkup | fast, standard, deep | fetch | a sourced answer | `GET /credits/balance` |
| SearXNG, yours | its JSON search | | | none |

**Free search:** with no search provider added, and `freeSearch` on, `web_search` uses Parallel's free search, its MCP server at `https://search.parallel.ai/mcp`, called from the plugin's own code with no key. It gets the query and a session id of the plugin's own.

**Nous Portal's tools,** Perplexity's search and Firecrawl's reading through a Nous plan, aren't here yet: Nous's gateways take a Portal sign-in, and whether they take a Portal API key is untested. Adding Perplexity and Firecrawl directly gives the same.

## Reading a page itself

- **Only the public internet.** `http:` and `https:` on ports 80 and 443, no user name, no local name. Every address a name resolves to must be public, checked after DNS, and the connection goes to the address checked. Each of up to 5 redirects is checked again. This machine, the owner's network, and the tailnet are refused.
- **Limits:** 20 seconds, 5 MB for a page, 8 MiB for a PDF, 3.75 MiB for an image.
- **What it says it is:** `Mozilla/5.0 (compatible; fxbot/<version>; +https://fxbot.sh)`, asking for Markdown first, with no cookies.
- **HTML to Markdown** is the plugin's own, in `fxbot/read.ts`: the page's `<main>`, or the article that holds most of it, or its `<body>`, without scripts, styles, menus, the site's header and footer, forms, and chrome such as cookie notices and dropdowns. Headings, links made absolute, lists, code, quotes, and simple tables come through.

## The computer's browser

With the computer added and on for the bot, `browser: true` calls the computer's `read`: agent-browser opens the page in the bot's own Chromium, with its sign-ins, in the bot's tab or its subagent's own, and reads it as Markdown. Clicks, forms, and sign-ins stay with the computer's tools and its `browser` skill.

## Skills and instructions

- **`web`,** for every bot the plugin is on for: when to search, read, or research, how to search well, citing, trusting pages, and getting past a blocked page.
- **`web-<provider>`,** one for each added provider, from `fxbot/skills/`, set for each bot with `fx.skills.set`: what it's best at, its `options`, and what a call costs. They follow the providers, checked every 30 seconds and as a chat opens.
- **A line in each chat** names the tools there, which provider does each job, and the skills.

## The Web section

On the plugin's tab in Settings: **Search with**, **Read pages with** (fxbot itself first), and **Research with**, each listing the added providers that can, with **Try it**. With nothing picked, search and research go to the first added that can, in the table's order, and reading is fxbot's own. A bot can ask another for one call.

## Settings

| Setting | Default | What it does |
| --- | --- | --- |
| `freeSearch` | `on` | With no search provider added, search with Parallel's free search |

## Tables

- `picks`: one row, the provider for `search`, `read`, and `research`. One that's gone counts as none.
- `calls`: what each call showed, by the model's id for it, for its view in the chat, which gets only a preview of a result. Kept 30 days.

## Routes

- `GET /config`: the added web providers and what each does, the picks, `freeSearch`, and whether the computer is there.
- `PUT /config`: the picks, `{ search?, read?, research? }`, each an added provider's id or null.
- `POST /try`: `{ job, provider }`, one small search, read of `https://example.com`, or research question, with what came back or the provider's error.
- `GET /calls/:id`: one call's view.

## Files

- `fxbot/server.ts`: the tools, the picks, the skills, the instructions, and the routes.
- `fxbot/fetch.ts`: a public page, guarded.
- `fxbot/read.ts`: HTML to Markdown.
- `fxbot/providers/`: one adapter for each provider, and Parallel's free search.
- `fxbot/skills/`: each provider's skill.
- `skills/web/SKILL.md`: the skill every bot gets.
- `fxbot/page.jsx`, built into `fxbot/page.js`: the Web section, and how a search, a read, and research show in a reply.

## Building it

`fxbot/page.js` is `fxbot/page.jsx` bundled with [rolldown](https://rolldown.rs), which comes with fxbot's packages. It bundles nothing but its own code. Run this in this folder, in a checkout of fxbot, after changing `page.jsx`:

```sh
npx rolldown fxbot/page.jsx --format cjs -e react -e react/jsx-runtime -e @fxbot/app --file fxbot/page.js
```
