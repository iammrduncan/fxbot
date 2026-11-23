# herdr screen

The sidebar's **herdr** button opens herdr itself: a real terminal in the page running herdr's own client, so herdr draws everything and handles everything, its scrollback, the wheel, the mouse, copy, its keys, and every agent and pane. An agent's tag, card, or row opens that one agent full size, with `herdr agent attach`.

Status: planned on 2026-11-23, at the owner's word, replacing the terminal [herdr terminals](../_completed/phases/herdr-terminals.md) built from `pane read` and `send-keys`. On that screen: "why do we have these? Shouldn't it just be a terminal? Why can i not scroll back in history like I can on a herdr pane?", then "why don't you do a real terminal with herdr running in it? let herdr itself handle everything? Why go through herdr read etc?" The owner chose the whole herdr screen and each agent's own, and that the door runs it whenever it's open, as it runs prompts.

## 0. Core or plugin

**The herdr plugin, and its door.** The page has xterm.js, as the computer's terminal does, over the plugin's own socket (`fx.socket`). No core change.

## 1. Research

- **The snapshot terminal can't scroll back.** The owner's Claude panes give 42 rows from `pane read --source recent --lines 3000`, their screen and no more, and herdr's own scrollback for them is empty (`max_offset_from_bottom: 0`): Claude Code keeps its history in its own full-screen view, which scrolls when herdr passes it the wheel. herdr's CLI has no way to pass the wheel. Only herdr's client does.
- **`herdr agent attach <pane>`** is herdr's own full-screen client for one agent. In a terminal it draws the agent's screen and turns on mouse reporting and bracketed paste. While it's attached, the agent's terminal takes its size, and when it leaves, the size goes back to the owner's herdr layout: measured in a check session, 39 rows with the owner's client, 20 while a 20-row attach was on, and 39 again after. herdr doesn't forward attaching with `--machine`.
- **`herdr`** with no command is the whole screen, the client of the session.
- **A terminal needs a pseudo-terminal,** with its size set and changed as the page's changes. Node has none built in, and a native module is a lot for a plugin to carry. Python's `pty` module, in Python 3 on the machine, does it in a few lines.
- **The computer's terminal** is xterm.js 6 with its fit addon, over a plugin socket: bytes both ways, and a text message `{"cols","rows"}` to resize.

## 2. Key takeaways

1. **herdr draws, and the page only shows it.** No reading, no key names: every byte goes both ways.
2. **One small helper** runs herdr's client in a pseudo-terminal, as herdr's user: the plugin's own in a checkout, and the door's in a release.
3. **The door's terminal is a shell as herdr's user,** since herdr's client can open a pane. The owner chose to open it with the door, and `--read-only` keeps it shut.

## 3. Implementation

### The helper

`fxbot/pty.py`, about 50 lines: it runs its arguments in a pseudo-terminal of the size given, writes what the terminal draws to its standard output, and reads framed input: a byte for the kind, four for the length, then the payload. Kind 0 is typed bytes, and kind 1 a new size, rows and columns. It ends with herdr's client.

### The plugin

- **`fx.socket("/terminal")`:** `?rows=&cols=`, and `&pane=` for one agent. Through the door: `terminal <rows> <cols> [<pane>]`, then the bytes. Directly: `python3 fxbot/pty.py herdr [agent attach <pane>]`. What the page sends goes in as typed bytes, and a text message `{"cols","rows"}` as a new size. At most 8 at once. Closing either side ends the other.
- **The screens:**
  - `/herdr`: the whole herdr screen.
  - `/herdr/agents`: the list, as now.
  - `/herdr/agents/local/<pane>`: that agent, attached.
  - An agent on another machine keeps today's screen, since herdr doesn't attach there.
- **On a phone,** a row above the keyboard has what a phone's keyboard lacks: Esc, Tab, Ctrl (held for the next key), and the arrows. A drag on the screen scrolls, as the wheel does. On a computer, the terminal is all there is.
- **`package.json`:** `@xterm/xterm` and `@xterm/addon-fit`, as the computer's, and `page.css` with xterm's styles.

### The door

- A command reads words up to an empty one, or the end, so a terminal's bytes can follow its words. The commands it had read the same.
- `terminal <rows> <cols> [<pane>]`: sizes from 1 to 500, and a pane that has an agent in it. Refused when read-only. It runs the helper, inline, with `python3` as herdr's user.
- `fxbot herdr on` says it opens herdr's screen to fxbot's app too, which can open a shell as herdr's user, and checks for `python3`.

### Not in this phase

- Attaching to an agent on another machine. That's `herdr --remote` later.

## 4. Checklist

- [ ] The helper runs `herdr` and `herdr agent attach` in the check session, draws, takes typed bytes, and a new size reaches the client.
- [ ] Through the socket, in Chromium on a desktop and a phone: the whole screen draws, typing reaches herdr, the wheel scrolls, and a new window size reaches the client. An agent's attach shows only that agent, and keys reach it.
- [ ] The door: `terminal` runs as herdr's user, a terminal's bytes follow its words, the old commands still answer, and read-only refuses it.
- [ ] `npm run typecheck`, `npm run build-site`, `git diff --check`.

## 5. Open questions

1. **Phone scrolling by drag:** recommended, as a wheel. herdr's client and Claude Code then scroll as they do for a mouse.
