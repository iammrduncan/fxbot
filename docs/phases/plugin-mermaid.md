# Mermaid

`mermaid` draws the diagrams a bot writes, in its reply, where the reader is:
- **A ```` ```mermaid ```` block draws as a diagram,** in a bot's chat, a Markdown page, a room, and the library's preview, in place of its code.
- **In the app's own look.** Colors come from fxbot's own tokens and the font is the app's. Light and dark switch with the system, live, with no redraw. On a phone a wide diagram turns to run top to bottom.
- **It grows as the bot writes it.** While the reply streams, the diagram redraws as lines arrive, and an unfinished one never shows an error. One that can't draw ends as its code, with a quiet line saying why.
- **A few controls:** **Code** shows the source, **Copy** copies it, **Download** saves an SVG, and **Expand** opens it full screen.
- **Bots know.** A line in each chat says diagrams draw, a skill says how to write one that does, and `mermaid_check` lets a bot try one before it sends it.
- **It's light, and nothing runs.** [Pele](https://pele.run), Obsidian's Mermaid renderer, draws it in a worker the plugin can stop, with no code from the diagram and no links or images. Its 273 KB, gzipped, loads with the first diagram, so a chat without one pays nothing.

Status: planned on 2026-11-10, from [issue #9](https://github.com/iammrduncan/fxbot/issues/9). Not built. Researched against the [research directive](../research-directive.md)'s references, the chat apps that draw Mermaid today, and the renderers that could do it.

## What the owner asked

"add mermaid output support to render in Chat inline... make it beautiful... make it an optional plugin..." (issue #9, 2026-11-03)

## 0. Core or plugin

**A plugin**, `mermaid` ([Core or plugin](../../CONVENTIONS.md#core-or-plugin)). Diagrams aren't what every bot needs, what plugins plug into, or what fxbot needs to run, and the owner asked for it optional. "A way to show a message" is a plugin's job in the conventions.

**One small core hook.** A plugin can't change how the app draws Markdown today:
- A bot's reply is drawn by the app's own `Streamdown`, in `packages/ui/src/steps.tsx`, with no plugins, so a ```` ```mermaid ```` block shows as code.
- `ui.Streamdown`, which pages and rooms use, is the same component.
- No place in the page API reaches a code block.

The smallest piece that closes it is **`app.codeBlock(language, Component)`**: a plugin draws the fenced code blocks of one language, wherever the app shows Markdown. It's Streamdown's own `plugins.renderers`, which the app passes to every Markdown it draws. It knows nothing of Mermaid, so a chart, a map, or music can use it later.

**Why not Streamdown's own Mermaid path** (`plugins.mermaid`, with `@streamdown/mermaid`):
- It runs mermaid.js in fxbot's page and puts its SVG in with `dangerouslySetInnerHTML`. Mermaid has had fifteen advisories since 2021, nine of them this year, and its 2025 XSS bugs fired while it laid a diagram out, before any clean-up of its output ([Renderers](#renderers)).
- `@streamdown/mermaid` 1.0.3 imports all of Mermaid 11 up front: 1.6 MB gzipped in the page.
- 2.7.1's error box is light red only, and flashes on an unfinished diagram while it streams.
- And a hook shaped like Streamdown's Mermaid plugin would tie the plugin API to it. `codeBlock` takes any component.

## 1. Research

### The directive's references

