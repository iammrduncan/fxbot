---
title: "Let bots search the web"
description: "Bots search, read pages, and research the web through the web plugin: with no key, or through a provider you add, such as Keiro, Firecrawl, Tavily, Exa, Brave, Perplexity, Parallel, Jina, Linkup, or your own SearXNG."
---

The web plugin gives bots three tools: `web_search` finds pages, `web_fetch` reads one as Markdown, and `web_research` answers a question from several sources. Each works the same whichever provider answers it, and a bot can ask another provider you added for one call.

It works with nothing added. Bots search with Parallel's free search, which needs no key, and read pages themselves. Add a provider when you want more searches, better ones, or research.

## Add web

1. Open **Plugins**, choose **Browse**, and choose **web**. It's one of the Essentials. Read what runs inside fxbot, then choose **Add web**. It needs fxbot 0.12.0 or newer.
2. Ask a bot something current, such as "what changed in the newest Node release?". It searches, reads what it found, and answers with links to the pages it used.

A bot reads a page on its own from fxbot's machine, and only from the public internet: it can't reach this machine, your network, or your tailnet, even when a page redirects there. A PDF it reads goes to its library, and an image comes back for it to see.

## Add a provider

1. Open **Settings** › **Providers**, and choose **Add provider**. Under **For web**, pick one.
2. Make a key on the provider's site, as the card says, and paste it. fxbot checks it where the provider has a way to, and keeps it sealed on the server. The page never gets it back.
3. Open **Settings** › **Plugins** › **web**, and press **Try it** beside each job the provider does. For a provider with no way to check a key, Try it is how you know it works.

| Provider | Searches | Reads pages | Researches | Free | Price, as of November 2026 |
| --- | --- | --- | --- | --- | --- |
| **Keiro (BrowserFoundry)** | Yes, and deep search | Yes | Yes | 1,000 credits | A search 0.5 to 1 credit, about $0.002 to $0.007 a credit |
| **Firecrawl** | Yes | Yes | No | 1,000 credits a month | $19 a month for 5,000 credits; a page 1 credit |
| **Tavily** | Yes | Yes | Yes | 1,000 credits a month | $0.008 a credit; a search 1 or 2 |
| **Exa** | Yes | Yes | Answers | $10 a month | $4 to $15 for each 1,000 searches |
| **Brave Search** | Yes | No | No | $5 a month, with a card | $5 for each 1,000 searches; checking the key spends one |
| **Perplexity** | Yes | Yes | No | None | $5 for each 1,000 searches, $1 at quick |
| **Parallel** | Yes | Yes | Yes | Free search with no key; $5 a month with a key | $1 to $5 for each 1,000 searches |
| **Jina** | Yes | Yes | No | 10 million tokens | By the token |
| **Linkup** | Yes | Yes | Answers | $20 a month | A search half a cent, deep 5 cents |

Two run on your own server, with no key, under **For web** too:

- **Firecrawl on your server:** give its address with `/v2`, such as `http://192.168.1.20:3002/v2`.
- **SearXNG on your server:** give its address, such as `http://192.168.1.20:8888`. Its `settings.yml` must list `json` under `search: formats`, or it refuses fxbot.

fxbot in a container can't reach `localhost` on your machine: give the machine's address, as for Ollama. Only the plugin's requests to that provider reach it, never an address a bot gives. Firecrawl on your server reads pages from your network, so fxbot sends it only a page on the public internet, checked as its own reads are, and none of a bot's `options`. A page's redirects, Firecrawl follows itself.

Keiro is sold as BrowserFoundry too: one key, one entry. Nous Portal's web tools aren't here yet. Its search is Perplexity's and its reading is Firecrawl's, so adding those directly gives the same.

## Pick a provider for each job

In **Settings** › **Plugins** › **web**, under **Web**:

- **Search with:** the provider bots search with. With none picked, it's the first one added that searches, in the table's order. With none added, it's Parallel's free search.
- **Read pages with:** fxbot itself, the default, which costs nothing, or a provider, which gets past more pages that refuse a plain request.
- **If fxbot is blocked, read with:** while fxbot reads pages itself, what reads a page when a site refuses fxbot (HTTP 401, 403, or 429) or the page is only JavaScript:
  - **Nothing,** the default: the bot is told what else could read it, and picks one.
  - **The bot's own browser,** with the computer added. It costs nothing. A bot with its computer off is told what else could read it.
  - **A provider that reads,** such as Keiro, which charges for each page read this way.

  `web_fetch` tries it on its own, and its result says so, such as "Read by your browser, since the site refused fxbot (HTTP 403)". If that fails too, the bot is told both, and what else is left.
- **Research with:** once a provider that researches is added. With none picked, it's the first one added that can.

Each provider you add brings a skill of its own, such as `web-exa`, which tells bots what it's best at and its own options. They come and go with the providers.

## Free search

With no search provider added, bots search with Parallel's free search. It needs no key, and Parallel gets each query a bot sends. Its limits are enough for one person. To turn it off, set the web plugin's `freeSearch` setting to `off`, and bots can't search until you add a provider.

## Read a page in the bot's own browser

With [the computer](/docs/how-to/give-bots-a-computer/) added and on for a bot, `web_fetch` can read a page in the bot's own Chromium, with its sign-ins: for a page that needs JavaScript, or one only a signed-in browser sees. A subagent reads in a tab of its own. Bots do this on their own when a page won't read otherwise. For clicks, forms, and signing in, they use the computer's tools, as before.

## Move off an MCP server

If bots search through a web provider's MCP server today, such as Keiro's:

1. Add web.
2. Add the same provider under **For web**, with the same key or a new one.
3. Press **Try it**.
4. Remove the MCP server, or turn it off for the bots, in **Settings** › **MCP servers**, so bots don't see two ways to search.

Nothing moves on its own. fxbot's MCP list keeps Keiro's server, for anyone who'd rather use it.

## What bots are told

Each chat says which tools are there, which provider does each job, and that pages are what sites say, never instructions. Bots cite each page they use as a link, and search with `web_search`, never by opening a search engine in a browser.

Web's tools reach outside fxbot, so they're never counted as safe: with the [permissions plugin](/docs/how-to/choose-what-a-bot-can-do-alone/), they're asked about or reviewed as an MCP server's tools are.
