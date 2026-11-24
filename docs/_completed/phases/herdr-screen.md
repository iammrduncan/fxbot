# herdr screen

The sidebar's **herdr** button opens herdr itself: a real terminal in the page running herdr's own client, so herdr draws everything and handles everything, its scrollback, the wheel, the mouse, copy, its keys, and every agent and pane. An agent's tag, card, or row opens that one agent full size, with `herdr agent attach`.

Status: planned and built on 2026-11-23, for 0.11.0, at the owner's word, replacing the terminal [herdr terminals](herdr-terminals.md) built from `pane read` and `send-keys`. On that screen: "why do we have these? Shouldn't it just be a terminal? Why can i not scroll back in history like I can on a herdr pane?", then "why don't you do a real terminal with herdr running in it? let herdr itself handle everything? Why go through herdr read etc?" The owner chose the whole herdr screen and each agent's own, and that the door runs it whenever it's open, as it runs prompts. Where the build differs from the plan, [What the build changed](#what-the-build-changed) says so.

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

- [x] The helper runs `herdr` and `herdr agent attach` in herdr's check session: each draws, a typed `x` reached the stand-in agent, and herdr turns on the mouse and bracketed paste.
- [x] Through the socket, in Chromium on a desktop in light and a phone in dark, with non-GET writes blocked and no page errors: an agent attached draws at the page's size, herdr's pane 52 rows and the terminal 52; typing reaches it; a smaller window reaches herdr, 34 rows; a desktop has no key row, and a phone's row's Esc reaches the agent; and the sidebar's **herdr** opens the whole screen. The wheel was not checked by hand: xterm.js sends it as a mouse report, which herdr asks for.
- [x] The door, as a script against the check session: `terminal 24 90 w1:p1` attached, and a typed `7` reached the agent after the empty word. An old command, `agent get`, still answers. Read-only refuses `terminal`, and so do a shell pane, `--machine`, and a size of 0. `bash -n` passes on the door and `deploy/fxbot`.
- [x] `npm run typecheck`, with "fxbot's plugins fit 0.11.0", `npm run build-site`, where all 14,856 links in 125 pages resolve, and `git diff --check`.

## 5. Open questions

1. **Phone scrolling by drag:** recommended, as a wheel. herdr's client and Claude Code then scroll as they do for a mouse.

## What the build changed

- **The helper is `terminal.py`, run with `python3 -I`.** Named `pty.py`, it took the place of Python's own `pty` module, since a script's folder comes first on the path; `-I` leaves the folder off it too.
- **The door's connections last a day.** Its service had `RuntimeMaxSec=15min`, which would have ended a terminal at 15 minutes. The other commands keep their own limit, 630 seconds. A door opened before this keeps its 15 minutes until `sudo fxbot herdr on` runs again.
- **A door refusal ends the socket,** with its words as the close's reason, in place of JSON drawn in the terminal.
- **The pane's own variables go.** Dev's fxbot was started in one of herdr's panes, so herdr's client would have started inside it; `HERDR_PANE_ID` and its kin are left out of the helper's environment.
- **herdr's client reaches the owner's saved machines.** The whole screen, in the check session, connected to them over SSH, as the owner's own herdr does at start. It did nothing on them.
- **`herdr on`** now says it opens herdr's screen to fxbot's app, which can open a shell as herdr's user, with how to keep it shut, and says when herdr's user has no `python3`.
- **Mobile, at the owner's word:** "have a toggle at top for "mobile" mode for when I am on phone and need to confirm a screen, send text, etc..." A switch in each screen's header, on by default where the screen is touched and kept for each device, adds the keys a phone lacks, quick answers, 1, 2, 3, y, and n, and a line that **Send** types with Enter. Off, it's only the terminal. A key from the row doesn't focus the terminal on a phone, so the keyboard stays down. Checked in Chromium on a phone and a desktop: on and off by default, the line and an answer reaching the agent, and the choice kept across a reload.
- **xterm.js loads when a terminal shows.** It was most of herdr's page code, 661 KB in every page load. It's `fxbot/xterm.js` now, served gzipped at an address with the plugin's version, and loaded once a terminal opens. The computer's terminal does the same.
- **A close's reason is cut to 123 bytes, in whole characters (0.11.0, from its prep),** the most a WebSocket close carries. It was cut to 120 characters, so a long error, or herdr's last line in another script, ended fxbot.
- **A terminal opens again after time away (herdr 0.3.1, for 0.11.1),** at the owner's word: "Things get funky when app goes to sleep on web pairing and I open back to open herdr tab on an agent or full herdr screen, it doesn't pick back up where it was". A terminal whose socket closed showed "herdr's screen closed." over its last screen, and waited for **Connect again**. Web pairing closes every socket on its connection when it connects again, as after 30 seconds away, and a direct connection can end while a phone sleeps.
  - **Hidden, it closes; shown, it opens a new client,** which draws herdr as it is then, as a chat's stream does. A socket that ends with 1006, a dropped connection, or 1001, the plugin reloading, connects again by itself, up to five times, after 1, 2, 4, 8, and 16 seconds, saying "Connecting again…". herdr's client ending (1000), or a refusal, keeps its words and **Connect again**.
  - **fxbot's server pings each plugin socket every 30 seconds,** and ends one that didn't answer the last ping. A terminal from a device that went away without closing it kept herdr's client, and one of the eight places, until fxbot restarted. Over web pairing, the plugin's end of the connection does this already, when the device's connection closes.
  - **Not the cause, though first suspected:** that the app's shell, closing its peer connection to connect again, left the frame's sockets looking open. Chromium, Firefox, and WebKit all fire `close` on its channels then, checked with two local peers, so the frame's socket did end.
  - **Checked** on a check fxbot with herdr's check session. Directly, in Chromium: hidden closes herdr's client and shown opens one that draws; a plugin reload, and the server stopping and coming back, connect again by themselves; herdr's client ending waits for **Connect again**; a server that stays away stops after five tries, in 31 seconds. A client that answers no ping ended at 60 seconds, with its herdr client, and one that answers stayed. Over web pairing, against the relay under `wrangler dev` with 0.11.0's app, in Chromium, Firefox, and WebKit: the app back after 31 seconds, with herdr's page on screen and with it away, opens herdr again, and keys reach it. With 0.3.0's page, Chromium showed "herdr's screen closed." and took no keys.
  - **Not checked:** a real phone, and an agent's terminal on its own, which is the same component with `herdr agent attach`.
