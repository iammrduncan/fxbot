# computer

A plugin for [fxbot](https://fxbot.sh): each bot gets a Linux computer of its own, a Debian machine where it is root, with a desktop you watch and take over, a terminal, Chromium, and files that last.

- `computer_shell` runs one bash command, with a deadline, and keeps both ends of long output. `agent-browser` drives Chromium from it, and `agent-desktop` reads and drives desktop apps by their accessibility trees.
- `computer_terminal` types into the terminal, the tmux session `main`, and reads its screen, for programs that ask and wait.
- `computer_desktop` clicks, types, scrolls, and drags by the screen's pixels, then takes a screenshot.
- `computer_read_file` reads text a page at a time, or an image, which the bot sees.
- `computer_write_file` writes text, or a library item's bytes, or changes one place in a file.
- `computer_to_library` saves an image or a text file to the bot's library, where you see it.
- `computer_ask_owner` hands you the desktop for a step only you can do, such as a sign-in.

Its three skills, `computer`, `browser`, and `desktop`, say which part to use for what, and a few lines in each chat's instructions say it for bots that read none. `$computer` in a message, or the screen button beside the message box, sends the `computer` skill with it.

The Computer screen, at `/computer/computers/<key>`, shows a computer's desktop live, through noVNC, and its terminal, through xterm.js, over the plugin's WebSockets. A bot's key is its id, and `/computer/bots/<id>`, from before 0.3.0, opens the same screen. **Take over** gives you the mouse and keyboard; the bot's desktop and terminal tools wait until you **Hand back**. Over the desktop, an arrow in each bot's colour shows where it last pointed, with what it did; the newest is solid.

A computer starts on its bot's first call and stops when it sits idle, unless someone watches it. Its home, `/root`, is kept, with the browser's profile; programs the bot installs last until the computer is made again from a new image. When a bot reads a skill that has scripts, they're copied to `/skills/<name>` on its computer.

Plugins that need the computer add programs to every computer with setup steps, in `needs.computer.setup` in their `plugin.json`.

With [chat rooms](../chat-rooms/) added too, since 0.5.0, a room can have a computer of its own, which its bots share in that room, taking turns, and their own computers in their own chats. The screen button at the top of a room, beside **Edit**, turns it on and off and opens it. A room's turns hear that the computer is shared, and with whom, and the skill `room-computer` goes with a bot's first turn there. Its key is `room-` and 8 hex characters, kept so turning it off and on finds the same home. Turning it off stops it and keeps its home, and deleting the room deletes both. The computer works with chat rooms without needing it: `chat-rooms` is under `needs`, with `"optional": true`. It replaces the chat-rooms-computer plugin, whose rooms' keys it copies once, so each room keeps its computer: update the computer first, then remove that plugin.

Add it from **Plugins**, where fxbot's list has it. It runs inside fxbot: read its code there before you add it. Like every plugin, it's on for every bot once added; choose its bots in **Settings** › **Computer**.

## Computers for other plugins

Since 0.3.0, a plugin that needs the computer can name computers of its own, as chat-rooms-computer did for rooms before 0.5.0. It provides, with `fx.provide`:

```ts
type ComputerProvider = {
  /** The computer for a chat, or null for the bot's own. `name` makes its hostname: `<name>-computer`. */
  computerFor(call: { bot: string; session: string }): Promise<{ key: string; name: string } | null>;
  /** Every computer it keeps, with its name; null while it can't tell. */
  computers(): Promise<{ key: string; name: string }[] | null>;
};
```

- A key is a word, a dash, and more, such as `room-1a2b3c4d`, which a bot's id never is. Its container and home are `fxbot-computer-<key>`, labelled `fxbot.by=<plugin>`.
- Each call asks the plugins that provide one, in turn, which computer the chat uses; otherwise it's the bot's own.
- A plugin's computer goes when the plugin is removed, or runs and doesn't list it. One added but not running, or that answers null, keeps its own.
- On a shared computer, a `computer_desktop` result says where the other bots last pointed, **Take over** pauses every bot's desktop and terminal tools, and **Hand back** sends nothing: the owner tells the bot to go on.
- Since 0.4.0, a session another plugin labelled, such as a [subagent](https://fxbot.sh/docs/how-to/hand-work-to-subagents/)'s, is an actor of its own on the bot's computer, named "<bot> · <label>": its own arrow, its own pinned browser tab through `AGENT_BROWSER_SESSION` and `AGENT_BROWSER_PIN_TAB`, and turns at the desktop and the terminal with the bot's other actors, held until 20 seconds after an actor's last call or its turn's end, and waited for up to a minute. The shell runs for every actor at once. On fxbot before 0.9.0, which has no labels, every call is the bot's, as in 0.3.
- The page's routes are under `computers/<key>/`: `state`, `cursors`, `start`, `stop`, `reset`, and `takeover`.

## Set up the engine

Computers run in a container engine started rootless for a user of its own: podman, where the distribution has 4.9 or newer, beside whichever engine fxbot itself runs on, or else the machine's own Docker, where its packages run it rootless (Docker's `docker-ce`, Debian's `docker.io`, Fedora's `moby-engine`, or openSUSE's `docker`). A user already on rootless Docker keeps it. When the plugin finds no engine, the machine sets it up by itself, with `host/setup.sh`:
- in a release install, the machine's `fxbot` command runs it, as `fxbot computer on`, from the release's own files, then starts fxbot again
- in a checkout run as root, the plugin runs it
- in a checkout run as another user, the plugin's section in **Settings** shows the command to run as root

`host/setup.sh`:
- checks first that the machine runs cgroups v2 and lets its users make user namespaces, and stops, changing nothing, when it doesn't
- installs what the engine needs to run rootless, through apt, dnf, zypper, or pacman, each listed in `/etc/fxbot/packages`: `nftables`, with `podman` and `passt` (and `slirp4netns` for podman 4), or the Docker's rootless package (`docker-ce-rootless-extras`, `rootlesskit`, `moby-engine-rootless-extras`, or `docker-rootless-extras`) and `slirp4netns`; on apt, `uidmap` and `dbus-user-session` too; where SELinux runs, `policycoreutils-python-utils`
- makes the user `fxbot-computer`, with lingering, and delegates cpu, memory, and pids to it, so limits hold
- puts the engine's socket in `/var/lib/fxbot-computer/run/`
- loads a firewall, `/etc/fxbot/fxbot-computer.nft`, that lets the user's connections reach the internet and DNS, and not this machine, its tailnet, or its networks
- where SELinux runs, labels podman's storage in the user's home as `/var/lib/containers` is labelled
- in a release install, writes `/opt/fxbot/compose.computer.yaml`, which gives fxbot's container the socket's folder and the user's group, and, where SELinux runs, turns the container's labels off, so it can reach the socket. Before 0.3.2 it wrote `compose.override.yaml`: it takes its own lines out of that, and leaves yours.

In a checkout, add `--user <login>` for the login that runs fxbot. `--remove` takes it all away, as `sudo fxbot computer off` does in a release install. It's safe to run again.

## Settings

| Setting | Default | What it is |
| --- | --- | --- |
| `engine` | where the script puts it | The engine's socket |
| `memoryMiB` | 2048 | Memory for each computer |
| `cpus` | 2 | CPUs for each computer |
| `idleMinutes` | 15 | Minutes without a call before a computer stops |
| `screen` | `1280x800` | The desktop's size |

A computer made before a change to its sizes or its screen is made again with the new ones when it next starts, keeping its home.

## Files

| File | What it is |
| --- | --- |
| `plugin.json` | Its name, version, parts, and settings |
| `package.json` | What the page is built from, noVNC and xterm.js, and `"type": "module"` for the server code |
| `fxbot/server.ts` | The engine client, the image, computers, the tools, the routes, the sockets, and the instructions entry |
| `fxbot/migrations/` | Its table: this install's id, which labels its computers, homes, and images |
| `fxbot/session` | Copied into the image: the computer's command, which starts its desktop |
| `fxbot/fxbot-run` | Copied into the image: runs one command, with its deadline and process group |
| `fxbot/fxbot-screen` | Copied into the image: one action on the desktop, then a screenshot |
| `fxbot/agent-browser` | Copied into the image: starts the desktop's Chromium, then runs agent-browser on it |
| `fxbot/page.jsx` | The Computer screen, its sections in Settings and in each bot's settings, the view of `computer_desktop` calls, and the screen button |
| `fxbot/page.js` | `page.jsx`, built |
| `fxbot/novnc.js` | noVNC 1.7.0, built as one module, which the page loads from a route |
| `fxbot/page.css` | xterm.js's CSS |
| `fxbot/page-licenses.txt` | The licenses of what `page.js`, `page.css`, and `novnc.js` bundle: xterm.js, MIT, and noVNC 1.7.0, MPL-2.0, with where its source is |
| `skills/` | The `computer`, `browser`, and `desktop` skills |
| `host/setup.sh` | The engine, set up once on the machine |

## Build the page

`page.js` is `page.jsx` bundled with [rolldown](https://rolldown.rs), which comes with fxbot's packages, and `novnc.js` is noVNC's `RFB` as one ES module. Run these in this folder, in a checkout of fxbot, after changing `page.jsx` or `package.json`:

```sh
npm install
npx rolldown fxbot/page.jsx --format cjs -e react -e react/jsx-runtime -e @fxbot/app --file fxbot/page.js
npx rolldown node_modules/@novnc/novnc/core/rfb.js --format esm --file fxbot/novnc.js
cp node_modules/@xterm/xterm/css/xterm.css fxbot/page.css
```

When the bundled packages change, write `fxbot/page-licenses.txt` again from their license files.
