# Input Markdown: format a message as you type, as in Slack

The message box formats what the owner types, as Slack's does, and what they sent shows formatted in the chat.

- **Type it, see it.**
  - `*bold*`, `_italic_`, `~strike~`, and `` `code` `` turn into formatting as you type them.
  - So do `>` at the start of a line for a quote, ```` ``` ```` for a code block, and `- ` or `1. ` for a list.
  - Backspace right after one undoes it.
- **Slack's keys:**
  - Cmd+B bold, Cmd+I italic, Cmd+Shift+X strike, Cmd+Shift+C code.
  - Cmd+Alt+Shift+C code block, Cmd+Shift+9 quote, Cmd+Shift+8 and Cmd+Shift+7 lists.
  - Cmd+Shift+U adds a link, and pasting an address over selected text makes it one.
  - On Windows and Linux, Ctrl stands for Cmd.
- **A format bar,** behind an **Aa** button beside the paperclip, and in the **+** row on a phone, where `*`, `_`, and `` ` `` are hard to reach.
- **Sending stays as it is.** Enter sends and Shift+Enter starts a line. In a list or a quote, Shift+Enter starts the next item. In a code block, Enter starts a line. On a phone, Return starts a line and the send button sends.
- **What the bot gets is standard Markdown,** the text it reads today: `**bold**`, `_italic_`, `~~strike~~`, and so on. Bots, drafts, and the `$` skill list see text, as before.
- **What the owner sent shows formatted,** in the bot's color, as a bot's reply does. In a room too.
- **Every box,** the app's own, Messages' box with its bot chips, and a room's with its mentions, through one copy of ProseMirror that the app shares with plugins. An owner with Messages and chat rooms loads about 98 KB less than today.

Status: planned on 2026-11-26 at the owner's word, not built.
- **References:** each one in the [research directive](../research-directive.md) that has a repository was cloned and searched for its chat box on 2026-11-26.
- **Slack and other apps:** Slack's help center, and Discord's, Element's, Telegram's, GitHub's, and Linear's boxes, were read on 2026-11-26.
- **Editors:** ProseMirror, TipTap, Lexical, and CodeMirror were bundled and measured on 2026-11-26.
- Nothing of it has run in a browser.

## What the owner asked

"add basic markdown support to the input chat box, just like slack formatting so I can do block quotes inline code etc... plan this out phase input-markdow." (2026-11-26)

## 0. Core or plugin

**Core, in the page: the app's box, and how it draws what the owner said. Messages and chat rooms each change their box to use what the app shares.**
- **The box is core's.** A bot's chat, and the box the owner types in, are the app's. `MessageBox` is the app's textarea, and `Said` draws the owner's words. Bots' replies are Markdown, drawn by core's `Markdown`, and this makes the owner's side match.
- **A plugin can't do it.**
  - **One box at a time:** `app.box` gives the box to the first plugin that sets one. Messages sets one, so a formatting plugin would have to take over Messages' chips too.
  - **Not in rooms:** a room's box is chat rooms' own, and no place reaches it.
