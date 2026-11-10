---
name: pages
description: Use when an answer would be long, such as a report, a comparison, research findings, a plan, or a guide, when the owner asks for something to keep, and before you write or change a page. When a page serves the owner better than a chat message, Markdown or HTML, and how to write, change, and keep one current.
---

# Pages

A page is something you write for the owner to read and keep, outside the chat. It's a document in your library, with every version. The owner opens it from a card in the chat, on a phone too, and can tick its boxes, print it, and come back to it later. You find it again with `library_search`, and read it with `library_read`.

## When to write one

Write a page without being asked when it serves the owner better than a chat message:

- The answer is long: more than about 400 words, or a few screens on a phone.
- It has a shape to scan: sections, a table, a comparison, steps.
- They'll come back to it: a plan, a guide, a checklist, research findings, a summary of a project.
- They asked for a report, a write-up, a document, or something to keep.

Answer in the chat instead when:

- A few sentences answer it, even if you looked up a lot to find them.
- It's a quick back-and-forth, or a question back to the owner.
- It's a short text they'll paste somewhere else, such as an email.
- They asked for it in the chat, or said they'd rather not have pages. Then keep to the chat in this conversation.

After you write one, say in the chat, in a sentence or two, what it covers, and anything they need to decide. Don't repeat the page: the card opens it.

## Markdown or HTML

Use `pages_write`, in Markdown, for almost everything: text, headings, tables, code, task lists, links, and images from your library. It's cheap to write, and to change in parts.

Use `pages_html` only for what Markdown can't do: a chart, filters or controls, a calculator, a page that keeps what the owner does on it, or numbers you'll send again later. It costs several times as much to write, any change rewrites all of it, you can't see how it looks, and when the owner has you ask first, it waits for their OK. Before your first one, read this skill's `references/html.md`, with the skill tool's `file`: it has the rules, the `fxpage` API, and a page to start from.

## Writing a good page

- **The title** says what it is in a few words, such as "Hosting offers compared". Leave it out of the text: the page shows it.
- **Lead with the answer.** The first lines give the conclusion, the recommendation, or what the page is for. The details follow.
- **Headings** every few paragraphs, so it scans on a phone.
- **Tables** for comparisons, with the same columns for each option. Keep cells short, since a phone is narrow.
- **Task lists** (`- [ ] Book flights`) for steps the owner will take. They get boxes the owner ticks, and `library_read` shows the ticks.
- **Sources** as links, `[its name](https://…)`, next to what they support. A link opens once the owner agrees.
- **Images** from your library, as `![what it shows](library:<id>)`, such as a screenshot you saved. Any other image shows as a link.
- **Dates** written out, such as "Tuesday 12 November", since the owner may read it weeks later. Say when you checked what changes, such as prices.
- **At most 60,000 bytes.** For more, write two pages, and link each to the other.
- **Diagrams:** with the mermaid plugin on, a ```` ```mermaid ```` block draws as a diagram, and your skill `mermaid` says how. Without it, a Mermaid block shows as code, so draw a diagram in an HTML page.

## Changing a page

- Read it first with `library_read`: the owner may have ticked boxes.
- For a small change, use `pages_edit`, with the exact text to replace. Several edits in one call save as one version.
- For a big change, use `pages_write` with its `library:<id>` and the whole text. Keep the owner's ticks.
- For an HTML page, use `pages_html` with its `library:<id>` and the whole document.
- Each turn keeps one version, so the owner can go back to before a request. Say in a sentence what changed.
- Only the bot that wrote a page changes it. Another bot can read it.

## Pages elsewhere

- **In a routine's run,** write a long result as a page, such as a weekly report, and say in your last message what's in it. The page goes to the owner with the result.
- **In a room, or a message to another bot,** link a page as `[its title](/pages/<id>)`.
- **As a subagent,** a long result can be a page. Give its `library:<id>` in your report.

## Numbers that change

For numbers you'll update, such as a dashboard a routine keeps current, write an HTML page that draws from its data, then send new data with `pages_data`. It costs far less than a rewrite. `references/html.md` says how.
