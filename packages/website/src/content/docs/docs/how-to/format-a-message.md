---
title: "Format a message"
description: "Type Slack's way, *bold*, _italic_, a quote, code, and lists, and the message box formats it as you go. What the bot gets is standard Markdown, and what you sent shows formatted."
---

The message box formats what you type, as Slack's does, in a bot's chat and in a room. What you send is standard Markdown, which is what a bot reads, and it shows formatted in your bubble. Since 0.12.0.

## Type it

| Type | You get | The bot gets |
| --- | --- | --- |
| `*bold*` | **bold** | `**bold**` |
| `_italic_` | _italic_ | `_italic_` |
| `~strike~` | ~~strike~~ | `~~strike~~` |
| `` `code` `` | `code` | `` `code` `` |
| `[the docs](https://fxbot.sh/docs)` | a link | `[the docs](https://fxbot.sh/docs)` |
| `>` and a space, at a line's start | a quote | `> ` before each line |
| ```` ``` ```` at a line's start | a code block | a fenced block |
| `-`, `*`, or `•` and a space, at a line's start | a bulleted list | `- ` before each item |
| `1.` and a space | a numbered list | `1. `, `2. `, … |

- **At a word's edge only.** `2 * 3 * 4`, `snake_case_name`, and `~/path` stay as you typed them.
- **Backspace** right after one puts back what you typed.
- **Inside code,** nothing formats.

## Use the keys

| Mac | Windows and Linux | Does |
| --- | --- | --- |
| Cmd+B | Ctrl+B | Bold |
| Cmd+I | Ctrl+I | Italic |
| Cmd+Shift+X | Ctrl+Shift+X | Strikethrough |
| Cmd+Shift+C | Ctrl+Shift+C | Code |
| Cmd+Shift+U | Ctrl+Shift+U | Link: asks for an address |
| Cmd+Option+Shift+C | Ctrl+Alt+Shift+C | Code block |
| Cmd+Shift+9 | Ctrl+Shift+9 | Quote |
| Cmd+Shift+8 | Ctrl+Shift+8 | Bulleted list |
| Cmd+Shift+7 | Ctrl+Shift+7 | Numbered list |
| Tab, Shift+Tab | Tab, Shift+Tab | Nest a list item, and take it back out |
| Cmd+Z | Ctrl+Z | Undo, formatting too |

Press one again to take it off.

## Use the format bar

1. Choose **Aa** beside the paperclip. On a phone, choose **+** first: **Aa** is in the row it opens, since `*`, `_`, and `` ` `` are hard to reach on a phone's keyboard.
2. The bar opens above the text: Bold, Italic, Strikethrough, Code, Link, Quote, Code block, and the two lists. Each says its key, and shows pressed where the caret is.
3. **Link** asks for an address, `https:` or `mailto:`. Press Enter to link the selected text, or to write the address in at the caret. An empty address takes a link off.

The bar stays open, in this browser, until you choose **Aa** again.

## Send, and start lines

- **Enter sends**, and Shift+Enter starts a new line, as before.
- **In a list or a quote,** Shift+Enter starts the next item or line. On an empty one, it leaves the list or quote.
- **In a code block,** Enter starts a line, so you can type code in lines. Enter on its empty last line leaves the block, and Cmd or Ctrl+Enter sends from anywhere in it.
- **On a phone,** Return starts a line, or the next item in a list, and the send button sends.

## Paste

- **Markdown you paste becomes formatting,** so `**this**` pasted shows bold, and sends as it was. That's only when the formatting sends exactly what you pasted. Anything else stays as you pasted it, as if you'd typed it, so a path such as `foo/__init__.py` never turns bold.
- **To paste it as plain text,** press Cmd+Shift+V, or Ctrl+Shift+V. Its markers are kept as text.
- **A link you paste** stays a link when it goes to a website, an email address, or a place in fxbot. Any other kind stays text.
- **An address pasted over selected text** links it.
- **In a code block,** a paste stays as it is.

## What you sent

What you sent shows formatted in your bubble, in the bot's color, with each line where you put it. So does what you wrote before: it was Markdown already. That means a line you once started with `# ` shows as a heading, and one that starts with `1. ` as a list.

The box doesn't format headings or tables as you type. Typed in Markdown, they're sent as you wrote them, and show in the bubble. There's no underline: Markdown has none.

With **Messages** added, a bot you tag is a chip in the line, bold in a bold line. In a room, the box and your words work the same way. See [Let bots work together](/docs/how-to/let-bots-work-together/) and [Talk with several bots in a room](/docs/how-to/talk-in-a-room/).
