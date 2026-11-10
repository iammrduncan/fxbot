---
name: desktop
description: Use for a desktop app on your computer, such as a file manager or an editor, and its windows, buttons, menus, and fields, with the agent-desktop command and its accessibility trees.
---

# Desktop apps

`agent-desktop`, through `computer_shell`, reads and works a desktop app through its accessibility tree, the structure the app exposes to screen readers. Every command prints one JSON answer: `ok`, then `data` or `error`. The commands here are from agent-desktop 1.1.0, on your computer's XFCE desktop.

## On this computer

- Start apps with `agent-desktop launch`, and Chromium only through `agent-browser`.
- For a web page, use `agent-browser`, not agent-desktop: its refs are the page's own.
- For the terminal window, use `computer_terminal`. agent-desktop can't type into a terminal.
- For what has no tree, such as a canvas, and for a double-click, a hover, or a drag, use `computer_desktop`. agent-desktop's actions don't move the pointer, so don't give it `--headed`.

## The loop

```bash
agent-desktop launch <app>                             # start an app
agent-desktop list-apps                                # the names --app takes
agent-desktop wait --window "<its title>" --app <name> # a window comes before its content
agent-desktop snapshot --app <name> -i --compact       # what you can act on, each with a ref
agent-desktop click @s8f3k2p9:e12                      # act on a ref, as it was printed
agent-desktop snapshot --app <name> -i --compact       # look again, to check it worked
```

For a big app, take a map first, then look into one part of it:

```bash
agent-desktop snapshot --skeleton --app <name> -i --compact
agent-desktop snapshot --root @s8f3k2p9:e3 -i --compact
```

`agent-desktop <command> --help` has each command's flags, such as `type`, `select`, `toggle`, `press`, and `scroll-to`.

## Refs

- A ref, such as `@s8f3k2p9:e12`, is good for the snapshot it came from. After the app changes, take a new snapshot.
- On Linux a ref works only when nothing identical is in the window. Two buttons alike answer `AMBIGUOUS_TARGET`: act on something unique beside them, or click the one you want with `computer_desktop`.
- `STALE_REF`: the element is gone or changed. Take a new snapshot.
- An action that opens a menu or a dialog lists it in `data.surfaces`. Look at it next, with `snapshot --surface menu --app <name> -i`.

## Before you try again

Each action's answer has a `disposition`. Try again only when its `retry` is `safe`. Anything else may have happened already, so a second try could click or type twice: look at the app first, then decide.

## When it goes wrong

- **A snapshot is empty:** run `agent-desktop status`. An empty `supported_surfaces` means the accessibility bus didn't answer, not that the desktop is empty.
- **The window is there, but not its content:** `agent-desktop wait --text "…" --app <name>`, for something you expect in it.
- **Two quick clicks on one button acted once:** wait for the first one's effect before the second.

## More

`agent-desktop skills get desktop workflows` has worked patterns for forms, menus, dialogs, and new windows. `agent-desktop skills get platform` has Linux's rules in full.
