---
name: browser
description: Use for a web page on your computer, to open it, read it, fill forms, click, and take screenshots, with the agent-browser command, on the desktop's Chromium that your owner sees.
---

# The browser

`agent-browser`, through `computer_shell`, drives the desktop's own Chromium, which your owner can watch. It starts Chromium the first time, and Chromium keeps its sign-ins. The commands here are from agent-browser 0.41.1, the one on your computer.

## On this computer

- Run `agent-browser <command>` as it is: it's connected to the desktop's Chromium already. Don't give it `--session`, `--cdp`, `--headed`, `--profile`, or `--engine`, or set `AGENT_BROWSER_SESSION`, and don't run `install` or `upgrade`. agent-browser's own guide says to start a session of your own: here, that's done for you.
- Leave the browser open when you're done. Don't run `agent-browser close`: your owner uses it too.
- As a subagent, your commands use a tab of your own. Stay in it.
- For a sign-in, a CAPTCHA, or a passkey you can't do yourself, call `computer_ask_owner`. Don't type a password you were given into a command, and don't save one with `agent-browser auth`.

## The loop

```bash
agent-browser open https://example.com   # go to a page
agent-browser snapshot -i                # what you can act on, each with a ref: @e1, @e2, …
agent-browser click @e3                  # act on a ref
agent-browser snapshot -i                # look again after anything changes
```

Refs come from the newest snapshot. After a page changes, take a new one before you use them.

## Reading

```bash
agent-browser read                       # the open page's text
agent-browser read https://example.com   # a page's text, fetched without the browser or its sign-ins
agent-browser snapshot -i -u             # with each link's address
agent-browser snapshot -s "#main"        # one part of the page
agent-browser get text @e5               # one element's text
agent-browser get url                    # also: get title, get value @e2, get attr @e6 href
```

`read <url>` is the cheapest way to read a public page, such as docs or an article.

## Acting

```bash
agent-browser fill @e2 "text"           # clear a field, then type
agent-browser type @e2 " more"          # type without clearing
agent-browser press Enter               # a key, or a combo such as Control+a
agent-browser select @e4 "Option"       # a dropdown, by value or label
agent-browser check @e3                 # a checkbox; uncheck too
agent-browser scroll down 500           # also up, left, right
agent-browser upload @e5 /root/file.pdf
agent-browser find role button click --name "Submit"   # by role and name, without a snapshot
agent-browser find label "Email" fill "me@example.com"
```

## Waiting

After a page changes, wait for what you expect, not for a time:

```bash
agent-browser wait --text "Order placed"
agent-browser wait --url "**/dashboard"
agent-browser wait @e7
agent-browser wait --load load
```

Don't wait for `--load networkidle` on a page that keeps a connection open, such as a chat or a dashboard: it may never come. A fixed `wait 2000` is a last resort.

## Screenshots

`agent-browser screenshot /root/shot.png` saves one, and `--full` takes the whole page. To see it, read it with `computer_read_file`. To give it to your owner, save it with `computer_to_library`. Read the page's text when you can: it's surer than a picture.

## Tabs

`agent-browser tab` lists the tabs, `tab new <url>` opens one, and `tab t2` switches to one. A ref belongs to its tab, so take a snapshot after you switch.

## When it goes wrong

- **"Ref not found", or a stale ref:** the page changed. Take a new snapshot.
- **A click does nothing:** a cookie banner or a dialog covers the page. Take a snapshot, close it, and try again.
- **An element isn't in the snapshot:** scroll, or wait for its text, then take a new snapshot.
- **A field won't fill:** `agent-browser focus @e1`, then `agent-browser keyboard inserttext "text"`.
- **A confirm or prompt dialog:** `agent-browser dialog accept`, or `dialog dismiss`.
- **Commands fail to connect:** `agent-browser doctor --offline --quick` says why.

## More

`agent-browser skills get core` has the rest: extracting data with `eval --stdin`, frames, network requests, and recording. `agent-browser <command> --help` has a command's flags.