- **eve** (vercel/eve) is the only reference that draws Mermaid. Its chat and voice templates pass `@streamdown/mermaid` 1.0.2 to Streamdown 2.5.0, with `plugins = { cjk, code, math, mermaid }`, loaded with the page ([markdown.tsx](https://github.com/vercel/eve/blob/main/apps/templates/eve-chat-template/apps/web/components/chat/markdown.tsx)).
- **Pi** draws Mermaid as box art in the terminal, with `lovely-mermaid`, through a Markdown transformer. Its `markdown.mermaid` setting is `off`, `final`, or `streaming`, and `streaming` is the default. A diagram too wide for the terminal, or one it can't draw, falls back to the fence, and after streaming it warns "Mermaid diagram not rendered: …" ([mermaid.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/modes/interactive/components/mermaid.ts)).
- **OpenBot and OpenDuet** use Streamdown with only its code plugin, behind a wrapper that loads it lazily ([markdown.tsx](https://github.com/CopilotKit/openbot/blob/main/app/src/lib/markdown.tsx)). No Mermaid.
- **fx, openmuse, OpenDots, and the Grok Bot docs** have none. Grok's coding CLI, Grok Build, draws Mermaid as box art, and from 0.2.45 as an image when you choose **Open**.
- **agent-desktop, agent-browser, fx0, and durable-harness** have nothing on it.

### Other chat apps

| App | Where it draws | While streaming | On an error | Controls |
| --- | --- | --- | --- | --- |
| [Open WebUI](https://github.com/open-webui/open-webui/blob/main/src/lib/components/chat/Messages/CodeBlock.svelte) | inline, Mermaid loaded with `import()`, theme from the page's `.dark` | code until the fence closes | "Failed to render diagram: …" above the code | download SVG, reset, copy, pan and zoom |
| [LibreChat](https://github.com/danny-avila/LibreChat) | inline | the code, with a spinner; renders 500 ms after the last change, or 250 ms when it looks complete, keeping the last good one | only after more than 2 failures in a row, with **Retry** | code or preview, expand, copy, SVG, PNG, source, zoom |
| [LobeChat](https://github.com/lobehub/lobe-ui/blob/master/src/hooks/useStreamMermaid.ts) | inline, with **Pele** | redraws at most every 150 ms, keeping the last good one; "Rendering…" until the first | only once streaming ends: a message, then the source | |
| [T3 Code](https://github.com/pingdotgg/t3code/blob/main/apps/web/src/components/chat/MarkdownMermaidCodeBlock.tsx) | inline, `pele/lazy` | the code | the source | show code or diagram |
| [Obsidian 1.15.0](https://obsidian.md/changelog/2026-11-02-desktop-v1.15.0/) | in notes, with **Pele** in place of Mermaid, in the theme's colors, fit to the note, with zoom and pan when scaled down | | | "shown without asking first, since Pele can't run code" |
| [ChatGPT](https://community.openai.com/t/rendering-support-for-mermaid-code/1085642) | a **Preview** of the code block, by plan and device | not verified | not verified | split screen, full screen, image export |
| Claude.ai | diagrams as [artifacts](https://support.claude.com/en/articles/9487310-what-are-artifacts-and-how-do-i-use-them), beside the chat, and inline "visuals" in beta since 2026-03-12 | not verified | not verified | view code, copy, download |
| [GitHub](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/creating-diagrams) | in a frame from a separate origin, `viewscreen.githubusercontent.com` | | not documented | |
| [VS Code 1.109](https://code.visualstudio.com/updates/v1_109) | a `renderMermaidDiagram` tool the model calls | | | zoom, open in editor, copy source |

Where they agree: no error while it streams, keep the last good drawing, fall back to the source with a short reason, and a code or diagram switch. Gemini draws none without an extension.

**Bots get Mermaid wrong.** A lowercase `end` in a flowchart's text breaks it, a node id that starts with `o` or `x` after a link is read as an arrow, and punctuation in a label needs quotes ([flowchart syntax](https://mermaid.js.org/syntax/flowchart.html)). DIAGRAM-FAIL-BENCH found that documentation raises how many diagrams render, and that repairing from the error output closes most of the rest ([NeurIPS 2026](https://neurips.cc/virtual/2026/173008)). VS Code gives the model a tool for it.

### Renderers

**Mermaid itself** ([12.0.0](https://github.com/mermaid-js/mermaid/releases/tag/mermaid%4012.0.0), [12.3.0](https://github.com/mermaid-js/mermaid/releases/tag/mermaid%4012.3.0)):
- 12.3.0 is the newest, from 2026-11-03. 12.0.0 made ELK the default layout and the `neo` look with the `redux-color` theme the default, for Safari 17.4 and newer.
- Measured from 12.2.0's package: a 31 KB entry and 104 chunks, 5.4 MB in all, loaded per diagram type. A flowchart with ELK is 2.49 MB (751 KB gzipped), and with dagre 907 KB (253 KB gzipped). The single-file build is 5.5 MB, over a plugin file's 2 MiB.
- It lays a diagram out in the live document, measuring text there, so it needs a DOM.
- **Its advisories** ([security](https://github.com/mermaid-js/mermaid/security/advisories)): XSS twice in 2021 and twice in 2025 (sequence labels through KaTeX, and architecture icon text), CSS injected into the page in 2022 and 2026 (`classDef`, `fontFamily` and `themeCSS`, and `~` and `+` selectors that reach past the SVG), HTML escaping the SVG from a state diagram's `classDef`, prototype pollution, and endless loops in Gantt, XY, and radar charts. The last fixes came in 11.16.1.
- `securityLevel: "strict"` isn't a sandbox. In 12.3.0's code, HTML labels still pass through DOMPurify's default profile, and `click … href` links stay, run through sanitize-url. A diagram's frontmatter and `%%{init}%%` override `initialize()` for every key that isn't in `secure`.

**Pele** ([pele.run](https://pele.run), [obsidianmd/pele](https://github.com/obsidianmd/pele), MIT):
- "Pele supports every diagram type built into Mermaid 12.1.0", with its own layout and look. Its parsers are tested against Mermaid's parser specs and with differential fuzzing.
- Measured from 1.12.0: `dist/pele.js`, one ES module with every type and no imports, is 726 KB, 273 KB gzipped. `pele/lazy` loads types one at a time. No dependencies.
- `render(source, options)` is synchronous and needs no DOM. Text is measured with a canvas where there is one, `OffscreenCanvas` included, and with a built-in width table elsewhere.
- **What it draws** ([security](https://pele.run/security)): "It does not turn diagram source into scripts, event handlers, or HTML labels. JavaScript callbacks in click statements are ignored. Pele filters diagram styles." `links: false` and `images: false` turn off both. It limits the source to 50,000 characters, the SVG to 4,000,000, and a flowchart to 5,000 edges, and "for a time limit, render in a worker that your app can terminate". It puts in icon and math markup unfiltered, so an app that supplies none has none. Error messages carry diagram text, so they go in with `textContent`.
- **Its look** ([theming](https://pele.run/theming)): CSS variables, `--pele-bg`, `--pele-fg`, `--pele-muted`, `--pele-line`, `--pele-surface`, `--pele-surface-alt`, `--pele-border`, `--pele-accent`, `--pele-font`, `--pele-radius`, and `--pele-series-1` to `-8`, set on the SVG or anything around it. "Switch between light and dark colors without re-rendering the diagram."
- `maxWidth` lets a layout fit its width, and below 640 pixels a wide diagram may turn to run top to bottom. `idPrefix` keeps two diagrams' ids apart.
- It's young: 1.0.1 came on 2026-10-06, and 23 releases since. Obsidian 1.15.0, LobeChat, and T3 Code draw with it.

**Others:**
- **beautiful-mermaid** (Craft, MIT) draws 6 types to SVG or ASCII with no DOM, in themes of CSS variables. It needs elkjs, 1.6 MB, builds SVG with its own escaping and no sanitizer, and its styles `@import` Google Fonts.
- **mermaid-isomorphic, rehype-mermaid, and mermaid-cli** run headless Chromium on the server.

### fxbot today

- **Markdown** is Streamdown 2.7.1: in `steps.tsx` for a reply, `library.tsx` for a document's preview, `release.tsx` for release notes, and `plugins.tsx`, which gives it to plugins as `ui.Streamdown`. Pages draws a Markdown page with it, and rooms each message. None passes `plugins`.
- **Streamdown's `plugins.renderers`** draws a fenced block of a language with a component of the app's, given `code`, `language`, `meta`, and `isIncomplete`, true while the fence is still open. Its code-block component checks a renderer before its own Mermaid path (`node_modules/streamdown/dist/chunk-7TTQLYRW.js`). Pages overrides only `img` and `input`, and rooms `mention`, so a renderer reaches both.
- **The page API** (`plugins.tsx`) has `route`, `sidebar`, `nav`, `composer`, `toolView`, `settings`, `botSettings`, `botPanel`, `libraryItem`, `chat`, `box`, `fold`, `said`, and `slot`, each part in an error boundary, `PluginPart`. None touches Markdown.
- **A plugin's files:** fxbot serves only its page code and CSS (`plugins.ts`, `file()`); a route serves the rest. An install keeps text files up to 2 MiB each and 20 MB in all, and every plugin from fxbot's list downloads the repository's archive, 9 MB today.
- **The look:** shadcn's neutral tokens in `oklch()`, dark mode from `prefers-color-scheme` alone, the font Geist Variable, and `--radius` 0.625rem. The avatars' colors are `tones` in `blob-data.ts`.
- **Pages' skill and README** say a Mermaid block shows as code, so a bot draws a diagram in an HTML page.
- **Web pairing** serves the page through a service worker in its frame, and writes sandboxed frames in as `srcdoc`, since those don't pass through a service worker. A worker made from a blob needs no request.

## 2. Key takeaways

1. **Pele, not mermaid.js.** The same diagram syntax at a seventh of the size, with no DOM, no code from the diagram, no HTML labels, and links and images off. Mermaid would need a sandboxed frame and an image to be safe, and couldn't follow the app's colors live.
2. **Draw in a worker, with a time limit.** A diagram that never finishes would freeze the page each time its chat opened. A worker keeps the page responsive, and the plugin stops it.
3. **Put the SVG in a shadow root.** Pele's output has no script, but its styles would apply to the whole page. A shadow root keeps them to the diagram, and CSS variables still reach it, so the app's tokens color it.
4. **The app's tokens are the theme.** `--pele-*` set from `--card`, `--foreground`, `--border`, and the rest, in the plugin's CSS, with the app's font, so dark mode needs no redraw.
5. **Grow while streaming, never fail mid-stream.** Redraw the newest text at most every 200 ms, keep the last good drawing, and show an error only once the fence closes: the code, and one quiet line, in the app's colors.
6. **Few controls:** code, copy, download, and expand.
7. **Teach the bot, and let it check.** A line in each chat, a skill with the traps, and a tool that draws a diagram on the server and answers the error, since repair from the error is what works.
8. **Load nothing until a diagram shows.** Pele comes vendored, from the plugin's own route, never a CDN, on the first diagram.
9. **The core hook is general:** a code block of a language, drawn by a plugin.

## 3. Implementation

### Core: `app.codeBlock`

In `packages/ui/src/plugins.tsx`:
- `Places` gains `codeBlocks: { language: string; Component }[]`, and setup gains `codeBlock(language, Component)`, which keeps the language in lowercase.
- A `Markdown` component wraps Streamdown. It reads the loaded plugins' code blocks, the first plugin to claim a language drawing it, and passes them as `plugins.renderers`, after any a caller passes. Each is wrapped in `PluginPart`, with the plain code block as its fallback, so a plugin that throws leaves the code. The list is memoized on the loaded plugins, since Streamdown is memoized.
- The component gets `code`, `language`, `meta`, and `incomplete`, from Streamdown's `isIncomplete`.
- `steps.tsx`, `library.tsx`, and `release.tsx` draw with `Markdown`, and `ui.Streamdown` is `Markdown`, so pages and rooms get it unchanged.

About 30 lines. With no plugin claiming a language, Streamdown gets no `plugins`, as now.

### The plugin

```
plugins/mermaid/
  plugin.json          name, version 0.1.0, minFxbot 0.9.0, server, page, css
  package.json         "type": "module"
  README.md
  fxbot/server.ts      the route for Pele, the line in each chat, and mermaid_check
  fxbot/check.js       a worker thread that draws one diagram with Pele, for mermaid_check
  fxbot/page.jsx       codeBlock("mermaid"), the worker, the card, and its controls
  fxbot/page.js        page.jsx, built with rolldown
  fxbot/page.css       the look
  fxbot/pele.js        Pele 1.12.0's dist/pele.js, unchanged
  fxbot/pele-LICENSE   its MIT license
  skills/mermaid/SKILL.md
```

**Pele, vendored.** `fxbot/pele.js` is the file in Pele 1.12.0's npm package, the newest release two weeks old on 2026-11-10 (1.13.0 is from 2026-10-31). The README has the command that fetches it, checks the package's `integrity` against npm's, and copies the file, and the file's sha256. One file serves the page's worker and the server's check.

**The route.** `GET /pele.js` answers the file, gzipped when the request accepts it, made once when the plugin loads, as `text/javascript`, with `cache-control: public, max-age=31536000, immutable`. The page asks for it with `?v=<plugin version>`.

### Drawing

`page.jsx` registers `app.codeBlock("mermaid", Diagram)`.

**One worker for the page, started with the first diagram:**
1. The page fetches `pele.js` through `app.api`, so web pairing's service worker carries it, and makes it a blob URL.
2. It makes a module worker from a second blob, which imports `render` and `PeleError` from the first and answers each message `{ id, code, width, font }` with `{ id, svg, width, height }` or `{ id, error }`.
3. **The font.** The page finds the app's font file in its own stylesheets, the `@font-face` for `Geist Variable`, fetches it, and hands the bytes to the worker, which adds it to `self.fonts`. Pele's canvas measurer then measures labels in the font they're shown in. If that fails, the worker says so, and it measures, and the diagram shows, in `system-ui`.
4. Each render passes `links: false`, `images: false`, `idPrefix` of its own, `maxWidth` of the card, `fontFamily`, and no `icons`, `math`, or `config`. Pele's own limits stand: 50,000 characters of source, 4,000,000 of SVG, and 5,000 edges.
5. **The time limit.** A render that hasn't answered in 3 seconds ends: the plugin terminates the worker, shows that diagram's code with "This diagram took too long to draw", and starts a new worker for the next.

One render goes at a time, the newest text for each diagram winning. Results are kept by source, width, and font, the last 50, so a chat that opens again doesn't redraw.

**Putting it in.** The card is a host element with a closed shadow root. The SVG is parsed with `DOMParser` as `image/svg+xml`, which runs nothing, and walked once: an element outside SVG's drawing elements, `foreignObject`, `script`, `a`, `image`, and `use` among those left out, and any `on…` attribute or `href` are removed, as a second check on Pele's output. Then it goes into the shadow root. Its `<style>` applies only there. The `--pele-*` variables, set on the host, reach in.

**Width.** A `ResizeObserver` on the card redraws, 150 ms after its width changes, with the new `maxWidth`, so a phone gets Pele's narrow layout and a wide window the source's direction.

### The look

`page.css` sets, on `.mermaid-card`:

| Pele's | From |
| --- | --- |
| `--pele-bg` | `--card` |
| `--pele-fg` | `--card-foreground` |
| `--pele-muted`, `--pele-line` | `--muted-foreground` |
| `--pele-surface` | `--muted` |
| `--pele-surface-alt` | `--accent` |
| `--pele-border` | `--border` |
| `--pele-accent` | `--primary` |
| `--pele-font` | the font the worker measured with |
| `--pele-radius` | `calc(var(--radius) - 2px)` |
| `--pele-series-1` to `-8` | eight of the avatars' colors, from `tones` in `blob-data.ts`, the middle of each body, and a deeper stop in dark |

The tokens change under `prefers-color-scheme`, so the diagram follows with no redraw. The card itself is the app's: `--card` behind, a 1px `--border`, `--radius`, and room around the diagram, centered, at most its natural width. The build compares a set of diagrams, in light and dark, at 1280 and 390 pixels, against Pele's own defaults, and the owner looks at them before it's done.

### Streaming and errors

- **While the fence is open** (`incomplete`), the card redraws the newest text at most every 200 ms, and keeps the last drawing that worked. Before the first one, it shows "Drawing a diagram…", quietly, at the height of a small diagram. An error then shows nothing.
- **Once the fence closes,** it draws once more. If that fails, the card shows the code, in the app's code style, and one line under it, in `--muted-foreground`, "This diagram didn't draw: " and Pele's message, put in with `textContent`.
- **A message that never finishes,** such as a stopped turn, keeps its last drawing, and its **Code**.

### Controls

Small icon buttons at the card's top right, shown on hover and focus, and always on a touch screen (`@media (hover: none)`). Lucide's paths, drawn inline, as the plugin bundles no icon set:
- **Code** switches between the diagram and its source, `aria-pressed`.
- **Copy** copies the source.
- **Download** saves `diagram.svg`, with the current values of the `--pele-*` variables and the font written into its `<style>`, so it looks the same on its own.
- **Expand** opens a full-screen dialog, the app's `ui.Dialog`, with the diagram at its natural size, scrolling both ways, and Pele's `enableZoom`.

The diagram is `role="img"`, named by its title, or by its type, such as "Flowchart". Pele writes a `<title>` and `<desc>` into the SVG.

### Bots

**A line in each chat,** from an `instructions` hook, for bots the plugin is on for:

> Your replies and Markdown pages draw ```mermaid code blocks as diagrams. Draw one when a picture explains it better than words: a process, the steps between people or systems, a structure, states, or a timeline. Keep it small. Your skill mermaid says how to write one that draws, and mermaid_check tries one before you send it.

**The skill, `mermaid`:**
- when a diagram helps, and when a list or a table is better
- which type for what: `flowchart`, `sequenceDiagram`, `stateDiagram-v2`, `classDiagram`, `erDiagram`, `gantt`, `timeline`, `mindmap`, `pie`, and `xychart-beta`, each with a short example that draws
- the traps: quote a label with punctuation (`A["Step (1)"]`), no lowercase `end` as text, ids that start with `o` or `x` after a link, one statement a line, `-->` and `->>` in the right diagrams
- what fxbot ignores: frontmatter and `%%{init}%%` looks, colors, and fonts, links, images, icons, and math
- size: under about 25 nodes, or 15 messages; on a phone a wide flowchart turns to run top to bottom
- that the owner sees the code and the error when one doesn't draw, and to fix it when they say so

**`mermaid_check`** (`safe`, `idempotent`): "Try a Mermaid diagram before you send it. Answers what it drew, such as 'Draws: a flowchart, 6 nodes', or why it doesn't." `fxbot/check.js` runs Pele in a worker thread, with the width table, and the server ends it after 3 seconds. Source over 50,000 characters is refused.

### Pages and other plugins

- **Pages:** a Markdown page draws its diagrams, prints them, and **Copy** copies the Markdown. The `pages` skill's line becomes: "A Mermaid block draws as a diagram when the mermaid plugin is on, and shows as code otherwise." Its README says the same.
- **Rooms** draw them in each bot's message.
- **The library** draws them in a Markdown document's preview.
- **An HTML page** is its own document, and draws its own.
- **Subagents' threads and routines' results** are replies, so they draw too.

### Cost

- **Idle:** nothing but the route. No process, no timer.
- **In a chat,** for each bot it's on for: the line in its instructions, about 90 tokens, the skill's line in its list, about 60, and `mermaid_check`'s definition, about 80, on every bot, as every plugin's tools are, cached with the rest.
- **The page:** `page.js`, about 10 KB, with the app. Pele, 273 KB gzipped, with the first diagram, then from the browser's cache.
- **A diagram:** one render in the worker, a few milliseconds for a small one (measured in the build), and again when the card's width changes.
- **Install:** `pele.js` adds 726 KB to the repository, about 273 KB to the archive each plugin install downloads.

### Not in this phase

- Diagrams in what the owner types.
- Icons (`fa:…`) and math (`$$…$$`) in labels: both need markup Pele puts in unfiltered.
- Links and images in diagrams.
- PNG export, and copying a diagram as an image.
- A **Fix** button that puts the error in the message box.
- Checking a reply's diagrams by itself at the turn's end.

### What changes

- **Core:** `plugins.tsx` (`codeBlock`, `Markdown`), and `steps.tsx`, `library.tsx`, and `release.tsx` drawing with `Markdown`.
- **The plugin:** `plugins/mermaid/`, and its entry in `packages/sdk/src/plugins-registry.json`, with `docs`.
- **Pages:** its skill's line and README.
- **Docs:**
  - `app.codeBlock` in the plugin API reference's page-code table, since 0.9.0
  - a how-to, "Draw diagrams in chat", listed in `src/sidebar.ts`
  - `CHANGELOG.md` under Unreleased
  - the README's Phases list and `AGENTS.md`, once built
- No migration, no setting, and nothing in `plugin-breaks.json`, since nothing is removed.

### Size

About 30 lines of core. The plugin's own code: about 250 lines of page code, 70 of server, 20 of the check's worker, and 80 of CSS, with the skill and README. `pele.js` is vendored, not written.

## 4. Checklist

Each box is something that ran, by hand or by a script, against a disposable fxbot and the mock model.

**M1. The hook**
- [ ] `app.codeBlock` draws a probe plugin's component for ```` ```probe ```` in a reply, a Markdown page, a room message, and the library's preview, and gets `code`, `language`, `meta`, and `incomplete`, true while it streams.
- [ ] With no plugin claiming `mermaid`, a block shows as code, as before.
- [ ] A component that throws leaves the plain code block, and the rest of the reply.
- [ ] `npm run typecheck` and `npm run build` pass.

**M2. Drawing**
- [ ] `pele.js` is 1.12.0's file, with the sha256 in the README; the route answers it gzipped, `immutable`, and the page fetches it only once a diagram shows.
- [ ] A flowchart, sequence, state, class, ER, Gantt, timeline, mindmap, pie, and XY chart each draw in Chromium, with their labels inside their shapes, in Geist.
- [ ] With the font's file blocked, a diagram draws in `system-ui`, its labels still inside their shapes.
- [ ] A diagram that takes too long ends at 3 seconds with its code and "took too long", the page answers throughout, and the next diagram draws.
- [ ] Source over 50,000 characters shows its code and Pele's limit.
- [ ] A chat with twenty diagrams opens again with no new renders.

**M3. The look** (Playwright, light and dark, at 1280 and 390 pixels)
- [ ] The card and the diagram use the app's tokens, and switching the color scheme changes them with no new render.
- [ ] A wide `flowchart LR` turns top to bottom at 390 pixels, and back when the window widens.
- [ ] The controls show on hover and focus, and on a touch screen; **Code**, **Copy**, **Download**, and **Expand** each work, and the downloaded SVG looks the same opened on its own.
- [ ] Screenshots of the set, against Pele's own defaults, are looked at, and the owner agrees.

**M4. Streaming and errors** (the mock model, writing a diagram slowly)
- [ ] The diagram grows as lines arrive, never shows an error before the fence closes, and keeps its last drawing.
- [ ] A diagram that can't draw ends as its code and one quiet line, in both schemes, and a label with `<b>` in its error shows the tag as text.
- [ ] A stopped turn keeps its last drawing.

**M5. Hostile diagrams** (Playwright, with every request logged)
- [ ] `click A href "javascript:…"`, `click A call alert()`, `<img src=x onerror=…>` in a label, a `classDef` and `style` with `}`, `~`, `+`, and `@import`, frontmatter and `%%{init}%%` setting `themeCSS` and `fontFamily`, and `![](https://…)` images: nothing runs, nothing is requested, the page's own styles don't change, and the shadow root holds no `a`, `image`, `foreignObject`, or `on…` attribute.

**M6. Bots**
- [ ] The line is in the instructions of a bot the plugin is on for, and not of one it's off for.
- [ ] The skill loads, and each of its examples draws.
- [ ] `mermaid_check` answers "Draws: …" for a good diagram and Pele's error for a bad one, and ends one that takes too long at 3 seconds, with fxbot answering throughout.

**M7. Other places**
- [ ] A Markdown page draws its diagram, and prints it; a room and the library's preview draw theirs.
- [ ] Pages' skill and README say diagrams draw with the plugin on.

**M8. Docs and checks**
- [ ] The plugin API reference, the how-to, the plugin's README, the registry entry, and `CHANGELOG.md` are written.
- [ ] `npm run typecheck`, `npm run build`, `npm run build-site`, and `git diff --check` pass.
- [ ] What only a person can check is listed: Safari and Firefox, a phone, web pairing, and real models' diagrams.

## 5. Open questions

Each has a default the build takes.

1. **Pele or Mermaid itself.** *Default:* Pele, for its size, its live theming, and drawing no code. If exact Mermaid matters more, Mermaid 12 runs in a sandboxed frame and shows as an image, at 5.5 MB, with colors fixed at drawing and a redraw when the scheme changes.
2. **In Essentials.** *Default:* no. It's optional, as asked, and listed in **Browse**.
3. **`mermaid_check`.** *Default:* yes. It costs one tool definition a request, and a call for each diagram a bot checks.
4. **The accent.** *Default:* the app's neutral `--primary`. The bot's own color would tie a diagram to its bot, but a code block doesn't know whose reply it's in.
5. **Pele's version.** *Default:* 1.12.0, the newest two weeks old today. 1.13.0 is two weeks old on 2026-11-14.
