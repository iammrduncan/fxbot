# mermaid

A plugin for [fxbot](https://fxbot.sh): the ```` ```mermaid ```` code blocks your bots write draw as diagrams.

- **Where you read them:** a bot's replies, Markdown pages, rooms, and a document's preview in the library.
- **In the app's own look.** Colors come from fxbot's own, and the font is the app's. Light and dark follow your system, with no redraw. On a phone, a wide diagram turns to run top to bottom.
- **It grows as the bot writes it.** While a reply streams, the diagram redraws as lines arrive, and an unfinished one never shows an error. One that can't draw ends as its code, with a line saying why.
- **Controls,** on hover, and always on a touch screen: show the code, copy it, download an SVG, and expand it full screen.
- **Bots know.** A line in each chat says diagrams draw. The skill `mermaid` says which diagram fits and how to write one that draws, and `mermaid_check` lets a bot try one before it sends it.

Add it from **Plugins**, on **Browse**. It runs inside fxbot: read its code there before you add it. It needs fxbot 0.9.0 or newer. See [Draw diagrams in chat](https://fxbot.sh/docs/how-to/draw-diagrams-in-chat/).

## How it draws

[Pele](https://pele.run), Obsidian's Mermaid renderer, draws each diagram. It reads Mermaid's syntax, every type in Mermaid 12.1.0, with its own layout and look. It turns no diagram source into scripts, event handlers, or HTML labels, and this plugin turns off its links and images and gives it no icons or math.

- **In a worker.** The page loads Pele from this plugin's route with the first diagram, and draws in a worker of its own. A render that takes over 3 seconds stops that worker, shows the diagram's code, and the next one starts another. One render goes at a time, and the last 50 are kept.
- **In the app's font.** The worker gets the app's font file from the page, so Pele measures labels in the font they show in. If it can't, both use `system-ui`.
- **Into a shadow root.** The SVG is read as SVG, which runs nothing, and kept to drawing elements, with no event handlers, links, or outside URLs, as a second check on Pele's output. In a shadow root, its styles apply only to it, and the app's colors reach it through Pele's CSS variables.
- **Its width.** Pele gets the card's width, in steps of 16 pixels, and lays the diagram out for it. Below 640 pixels, a wide one may turn to run top to bottom.
- **While streaming,** the newest text draws at most every 200 ms, and the last drawing that worked stays. An error shows only once the fence closes.

## The look

`page.css` sets Pele's variables on each card from the app's tokens: `--pele-bg` from `--card`, `--pele-fg` from `--card-foreground`, `--pele-muted` and `--pele-line` from `--muted-foreground`, `--pele-surface` from `--muted`, `--pele-surface-alt` from `--accent`, `--pele-border` from `--border`, `--pele-accent` from `--primary`, and `--pele-radius` from `--radius`. Charts' eight colors are the avatars' tones, deep in light and soft in dark. **Download** writes today's colors and the font onto the SVG, so it looks the same on its own.

## The tool

| Tool | What it does |
| --- | --- |
| `mermaid_check` | Draws a diagram on the server, as the page does, and answers what it drew, such as "Draws: flowchart, 6 nodes, 673 by 171 pixels", or Pele's error, with its line. It runs in a worker thread, ended after 3 seconds, and refuses source over 50,000 characters. `safe`, since it reaches nothing. |

## Cost

- **Idle:** nothing but a route. No process, no timer, and no table.
- **In a chat:** for each bot it's on for, a line in its instructions, about 70 tokens, and the skill's line in its list of skills, about 70. Every request of every bot carries `mermaid_check`'s definition, about 90 tokens, as every plugin's tools reach every bot. All of it is cached with the rest.
- **The page:** `page.js`, about 15 KB, with the app. Pele, 726 KB, 273 KB gzipped, with the first diagram, then from the browser's cache.
- **A diagram:** a few milliseconds of the worker for a small one, and again when its card's width changes.

## Files

| File | What it is |
| --- | --- |
| `plugin.json` | Its name and its parts |
| `fxbot/server.ts` | Pele's route, the line in each chat, and `mermaid_check` |
| `fxbot/check.js` | `mermaid_check`'s worker thread |
| `fxbot/page.jsx` | The worker, the card, and its controls |
| `fxbot/page.js` | `page.jsx`, built |
| `fxbot/page.css` | The look |
| `fxbot/pele.js` | Pele 1.12.0's `dist/pele.js`, unchanged |
| `fxbot/pele-LICENSE` | Pele's MIT license |
| `skills/mermaid/SKILL.md` | The skill |
| `package.json` | `"type": "module"`, for the server code |

## Pele

`fxbot/pele.js` is the file in Pele 1.12.0's npm package, unchanged, sha256 `111172ef3cfe3ab8fd58cba28f69e2c23f1d9f08c63db306fb9eb654a77de20b`. To take another version, from this folder:

```sh
v=1.12.0; t=$(mktemp -d)
curl -fsSL -o "$t/pele.tgz" "https://registry.npmjs.org/pele/-/pele-$v.tgz"
want=$(curl -fsSL "https://registry.npmjs.org/pele/$v" | node -p 'JSON.parse(require("fs").readFileSync(0)).dist.integrity')
[ "$want" = "sha512-$(openssl dgst -sha512 -binary "$t/pele.tgz" | base64 -w0)" ] && tar -xzf "$t/pele.tgz" -C "$t" \
  && cp "$t/package/dist/pele.js" fxbot/pele.js && cp "$t/package/LICENSE" fxbot/pele-LICENSE && sha256sum fxbot/pele.js
```

Take one that's been out two weeks, check that the skill's examples still draw with `mermaid_check`, and update the version and sha256 here.

## Build the page

`page.js` is `page.jsx` bundled with [rolldown](https://rolldown.rs), which comes with fxbot's packages. It bundles nothing else. Rebuild it after changing `page.jsx`, from this folder:

```sh
npx rolldown fxbot/page.jsx --format cjs -e react -e react/jsx-runtime -e @fxbot/app --no-comments --file fxbot/page.js
```

Commit both.
