# Embedded links

`link-previews` shows a link on a line of its own as what it points to, not as a bare address:
- **A link that stands alone becomes a card,** in the owner's message and in a bot's reply: the page's title, a line of its description, its image, and the site's name and address. A link inside a sentence, a list, or a table stays a link.
- **An X post shows as the post:** who wrote it, its text, its photos and video, the post it quotes, and when, with its counts, drawn in the app's own look. A video plays in place when the owner presses play.
- **A YouTube video shows its thumbnail and title,** and plays in place on a press, from `youtube-nocookie.com`.
- **A link to an image shows the image.**
- **It's still a link.** The card is the link itself, so right-click, or a long press on a phone, gives the browser's own menu: **Copy Link**, **Open in New Tab**, and the rest. A click opens it in a new tab.
- **Bots know.** A line in each chat says a link on its own line shows as a card, so a bot puts one there when the owner should see it, and keeps sources inline.
- **Light.** fxbot's server fetches each page once, reads only its `<head>`, and keeps the card. The owner's browser talks to no other site until they press play, and a chat with no link pays nothing.

Status: planned on 2026-11-14 at the owner's word, not built. Researched against the [research directive](../research-directive.md)'s references, each cloned and searched on 2026-11-14, the chat apps that make link previews, Open Graph, react-tweet's source, and X's and YouTube's public endpoints, called from this machine on 2026-11-14. Nothing of the plugin has run.

## What the owner asked

"Goal of this phase is to have whenever links are pasted stand alone into the app or a bot decides to show it, it shows a preview url embedded card version, and for things like x posts/tweets it shows the embedded tweet/post in the chat instead of naked url. You can right click to copy url etc..." (2026-11-14)

## 0. Core or plugin