- **Core behavior goes through what plugins get,** as the conventions ask ([Core or plugin](../../CONVENTIONS.md#core-or-plugin)). So the app gives its ProseMirror and the formatting to plugins' page code, through the `require` it already gives React by, and to `@fxbot/app`.
  - Messages' and chat rooms' boxes use them and stop bundling ProseMirror of their own.
  - The plugin API only gains, so there's no line in `plugin-breaks.json`. The two plugins raise their `minFxbot`.
- **No server, SDK, or migration change.** What's sent is text, as now.

## 1. Research

### In fxbot today

- **Three boxes, all text.** What the owner types goes to the bot as plain text. When they write Markdown, it's Markdown already. Nothing in a box shows it formatted.
  - **The app's box** is a textarea, `MessageBox` in `packages/ui/src/plugins.tsx` (an `InputGroupTextarea`), in a bot's chat in `app.tsx`. Enter sends and Shift+Enter starts a line. On a touch screen, `(pointer: coarse)`, Enter starts a line and Cmd or Ctrl+Enter sends.
  - **Messages' box,** `plugins/messages/fxbot/box.jsx`, takes its place through `app.box`. It's ProseMirror, so a tagged bot is a chip. To the app it acts as a textarea: `value` is the text, with each chip a Markdown link, plus `selectionStart` and `setSelectionRange` for the app's `$` skill list.
  - **A room's box** is chat rooms' own ProseMirror editor, `plugins/chat-rooms/fxbot/composer.jsx`. It has an `@` list and a `/` list, and writes each chip as its token, `<@bot:…>`.
- **Each plugin bundles its own ProseMirror** into its `page.js`, unminified.
  - **Messages' page** is 90 KB gzipped. Built without ProseMirror, it's 7.5 KB.
  - **Chat rooms'** is 94 KB, and without it, 10.8 KB.
  - Measured on 2026-11-26, with ProseMirror's modules left out of the same rolldown command.
- **What the owner said is drawn as plain text.**
  - **In a bot's chat,** `Said` in `app.tsx` draws it in the bot's color with `whitespace-pre-wrap`, through `SaidText`. That draws plugins' `said` patterns, Messages' and herdr's `[@name](…)` tags, as chips.
  - **In a room,** chat rooms' `Owned` draws it the same way.
- **What a bot says is Markdown,** drawn by Streamdown (`Markdown` in `plugins.tsx`, and `ui.Streamdown` for plugins). A room draws its bots' words with each mention as a `<mention>` tag, which Streamdown draws as a chip (`tagged` in chat rooms' `page.jsx`).
- **Drafts, the skill list, and sending read the box's text.** `drafts.ts` keeps it in `localStorage`. `skill-picker.tsx` reads the text and the caret's offset. A send clears it, and a plugin's `setDraft` writes it.
- **The page hands plugins their modules** with a `require` that gives `react`, `react/jsx-runtime`, and `@fxbot/app`, and refuses anything else (`plugins.tsx`, `run`).
- **The app's main chunk** is 1,240 KB, or 376 KB gzipped.

### Slack

From Slack's help center, read on 2026-11-26:
- [Format your messages](https://slack.com/help/articles/202288908-Format-your-messages)
- [Use markup to format your messages](https://slack.com/help/articles/360039953113-Use-markup-to-format-your-messages)
- [Keyboard shortcuts](https://slack.com/help/articles/201374536-Slack-keyboard-shortcuts)
- [How Slack formats message text](https://docs.slack.dev/messaging/formatting-message-text), from its developer docs

What it does:
- **A toolbar,** on unless **Aa** hides it: Bold, Italic, Underline, Strike, Code, Block quote, Code block, Ordered list, Bulleted list. A link comes from Cmd+Shift+U. What you see is formatted before you send.
- **It converts as you type:**
  - `*bold*`, `_italic_`, `~strike~`, and `` `code` ``, at word boundaries
  - ```` ``` ```` at the start for a code block, and `>` for a quote
  - `1.` and `*` with a space for lists
  - Tab to nest a list
- **Pasted text stays plain,** until Cmd+Shift+F, "Apply markdown formatting".
- **Keys:**
  - Cmd+B, I, and U.
  - Cmd+Shift+X strike, Cmd+Shift+U link, Cmd+Shift+9 quote, Cmd+Shift+C code, Cmd+Alt+Shift+C code block.
  - Cmd+Shift+8 and 7 for lists.
  - Cmd+Z undoes formatting.
- **"Format messages with markup"**, in Preferences › Advanced, turns all of that off: no toolbar, formatting only after sending, plain pastes, and no automatic lists.
- **Enter sends and Shift+Enter starts a line.** In a quote or a list, Shift+Enter starts the next line or item. A setting, "When typing code with ```, Enter should not send," makes Enter start a line in a code block. Its default isn't documented: two third-party posts describe it.
- **On a phone,** the **Aa** toolbar. Only bold, italic, strike, and code can be typed as symbols there, and Return adds a line.
- **What it sends** is mrkdwn, Slack's own, where `*x*` is bold. In CommonMark, the Markdown bots read, `*x*` is italic.

### Other apps

| App | Box | Formats as you type | Toolbar | Editor |
| --- | --- | --- | --- | --- |
| Discord | its own | a preview that keeps the markers, a setting | on selecting text | not published |
| Element Web | plain text, editable | no: Markdown converted on sending | a bar on selecting text writes markers | its own, with commonmark; a rich editor (Rust, as WebAssembly) behind a labs flag |
| Telegram Web | rich | keys and selection, yes; typed Markdown on sending (`src/components/chat/input.ts`) | on selecting text | its own |
| GitHub | a textarea | no: Write and Preview tabs | yes | [markdown-toolbar-element](https://github.com/github/markdown-toolbar-element) |
| [Linear](https://linear.app/docs/editor.md) | rich | yes | on selecting text, and `/` | ProseMirror, by reports |
| ChatGPT | ProseMirror | no, by public reports | no | ProseMirror |

Discord's and Claude.ai's editors, and whether ChatGPT and Claude.ai format as you type, couldn't be checked without signing in.

### The directive's references

None of them formats in its chat box:
- **A textarea:** eve (AI Elements' `PromptInputTextarea`, `apps/templates/openinstinct/web/components/ai-elements/prompt-input.tsx`), fx's examples, fx0 (`components/composer.tsx`), durable-harness (`packages/demo-ui/src/Composer.tsx`), agent-browser's dashboard (`packages/dashboard/src/components/chat-panel.tsx`), and openbot and OpenDuet (CopilotKit's `CopilotChatInput`).
- **Pi** has its own plain-text editor, 697 lines, with file pills, composition and undo handled, and Safari before 18.4 in mind (`apps/p2/plugins/chat/draft-editor.tsx`). The draft stays a string.
- **OpenMausBot** has a textarea with a copy of its layout behind it, which draws mentions (`src/components/MentionTextarea.tsx`).
- **OpenDots'** chat is a textarea. Its pages use TipTap with `@tiptap/markdown` (`src/client/editor/RichEditor.tsx`).
- **openmuse** uses React Native's `TextInput`.
- **agent-desktop and herdr's three** have no chat box.

### Editors, measured

The smallest setup each needs, for inline formatting, a quote, a code block, lists, links, Slack's typed rules, and Markdown out. Each was bundled minified with rolldown and esbuild, then gzipped, on 2026-11-26:

| Setup | Minified | Gzipped |
| --- | --- | --- |
| ProseMirror as Messages' box ships it (state, view, model, commands, keymap, history) | 204 KB | 63.4 KB |
| …with `prosemirror-inputrules`, `prosemirror-schema-list`, Slack's rules and keys, and a hand-written Markdown reader and writer | 218 KB | 68.2 KB: **4.8 KB more** |
| …with `prosemirror-markdown` instead, which always loads markdown-it | 326 KB | 112 KB |
| TipTap, with only what's needed | 440 KB | 140 KB |
| Lexical, with its Markdown, rich text, lists, and code | 301 KB | 97 KB |
| CodeMirror 6 with `@lezer/markdown`, the text styled in place | 311 KB | 101 KB |
| A textarea with Slack's keys, no editor | 1.5 KB | 0.7 KB |

The hand-written reader and writer were tested in Node, and none of these ran in a browser.

### On an iPhone

- **A textarea** keeps the keyboard's autocorrect, dictation, and input methods as they are.
- **ProseMirror has open issues:**
  - formatting while a word is still being composed, as with autocorrect or an input method (#1215, #1395)
  - the caret hidden behind the keyboard (#1417)
  - TipTap's iPad freeze (#7514), and Backspace in a list (#5753)

  Messages' box is ProseMirror already, and it's on in the owner's fxbot, which they reach from their iPhone, so these aren't new to the app.
- **Lexical** fixed many iPhone bugs from September to November 2026, with a regression (#9751) and dictation (#6940) still open.
- **CodeMirror** turns autocorrect, capitals, and spelling off by default, and a chat box has to turn them back on.
- **The marks are hard to reach.** On the iPhone's keyboard, `*`, `_`, and `~` are on the symbol pages, and `` ` `` takes a long press. So a phone needs the bar, as Slack's has.

### Markdown's flavor

- **Bots read CommonMark with GitHub's additions,** where `*x*` and `_x_` are italic, `**x**` is bold, and `~~x~~` is struck.
- **A rich box can take Slack's typing and still send standard Markdown:** the rule turns `*x*` into bold, and the writer writes `**x**`.
- **One trap:** reading the box's text as Markdown turned `2 * 3 * 4` into italics, and escaping every marker sends `2 \* 3`. Both ways need the word-boundary rule CommonMark itself uses.

## 2. Key takeaways

1. **ProseMirror, shared.**
   - The formatting costs 4.8 KB gzipped on top of the ProseMirror Messages' box ships today. Every other editor is 30 to 75 KB more.
   - Two of fxbot's own plugins each bundle ProseMirror, about 83 KB of their pages.
   - One copy in the app, given to both through `require`, makes every box format and makes the page lighter for an owner who has either plugin.
2. **The text stays the truth.** The box acts as a textarea, as Messages' box does. Its `value` is Markdown, read and written by about 200 lines of the app's own, so drafts, the skill list, plugins' `setDraft`, and what bots read keep working on text.
3. **Slack's typing, Markdown's text.** Typed `*x*` is bold, as in Slack, and what's written is `**x**`, so bots and the chat read it as the owner meant.
4. **The bubble has to match.** Without drawing the owner's words as Markdown, formatting would show as markers after sending.
5. **A bar on a phone.** Slack's own phone app has one.
6. **Don't take the keyboard's habits away.** Enter and Return keep doing what they do. The bar and the keys add, and the box keeps autocorrect and dictation on.

## 3. Implementation

### The formatting (`packages/ui/src/formatting.ts`)

About 250 lines, the app's own, on ProseMirror:
- **The schema's parts,** for any box to build its schema from, with chips of its own:
  - **Blocks:** `paragraph`, `blockquote`, `code_block` (text only, no marks), `bullet_list`, `ordered_list`, and `list_item`.
  - **Marks:** `strong`, `em`, `strike`, `code`, and `link`. `code` excludes the others.
  - Underline is left out: Markdown has none, so Cmd+U does nothing.
- **Slack's rules,** with `prosemirror-inputrules`, each at a word boundary, so `2 * 3 * 4` stays as typed:
  - **Bold:** `*text*` and `**text**`.
  - **Italic:** `_text_`.
  - **Strike:** `~text~` and `~~text~~`.
  - **Code:** `` `text` ``.
  - **A link:** `[text](https://…)`.
  - **Blocks, at a line's start:** `> ` a quote, ```` ``` ```` a code block, and `- `, `* `, or `• ` a bulleted list. `1. ` starts a numbered list.
  - **Undo:** Backspace right after a rule fires puts back what was typed (`undoInputRule`).
- **Slack's keys,** each `Mod-` (Cmd on a Mac, Ctrl elsewhere):
  - **Marks:** `Mod-b`, `Mod-i`, `Mod-Shift-x`, `Mod-Shift-c`.
  - **Blocks:** `Mod-Alt-Shift-c`, `Mod-Shift-9`, `Mod-Shift-8`, `Mod-Shift-7`.
  - **A link:** `Mod-Shift-u` opens the bar's address field.
  - **In a list:** Tab and Shift+Tab nest and unnest.
  - **Undo:** `Mod-z`, from `prosemirror-history`.
  - **Pasting an address** over selected text makes it a link.
- **Enter:**
  - **In a code block,** Enter starts a line. Enter on its empty last line leaves the block. Cmd or Ctrl+Enter sends from anywhere.
  - **In a list or a quote,** Shift+Enter starts the next item or line, and on an empty one leaves the list or quote.
  - **Everywhere else,** the box's own Enter, as today: the app's handler sends, and on a touch screen Enter starts a line.
- **`toMarkdown(doc, chips)`** writes the doc as standard Markdown:
  - **Lines:** each paragraph a line, joined by `\n`, as the boxes' text is today.
  - **Quotes:** `> ` before each line.
  - **Code blocks:** fenced, with a longer fence when the code holds one.
  - **Lists:** `- ` and `1. `, with two spaces for each level.
  - **Marks:** `**`, `_`, `~~`, `` ` `` (longer when the code holds a backtick), and `[text](url)`.
  - **Escapes:** a marker that would otherwise format, by CommonMark's boundary rule, gets a `\`. So do a line's leading `>`, `#`, list marker, or fence.
  - **Chips:** each written by the box's own `chips` function, as its link or token.
  - With `{ caret: pos }`, it writes only up to the caret and leaves open marks open, for the offset the skill list reads.
- **`fromMarkdown(text, schema, chips)`** reads the same subset back:
  - fences, quotes, and lists
  - code spans first, then links, then `**`, `__`, `*`, `_`, and `~~` by the same boundary rule
  - escapes
  - the box's chips, by its pattern, before the rest of a line

  Anything else stays text. The text the box wrote reads back the same, which a Node check holds over a list of cases.
- **A registry** from each box's DOM to its `EditorView`, added by the formatting's plugin. So the format bar works on whichever box is there.

### The app's box (`packages/ui/src/editor.tsx`)

About 140 lines: `MessageBox`'s own box, in place of the textarea, built from the formatting with no chips.
- **It acts as the textarea did,** as Messages' box does:
  - `value`, `onChange` with `{ target: { value, selectionStart } }`, `onKeyDown`, `onPaste`, `onFocus`, and `onBlur`.
  - `placeholder`, `disabled`, and `aria-*`.
  - Its `ref` has `selectionStart`, `value`, and `setSelectionRange`.

  So `app.tsx`'s sending, the skill list, drafts, and pasted files work unchanged.
- **The keyboard keeps its habits:** `autocorrect`, `autocapitalize`, and `spellcheck` stay on. The box grows with its text up to its height today, and **Make the box tall** still works.
- **A plugin's box still takes its place** through `app.box`, and falls back to this one if it throws.

### The format bar (`packages/ui/src/format-bar.tsx`)

About 80 lines.
- **The button:** **Aa** beside the paperclip, with `aria-pressed`, on a computer. On a phone it's in the **+** row.
- **The bar** opens above the box, and this browser keeps whether it's open.
- **Its buttons:** Bold, Italic, Strike, Code, Link, Quote, Code block, Bulleted list, and Numbered list.
  - Each says its key in its title, and shows pressed where the caret is.
  - **Link** opens a field for the address, `https:` or `mailto:`.
- **Which box it works on:** the box's view, found through the registry. A plugin's box built with the formatting gets the bar too.
- **For plugins:** it's `ui.FormatBar` too, given a `view`, for a box the app doesn't place, as a room's.

### What the owner said (`app.tsx`)

`Said` draws the owner's words as Markdown, with core's `Markdown`, in place of plain text: about 40 lines.
- **Plugins' patterns still draw:**
  - **Hiding them from Markdown:** each match of a plugin's `said` pattern, outside code, becomes a `<said-part>` tag first, as chat rooms does with its mentions. The match itself is kept aside.
  - **Drawing them:** the tag is drawn by that plugin's part, in its error boundary.
  - Skill chips at the start stay as they are.
- **A line break is a line break,** by a 10-line remark step like `remark-breaks`, as the owner typed it.
- **In the bot's color:**
  - code and code blocks on a lighter wash of white
  - a quote with a white bar
  - links underlined in white
  - a folded message, a plugin's, keeps its grey
- **Links** open as Streamdown's do, asking before another site opens. Raw HTML stays out, as in replies.

### Plugins get ProseMirror (`plugins.tsx`)

- **What `require` gives:** besides React and `@fxbot/app`, the app's own `prosemirror-model`, `prosemirror-state`, `prosemirror-view`, `prosemirror-transform`, `prosemirror-commands`, `prosemirror-keymap`, `prosemirror-history`, `prosemirror-inputrules`, and `prosemirror-schema-list`.
  - A plugin built with those left out (`-e prosemirror-state` and so on) shares the app's copy.
  - A plugin that bundles its own keeps working.
- **`@fxbot/app` gains `formatting`:**
  - `nodes` and `marks`
  - `plugins(schema)`, for the rules, keys, and registry
  - `toMarkdown`, `fromMarkdown`
- **`ui` gains `FormatBar`.**
- **When it loads:** ProseMirror and the formatting are a chunk of their own. It's fetched as the page starts, beside the plugins' bundles, so it adds no round trip, and it's there before a box or a plugin's code needs it.

### Messages' box (`plugins/messages/fxbot/box.jsx`)

About 30 lines change:
- **The schema** is the formatting's `nodes` and `marks`, with its `tag` chip.
- **`textOf`** is `toMarkdown`, with `linkOf` for chips. **`docOf`** is `fromMarkdown`, with `anyTag`.
- **The plugins** gain `formatting.plugins(schema)` before its own keys. Its `@` list's keys still come first.
- **The build** leaves ProseMirror out, per its README. Its `package.json` loses ProseMirror, and its `minFxbot` goes up to the release this ships in.

### A room's box and its words (chat rooms)

- **`composer.jsx`:** the same change as Messages', with its mention chip and token, and `ui.FormatBar` above the box. About 40 lines.
- **`Owned`:** draws the owner's words with the room's `Markdown`, through `tagged`, as it draws its bots' words. About 5 lines.
- **The build:** ProseMirror left out, its `package.json` without it, and its `minFxbot` up.

### What the owner sees

- **In a bot's chat:**
  - The box formats as they type, and **Aa** opens the bar.
  - What they sent shows formatted in their bubble. So does what they said before, since it's Markdown already.
- **In a room:** the same.
- **Text that was always there** now draws as Markdown too. A line that starts with `# ` is a heading, and `1. ` a list. That's what Markdown means, and what bots already read.

### Docs, when it's built

- **A new how-to, `how-to/format-a-message.md`,** listed in the sidebar: what to type, the keys, the bar, Enter in a list and in code, and pasting.
- **[Bots and chats](../../packages/website/src/content/docs/docs/explanation/bots-and-chats.md)'s Sending line:** formatting, and Enter in a code block.
- **The plugin API reference, Page code:**
  - the modules `require` gives
  - `formatting`, and `ui.FormatBar`
  - `app.box` and formatting
- **Messages' and chat rooms' READMEs:** the build command.
- **`CHANGELOG.md`, under `## Unreleased`:** the feature, and under For plugins, the modules and `formatting`.
- **The README:** this entry in Phases, and this doc's "What the build changed".

### Size

- **The app:**
  - `formatting.ts`: about 250 lines.
  - `editor.tsx`: about 140.
  - The format bar: about 80.
  - `Said`: about 40.
  - `require` and `@fxbot/app`: about 20.
- **Plugins:** Messages about 30 lines, chat rooms about 45.
- **What loads, gzipped:**
  - **The app:** 68 KB more, in a chunk of its own: ProseMirror at 63.4 KB, and the formatting.
  - **Messages' page:** from 90 KB to about 8 KB.
  - **Chat rooms' page:** from 94 KB to about 11 KB.
  - **In all:** an owner with both loads about 98 KB less than today, with Messages only about 15 KB less, and with neither 68 KB more.
- **Packages:** `prosemirror-inputrules` and `prosemirror-schema-list` added to the app. The rest of ProseMirror moves there from the plugins.

### Not in this phase

- **Slack's markup mode,** formatting only after sending. One way of typing is enough.
- **Underline.** Markdown has none.
- **Headings and tables in the box.** Typed, they're sent as Markdown and draw in the bubble, but the box doesn't format them.
- **Editing a sent message.**
- **Minifying plugins' pages,** about 20 KB gzipped more off Messages'. It's a build change of its own.

## 4. Checklist

- [ ] `formatting.ts`, with a Node check:
  - [ ] Every rule and key's Markdown out.
  - [ ] `2 * 3 * 4`, `snake_case_name`, and `~/path` stay as typed.
  - [ ] Escapes.
  - [ ] Text the box wrote reads back the same, over a list of cases with chips of both kinds.
- [ ] The app's box, in Chromium on the disposable check fxbot, with its non-GET requests to its own API only:
  - [ ] Each rule converts as typed, and Backspace after it undoes it.
  - [ ] Each key.
  - [ ] Enter sends.
  - [ ] Shift+Enter in a list and a quote.
  - [ ] Enter in a code block.
  - [ ] Cmd+Enter sends from a code block.
  - [ ] A pasted address over a selection becomes a link.
  - [ ] The skill list still opens on `$` and inserts.
  - [ ] A draft comes back formatted after a reload.
  - [ ] A pasted file still attaches.
- [ ] What the bot got is the Markdown the box wrote, read from the chat's stream.
- [ ] The format bar on a computer and in the **+** row on a phone, each button, pressed states, and the link field.
- [ ] `Said` draws Markdown:
  - [ ] Messages' and herdr's tags still draw as chips, and one inside code doesn't.
  - [ ] Line breaks are kept.
  - [ ] Light and dark, in each bot color.
- [ ] Messages' box, rebuilt with the app's ProseMirror:
  - [ ] Its chips and `@` list work as before.
  - [ ] Formatting works, with chips in a formatted line.
  - [ ] Its `page.js` is about 8 KB gzipped.
- [ ] A room's box and words:
  - [ ] Mentions and `/fresh` work as before.
  - [ ] Formatting works.
  - [ ] What the owner sent shows formatted, with its chips.
  - [ ] Its `page.js` is about 11 KB gzipped.
- [ ] A plugin built with its own ProseMirror still loads and works: Messages' current `page.js`, against the new app.
- [ ] The app's page weight measured before and after, with neither plugin, with Messages, and with both.
- [ ] **On the owner's iPhone,** through web pairing:
  - [ ] Typing with autocorrect and dictation.
  - [ ] The bar.
  - [ ] Return.
  - [ ] Sending.
  - [ ] A list's Backspace.

  This is the owner's to tick, as headless Chromium has no iPhone keyboard.
- [ ] The docs listed above.
- [ ] The repo checks:
  - [ ] `npm run typecheck`, `npm run build`, `npm run build-site`, and `git diff --check`.
  - [ ] Both plugins' `page.js` rebuilt and committed, with their licenses.
  - [ ] The app and each plugin committed on the open release branch, each on its own.
- [ ] Dev updated: `npm run build` for web pairing's copy of the page, and each plugin's files landed in one write.

## 5. Open questions

- **Paste.** Slack keeps pasted text plain until Cmd+Shift+F. Should pasted Markdown become formatting instead, as Linear does? Since the box's text is Markdown, reading a paste as Markdown sends exactly what was pasted. Pasted as plain text, its markers would be escaped. Recommended: read it as Markdown, with Cmd+Shift+V pasting it plain.
- **Enter in a code block.** Slack sends on Enter unless a setting says otherwise. Should Enter start a line inside a code block, with Cmd or Ctrl+Enter, or Enter on an empty last line, to finish? Recommended: yes, a line, so code can be typed in lines.
- **The page's weight.** An owner with neither Messages nor chat rooms loads 68 KB more, gzipped, in return for formatting in the app's own box. Both plugins are in Essentials, so most owners load less than today. Is that trade right? The other way keeps the textarea, with Slack's keys only and the markers showing, unless one of the plugins is added. Recommended: the shared ProseMirror.