**A plugin**, `link-previews` ([Core or plugin](../../CONVENTIONS.md#core-or-plugin)). Previews aren't what every bot needs, what plugins plug into, or what fxbot needs to run, and "a way to show a message" is a plugin's job in the conventions. It's in fxbot's list, off until added.

**One small core hook, `app.link(pattern, Component)`.** A plugin can't reach a link today:
- A bot's reply is drawn by `Markdown` in `packages/ui/src/plugins.tsx`, which passes plugins only `plugins.renderers`, for fenced code blocks (`app.codeBlock`). No place in the page API reaches a paragraph or a link.
- What the owner said is drawn by `Said` in `app.tsx`, through `SaidText`, which `app.said(pattern, Component)` reaches, but only inside the bubble's text, in the bot's color, as an inline piece. A card needs to sit outside the bubble, or be the message, when the message is only the link.

`app.link` is a link that stands alone, drawn by a plugin, wherever the app draws Markdown or what the owner said. It knows nothing of previews or X, so a later plugin can draw a map, a GitHub issue, or a track the same way. About 45 lines of core, no new package, and nothing when no plugin claims a link.

**Why not do it in core:** fetching pages from the owner's server is a choice an owner should make, the X and YouTube rules are sites' rules that change, and an owner who wants bare links removes the plugin.

**The machine.** The plugin's server fetches pages over the network, from fxbot's process, and never from a bot's tool: a bot never sees what it fetched. It refuses an address on the machine or the owner's own network ([Fetching](#fetching)), so a link a bot writes can't make fxbot reach the owner's router or another service there ([Bots and the owner's machine](../../CONVENTIONS.md#bots-and-the-owners-machine)).

## 1. Research

### The directive's references

Each repository was cloned on 2026-11-14 and searched for `og:image`, `og:title`, `unfurl`, `link preview`, `oembed`, `react-tweet`, `syndication.twimg`, and `platform.twitter`.
- **eve** makes no previews in its own chat. Its Slack channel posts with `unfurl_links: false` and `unfurl_media: false` (`channels/slack/task-card.ts`, `api.ts`), and reads the previews Slack attaches to what a person sent, as text for the model (`inbound-content.ts`, "Keep inbound Slack link previews alongside the sender's message even when the link has surrounding text"). Its chat template draws a reply's links as plain anchors with `rel="noreferrer"` and `target="_blank"` (`eve-chat-template/.../markdown.tsx`).
- **react-tweet** ([vercel/react-tweet](https://github.com/vercel/react-tweet), MIT, 3.3.1), Vercel's, is the closest: an X post drawn natively from X's embed data, "preventing the need to include an iframe and additional client-side JavaScript". It reads `cdn.syndication.twimg.com/tweet-result` with a token made from the id (`api/fetch-tweet.ts`), and draws a header, the post it answers, the body with its links, media, the quoted post, the date, actions with **Copy link**, and replies (`twitter-theme/embedded-tweet.tsx`). 1,622 lines of components and CSS modules, with `swr` and `clsx`. Its client fetch goes to `react-tweet.vercel.app/api/tweet/:id` unless told otherwise, and its docs warn that server IPs "might get rate limited by Twitter", and to cache.
- **Pi, fx, OpenBot, OpenDuet, openmuse, OpenDots, agent-desktop, fx0, durable-harness, agent-browser, and herdr's three** have nothing on it. OpenBot's composer has the word "unfurls" for a panel opening, and Pi's sidebar CSS turns off a long press's link preview on a row.
- **Grok Bot's docs** say nothing of previews or how a post shows in a chat.

### Other chat apps

| App | Who fetches | Which links | What it shows |
| --- | --- | --- | --- |
| [Slack](https://docs.slack.dev/messaging/unfurling-links-in-messages) | Slack's servers, "must fetch every URL in a message" | every link, unless its label is part of the URL | OpenGraph and X card tags; a sender removes one while composing; "Consider disabling link unfurls when working with messages from an LLM in your app" |
| Discord | its servers, images through its media proxy | every link, unless written `<url>`, up to 5 | an embed; X posts mostly through FxTwitter's own embeds |
| [Mastodon](https://docs.joinmastodon.org/entities/PreviewCard/) | the server | one card a post | "a rich preview card that is generated using OpenGraph tags": `title`, `description`, `type` (`link`, `photo`, `video`), `provider_name`, `image`, `blurhash`, `published_at` |
| [Synapse](https://element-hq.github.io/synapse/latest/usage/configuration/config_documentation.html) (Matrix) | the homeserver, `/preview_url` | each the client asks for | off by default; turning it on needs `url_preview_ip_range_blacklist`, a list of private ranges; `max_spider_size` 10M; oEmbed providers |
| iMessage, Signal, WhatsApp | the sender's device | a message's first link | a card; a link alone in a message is the card, with no bubble |
| Telegram | its servers | the first link | a card, and Instant View for some sites |

Where they agree: one card for a link, from Open Graph with the page's `<title>` behind it, fetched by a server, never the reader's browser, with private addresses refused, and images through a proxy. A link that's the whole message is the card.

### Open Graph and what sites serve

- **[Open Graph](https://ogp.me):** `og:title`, `og:type`, `og:image`, and `og:url` required; `og:description` and `og:site_name` optional; `og:image:width`, `height`, and `alt`. "The first tag (from top to bottom) is given preference." X's card tags, `twitter:card` (`summary` or `summary_large_image`), `twitter:title`, `twitter:description`, and `twitter:image`, sit beside them on most sites.
- **Called on 2026-11-14 from this machine,** with `User-Agent: Mozilla/5.0 (compatible; fxbot/0.11; +https://fxbot.sh)` and `Accept: text/html`:

| Page | Answer | `</head>` at | Open Graph |
| --- | --- | --- | --- |
| a GitHub repository | 0.6–1.0 s | 28 KB | yes |
| Wikipedia | 0.2 s | 9 KB | yes |
| nytimes.com, bbc.com, vercel.com | 0.3–0.6 s | 9–186 KB | yes |
| fx.sh | 0.4 s | 5 KB | yes; with curl's `Accept: */*` it answered Markdown for agents, 1.5 KB, with none |
| an x.com post | 0.7 s | 8 KB | `twitter:*` tags, with the text |
| a YouTube video | 0.8–1.0 s | 800 KB to 1.3 MB | at 794 KB |
| reddit.com | 0.2 s | 2 KB | no: a shell page titled "Reddit" |
| news.ycombinator.com | 0.3 s | | no, only `<title>` |

So `Accept: text/html` matters, the `<head>` is enough for all but YouTube, and some sites answer a server with nothing worth a card. Those keep their bare link. The plugin says who it is and never poses as another crawler.
- **YouTube's oEmbed,** `https://www.youtube.com/oembed?url=<video>&format=json`, answered in 0.2 s with the title, the channel, and a thumbnail, so a YouTube link never reads the 1.4 MB page.

### X posts

- **X's embed data,** `https://cdn.syndication.twimg.com/tweet-result?id=<id>&token=<token>`, where the token is `((id / 1e15) * Math.PI).toString(36)` with zeros and the point removed, answered on 2026-11-14 in 0.2 s, about 1 to 4 KB: the text, `display_text_range`, entities, the author with `profile_image_url_https`, `mediaDetails` (photos, and a video's poster and `video_info.variants`), `video` with its `aspectRatio` and `poster`, `quoted_tweet`, `favorite_count`, `conversation_count`, and `created_at`. A deleted or hidden post answers `TweetTombstone` or `{}`, and one that never was a 404 page. The [X feed](plugin-x-feed.md) plan found a long post comes cut short there, and a limit of about 30 requests in 15 minutes on X's profile embeds.
- **FxTwitter,** `https://api.fxtwitter.com/status/<id>`, answered the same post in 0.2 s, with the long text in full. It's run by one maintainer, asks for a `User-Agent`, and has been down for weeks at a time this year ([X feed: FxTwitter](plugin-x-feed.md#fxtwitter)), so it's the second rung, never the only one.
- **X's own embed,** `widgets.js` and a frame from `platform.twitter.com`, loads X's scripts and cookies in the page. Its developer pages answered 402 here. react-tweet exists to avoid it.
- **Video:** `video.twimg.com`'s MP4s answer with `access-control-allow-origin: *` and `cross-origin-resource-policy: cross-origin`, 200 KB for a 9-second clip at 480p, so a `<video>` in the page plays one straight from X.
- **Images:** `pbs.twimg.com` takes `?name=small` (680 pixels) or `medium`.

### fxbot today

- **Markdown** is Streamdown 2.7.1 through `Markdown` in `plugins.tsx`, for a reply (`steps.tsx`), the library's preview, release notes, and `ui.Streamdown`, which pages and rooms use. Pages overrides `img` and `input`, rooms `mention`, so a `p` override reaches both.
- **Streamdown's own `p`** (`MarkdownParagraph`) already looks at the hast `node` of its only child, to leave an image or a code block unwrapped. `defaultComponents.p` is exported, so an override can hand every other paragraph back to it.
- **Streamdown's link safety** is on: a click on a link in a reply opens "Open external link?" with the address, **Copy link**, and **Open link**. fxbot passes no `linkSafety`.
- **A reply's last text** gets `isAnimating` while its turn runs; nothing else knows a paragraph is unfinished.
- **What the owner said** is plain text with `whitespace-pre-wrap`, in a bubble of the bot's color, drawn by `SaidText`. Links there aren't links today.
- **Tool results** show as plain text, and stay that way.
- **The page** has no Content-Security-Policy of its own. Web pairing's frame passes requests to other origins straight through its service worker (`frame/sw.ts`), and carries the page's own requests over the relay.
- **A plugin** has routes, a schema of its own from its migrations, the `instructions` hook (as mermaid uses), and page code that loads with the page.

## 2. Key takeaways

1. **Stand alone means its own paragraph or line.** In a reply, a paragraph whose only content is one link, bare or `[label](url)`. In what the owner said, a line that's only a URL. Lists of sources, links in a sentence, and tables stay links, so a bot's citations don't turn into a wall of cards.
2. **The card is the link.** One `<a href>` the size of the card means right-click and long press give the browser's own menu, copy included, with no menu of fxbot's to build.
3. **The server fetches, the browser doesn't.** Pages and their images come through the plugin's routes, so the owner's browser contacts no other site, a site's hotlink rules don't break a card, and web pairing works the same.
4. **Refuse private addresses, after DNS, on every redirect,** and connect to the address that was checked, as Synapse requires of whoever turns its previews on. A bot's link must not reach the owner's network.
5. **Read the `<head>`, not the page.** Stop at `</head>` or 1 MB, regex the `<meta>` tags, and fall back to `<title>`. No HTML parser and no dependency.
6. **X posts from X's embed data, then FxTwitter, then X's own card tags,** drawn by the plugin in the app's look, not react-tweet's copy of X's, and not X's scripts.
7. **Play only on a press.** X's video and YouTube load from their sites only when the owner presses play: that's the one moment the browser talks to them.
8. **Keep cards.** One row per link in the plugin's table, a week for a page and a day for a post, so reopening a chat costs one request to fxbot per card and none to the site.
9. **The core hook is general:** a link that stands alone, drawn by a plugin.

## 3. Implementation

### Core: `app.link`

In `packages/ui/src/plugins.tsx`:
- `Places` gains `links: { pattern: RegExp; Component }[]`, and setup gains `link(pattern, Component)`. The component gets `{ url, label, incomplete }`: the address, the link's own text when it isn't the address, and whether the text around it is still arriving.
- `useLinks()` picks, for a URL, the first loaded plugin whose pattern matches, in the order plugins were added, as `codeBlock` takes the first to claim a language. Each part is wrapped in `PluginPart`, with the plain link as its fallback.
- **In Markdown,** `Markdown` passes Streamdown a `p` component when any plugin claims links: a paragraph whose hast node has exactly one child element, an `a`, with only whitespace text beside it, and whose `href` is `http:` or `https:` and matches, draws the plugin's part. Every other paragraph, and every paragraph when nothing matches, is `defaultComponents.p`. A caller's own `components` win over it. `incomplete` is `Markdown`'s `isAnimating`, so a link in a reply still streaming stays a link until its text is done, and no half-typed address is fetched.
- **In what the owner said,** `Said` splits its text into lines: a line that's only a URL that a plugin claims is drawn by that plugin below the bubble, aligned to the owner's side, and leaves the bubble. If nothing else is left, there's no bubble, as in iMessage. Joined messages draw the same way.

About 45 lines. With no plugin claiming links, Markdown gets no `p` and `Said` draws as now. `app.said` stays as it is.

### The plugin

```
plugins/link-previews/
  plugin.json             name, version 0.1.0, minFxbot (the release with app.link), server, page, css, migrations
  package.json            "type": "module"
  README.md
  fxbot/migrations/0001_cards.sql
  fxbot/server.ts         the routes, the cache, and the line in each chat
  fxbot/fetch.ts          a guarded GET: checked addresses, redirects, limits
  fxbot/read.ts           a page's <head> to a card; X and YouTube
  fxbot/page.jsx          app.link, the card, the post, the player
  fxbot/page.js           page.jsx, built with rolldown
  fxbot/page.css          the look
```

No dependencies: Node's `http`, `https`, `dns`, and `net`, and the browser.

### Routes

- **`GET /card?url=<url>`** answers `{ kind, url, ... }` from the table or a fetch: `kind` is `page` (`title`, `description`, `site`, `image`, `large`), `image` (`image`, `width`, `height`), `post` (an X post, below), `video` (YouTube: `id`, `title`, `channel`, `image`), or `none`, when the page gave nothing worth a card. A `none` is kept too, so a site that answers nothing isn't asked again for a day. `cache-control: private, max-age=3600`.
- **`GET /image/<key>`** answers an image the plugin named in a card it made, by the sha256 of its address, from a row of `images`: it fetches it through the guard, checks its type is `image/png`, `jpeg`, `gif`, `webp`, or `avif`, and its size under 5 MB, and answers it with `cache-control: private, max-age=604800, immutable` and `content-security-policy: default-src 'none'`. It fetches nothing the plugin didn't name, so it's no proxy for any address. SVG is never answered.

Both answer only the owner, as every plugin route does.

### Fetching

`fetch.ts` is one function, `get(url, { accept, maxBytes })`:
- `http:` and `https:` only, on ports 80 and 443 only, with no user name or password in the address.
- **The address is checked after DNS.** `dns.lookup(host, { all: true })`, and every answer must be a public address: refused are `0.0.0.0/8`, `10/8`, `100.64/10` (which Tailscale uses), `127/8`, `169.254/16`, `172.16/12`, `192.168/16`, `198.18/15`, `224/4` and above, `::1`, `fc00::/7`, `fe80::/10`, multicast, and an IPv4 address mapped into IPv6. A bare IP in the link is checked the same way.
- **The connection goes to the checked address,** through `https.request`'s `lookup` option, so a name can't answer a public address to the check and a private one to the connection.
- **Redirects** are followed by hand, up to 5, each one checked again.
- **Limits:** 5 seconds in all, and `maxBytes`: 1 MB for a page, read until `</head>`, then the connection closes; 5 MB for an image.
- **Who it says it is:** `User-Agent: Mozilla/5.0 (compatible; fxbot/<version>; +https://fxbot.sh)`, `Accept: text/html,application/xhtml+xml` for a page, `Accept-Language` from the browser's first language, sent with the card request. No cookies.

### Reading a page

`read.ts`:
- A response of an image type is an `image` card.
- HTML is decoded by its `charset`, from the header or a `<meta charset>`, as UTF-8 otherwise, with `TextDecoder`.
- Each `<meta>` tag's `property` or `name` and `content` are read with one regex, and entities decoded (`&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#39;`, and numeric ones). The first of each wins, as Open Graph says.
- `title`: `og:title`, `twitter:title`, then `<title>`. `description`: `og:description`, `twitter:description`, `description`. `site`: `og:site_name`, else the host. `image`: `og:image`, `og:image:url`, `twitter:image`, resolved against the final address, `https:` only. `large`: `twitter:card` is `summary_large_image`, or the image is at least 600 pixels wide.
- Titles are cut at 200 characters, descriptions at 300.
- A page with no title but its host, and no image, is `none`.

### X posts

The pattern: `x.com`, `twitter.com`, `mobile.twitter.com`, `fxtwitter.com`, `fixupx.com`, `vxtwitter.com`, with `/<handle>/status/<id>`, `/i/status/<id>`, or `/i/web/status/<id>`, and anything after.

**The ladder,** for a card's `post`:
1. X's embed data, `tweet-result`, with the token. A tombstone or `{}` is an unavailable post.
2. FxTwitter's `/status/<id>`, when the first fails or comes back cut short (its `display_text_range` ends before the text does, or `note_tweet` is set).
3. The x.com page's `twitter:*` tags, through the page reader, as a `page` card.
4. An unavailable post is a small card, "This post is unavailable", with its address.

**One shape,** whichever answered: `id`, `url`, `author` (`name`, `handle`, `avatar`, `verified`), `text` with its links, mentions, and hashtags as ranges, `media` (up to 4, each a `photo` with `image` and `width` and `height`, or a `video` or `gif` with `poster`, `mp4` (the 640-wide variant, or the nearest under it), and `aspect`), `quote` (the same shape, one level, no media of its own past one image), `replyTo` (a handle), `created`, `likes`, `replies`. Every image address goes through `/image/<key>`; avatars ask `_normal` as `_bigger`, and photos `?name=small`.

### YouTube

The pattern: `youtube.com/watch?v=`, `youtu.be/`, `youtube.com/shorts/`, and `m.youtube.com`. The card comes from YouTube's oEmbed, a `video` with the title, the channel, and the thumbnail through `/image`.

### The page

`page.jsx` registers:

```js
app.link(/^https?:\/\/(?:www\.|mobile\.)?(?:x|twitter|fxtwitter|fixupx|vxtwitter)\.com\/(?:\w+|i(?:\/web)?)\/status\/\d+/i, Post);
app.link(/^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?|shorts\/)|youtu\.be\/)/i, Video);
app.link(/^https?:\/\//i, Card);
```

Each asks `/card` when it comes within 400 pixels of view, with an `IntersectionObserver`, and keeps answers in memory for the page's life. While it waits, and when the answer is `none` or fails, it's the plain link, styled as the app's links, so nothing jumps for a link that gets no card. A card that arrives reserves its media's height from `width` and `height`, so the chat doesn't jump as images load.

**The card, `page`:**
- One `<a href={url} target="_blank" rel="noopener noreferrer">`, the whole card, in `--card` with a 1px `--border` and `--radius`, at most 28rem wide.
- With `large`, the image across the top, 1.91:1, `object-fit: cover`. Without, a 4.5rem square at the right.
- The site's name in `--muted-foreground`, the title in two lines at most, the description in two, and the link's host last, in `--muted-foreground`. The host comes from the link itself, never from the page, so a card can't say it's another site.
- `label`, when a bot wrote `[label](url)`, shows above the title.

**The post, `post`:** one block in the same card style, the size of a phone's post:
- The avatar, round, the name, a small check when `verified`, `@handle`, and X's logo at the right, drawn inline.
- "Replying to @handle", when it answers one.
- The text, with links, `@mentions`, and `#hashtags` in `--primary`, as text, not links of their own, and `t.co` addresses shown as their `display_url`.
- Media: one image at its own shape, up to 16rem high; two to four in a grid. A video or GIF shows its poster and a play button; pressed, it becomes a `<video controls autoplay playsinline>` from the `mp4`, from `video.twimg.com`. A GIF loops, muted.
- The quoted post, in a smaller card inside, with its author and text.
- The date and time in the owner's zone, and replies and likes, shortened (`1.2K`).
- **The link:** the whole post is a link to it, as a stretched `<a>` behind the content, so right-click anywhere gives the browser's menu. The play button and the `<video>` sit above it.

**The video, `video`:** the thumbnail, 16:9, with a play button, the title, and the channel. Pressed, it becomes `<iframe src="https://www.youtube-nocookie.com/embed/<id>?autoplay=1" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" referrerpolicy="strict-origin-when-cross-origin">`. The rest of the card stays the link.

**The image, `image`:** the image, through `/image`, at most 20rem high, as a link to the address.

**The menu.** No menu of the plugin's own: the browser's on right-click, or the system's on a long press. Dragging a card drops its address, as any link does. A click opens it in a new tab, without Streamdown's "Open external link?": the card names the link's own host, which is what that dialog shows.

**Light and dark** come from the app's tokens, so they follow the system with no redraw. Text from a page or a post goes in as React text, never as HTML.

### Bots

**A line in each chat,** from the `instructions` hook, for bots the plugin is on for:

> A link on a line of its own in your reply shows as a preview card, and a link to an X post as the post. Put a link on its own line when the owner should see what it points to, one or two in a reply. Keep sources and lists of links inline, as they are.

No tool: a bot never sees a card, and doesn't need to.

### Data (`0001_cards.sql`)

In `plugin_link_previews`, which removing the plugin drops:
- `cards (url text primary key, card jsonb not null, fetched_at timestamptz not null)`. A `page`, `image`, or `video` card is fetched again after 7 days, a `post` after 1 day, a `none` after 1 day, each when it's next asked for: the old one answers meanwhile, and one fetch at a time runs for an address.
- `images (key text primary key, url text not null)`, written with each card.
- Rows not asked for in 90 days are removed, once a day.

### Cost

- **Loading the page:** the plugin's page code, about 10 KB gzipped, only when it's added. No request until a card is in view.
- **Sending a message and a reply:** nothing. Cards come once a reply's text is done.
- **A card:** one request to fxbot, answered from the table after the first time, and its images, which the browser keeps a week. The first time, one fetch from fxbot to the site, under a second for most.
- **Web pairing:** cards and images come over the relay, as the rest of the page does.

### Lists, docs, and the changelog

- `plugins-registry.json` lists `link-previews`, with its description and its how-to.
- A how-to, "Show links as previews", in `packages/website/src/content/docs/docs/how-to/`, in `src/sidebar.ts`: what stands alone, X posts and YouTube, how to copy a link, what fxbot fetches and from where, and that a link on the owner's own network gets no card.
- The plugins reference gains `app.link`, and the SDK's page API reference too.
- `CHANGELOG.md`, under `## Unreleased`: the plugin, and `app.link` for plugin makers. No core migration.
- The README's Phases line.

### Not in this phase

- **A preview while typing,** with a way to drop it before sending, as Slack and iMessage have.
- **More embeds:** Bluesky, Mastodon, GitHub issues and pull requests, Spotify, Vimeo, maps. Each is a pattern and a component through the same hook, by this plugin or another.
- **Cards in rooms' gateways,** such as Telegram and Discord, which make their own.
- **Cards in tool results,** which stay plain text.
- **Telling the bot what a link is.** A bot that wants a page reads it with a tool, as now.
- **A whole thread** from X: one post, and the one it quotes.

### Size

Core: about 45 lines in `plugins.tsx` and `app.tsx`. The plugin: `fetch.ts` about 90 lines, `read.ts` about 160, `server.ts` about 90, `page.jsx` about 280, `page.css` about 120, and a 12-line migration. If the plugin passes 900 lines before its CSS, or the core 80, stop and say why in the build notes.

## 4. Checklist

Checks run against a disposable fxbot, its own database and `FXBOT_DATA`, a mock model, and Chromium. Real sites are called only by the page reader's checks, a handful of times.

**Core: `app.link`**
- [ ] A probe plugin's `app.link(/example\.com/, Probe)` draws for a reply's paragraph that's only `https://example.com/a`, and for one that's only `[A](https://example.com/a)`, with `url` and `label`.
- [ ] It doesn't draw for that link in a sentence, a list item, a table, a heading, or a code block, and a paragraph with two links stays text.
- [ ] While the reply streams, `incomplete` is true for the last text and the link shows plain; when the turn ends it draws.
- [ ] In what the owner said, a message that's only the link draws the probe with no bubble; one with text and a line that's the link keeps the text in the bubble and the probe below it.
- [ ] A probe that throws leaves the plain link. With no plugin claiming links, a reply and a message draw as before, and Markdown gets no `p`.
- [ ] Pages' Markdown and a room draw it. `npm run typecheck` and `npm run build` pass.

**The plugin's server**
- [ ] `/card` answers a `page` for a GitHub repository, Wikipedia, and fx.sh, with title, description, site, image, and `large`, and `none` for reddit.com.
- [ ] It refuses, before connecting, `http://127.0.0.1/`, `http://localhost:8787/`, `http://192.168.1.1/`, `http://[::1]/`, `http://100.100.100.100/`, `http://169.254.169.254/`, a name that resolves to `127.0.0.1`, a public page that redirects to `http://127.0.0.1/`, and port 5432. Each answers `none`, and nothing reached the address (a listener on 127.0.0.1 sees no connection).
- [ ] It stops reading at `</head>` and at 1 MB, and gives up after 5 seconds, against a local test site reached through a check-only switch, never left in the plugin.
- [ ] An X post with a video, one with photos, one quoting another, a long one, and a deleted one each give the right `post` or the unavailable card. With the first rung made to fail, FxTwitter answers.
- [ ] A YouTube link answers a `video` from oEmbed, without fetching the page.
- [ ] `/image/<key>` answers only keys the plugin wrote, refuses SVG and a type that isn't an image, and stops at 5 MB.
- [ ] A second `/card` for the same link reads the table and fetches nothing. Removing the plugin drops its schema.

**The page**
- [ ] In Chromium, light and dark, at 1280 and 390 pixels: a page card, large and small, an image, an X post with photos, with a video that plays on a press, with a quote, and a YouTube video that plays on a press. Screenshots for the owner.
- [ ] Right-click on each gives the browser's link menu, and **Copy Link** copies the link's own address. A click opens a new tab.
- [ ] The page makes no request to another site until play is pressed (Playwright's request log).
- [ ] A link with no card stays the plain link, and nothing jumps when a card arrives.
- [ ] Through web pairing, a card and its image load.

**Bots**
- [ ] The line reaches a bot's instructions when the plugin is on for it, and not when it's off.

**The docs**
- [ ] The how-to, the README, `plugins-registry.json`, the page API reference, `CHANGELOG.md`, and the Phases line. `npm run build-site` passes. `git diff --check` is clean.

**Only a person can check**
- [ ] On the owner's phone, as a PWA: a long press on a card gives the system's menu with Copy, and an X video plays.
- [ ] The owner pastes a few links they use and an X post, and a bot answers with one on its own line: they look right.

## 5. Open questions

1. **Links on the owner's own network.** A link to a service on the owner's LAN or tailnet gets no card, so a bot's link can't reach them. A setting that allows the owner's own messages, and never a bot's, is possible: should it exist? Recommended: not in this phase.
2. **Playing from X and YouTube.** A press on play loads the video from X or YouTube in the owner's browser, the one time it talks to them. Is that right, or should a press open the post on X instead? Recommended: play in place.
3. **Which links in a reply.** Only a paragraph that's one link. Should a bot's `[label](url)` alone on a line be a card, or only a bare address? Recommended: both, since a bot writes labels.
4. **The name.** `link-previews`, as the plugin and the how-to say it. Or `embeds`?
5. **Streamdown's "Open external link?".** The cards skip it, since the card shows the link's host. Keep it for cards too?
