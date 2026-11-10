---
title: "Web pairing"
description: "The web-pairing plugin's settings, defaults, and limits, and what web.fxbot.sh serves."
---

The web-pairing plugin's settings, defaults, and limits, and what web.fxbot.sh serves. [How web pairing works](/docs/explanation/web-pairing/) explains the design.

## Settings › Web pairing

The plugin keeps its settings itself, sealed with its keys in fxbot's database, rather than as plugin settings.

| Setting | Default | What it does |
| --- | --- | --- |
| **Remote access** | on | Off closes the relay connection and every device's connection, and refuses new ones. |
| **ICE servers** | `stun:stun.cloudflare.com:3478` | The STUN and TURN servers, in order, for fxbot and every device. fxbot's own WebRTC library uses the first STUN and the first TURN server. |
| **Relay** | `wss://web.fxbot.sh/signal` | Where fxbot listens, and what its pairing links carry when it isn't the default. |
| **UDP ports** | 8790–8799 | The ports for WebRTC: 2 to 100, from 1024 up. |
| **Map the ports on the router** | on | Asks the router for the ports by NAT-PMP, then UPnP, while fxbot listens. Off in a container. |

### ICE servers

| Kind | What you give | What a device gets |
| --- | --- | --- |
| STUN server | `stun:` or `stuns:` addresses | The addresses |
| TURN server | `turn:` or `turns:` addresses, a username, and a password | The same |
| TURN with a shared secret | `turn:` or `turns:` addresses, and coturn's or eturnal's shared secret | A username and password fxbot makes for each connection, good for 24 hours: the username is the expiry time and `fxbot`, and the password the base64 of its HMAC-SHA1 under the secret |
| Cloudflare TURN key | A TURN key's id and API token | Credentials fxbot asks Cloudflare for, good for 24 hours, kept for 12 |

Passwords, secrets, and tokens never go back to the page. Add `?transport=tcp` to an address for TCP. Several addresses go in one entry, separated by spaces.

## Pairing

| What | Value |
| --- | --- |
| A pairing's life | 10 minutes, and until its first failure, and until fxbot restarts |
| Open pairings at once | 3 |
| A code | `N-DDDD-DDDD`: a number from 1 to 999 that finds fxbot at the relay, then eight digits |
| A code's guesses | 1 |
| The lockout | 3 wrong codes in 15 minutes lock pairing for 15 minutes. Restarting fxbot ends it. |
| The link | `https://web.fxbot.sh/pair#1.<address>.<ticket>.<key>.<secret>`, with the relay at the end when it isn't fxbot.sh's |

## Devices

Each paired device is a row in the plugin's own table, `plugin_web_pairing.devices`: its id, name, kind, public key, when and how it was paired, where that was approved, when it was last seen, and the last counter it connected with. A passkey is a row in `plugin_web_pairing.passkeys`: its credential id, public key, algorithm, the device that added it, and when it was last used.

| What | Value |
| --- | --- |
| Connections at once | 20 |
| A connection that never connects | ends after 20 seconds |
| A connection that drops | ends after 30 seconds |
| A request's body, through a device | fxbot's own limits; 256 MiB at most |

Removing the plugin deletes its keys, its devices, and its passkeys. Every device then pairs again.

## The relay

The plugin connects only while a pairing is open, a device is paired, or a passkey is added, and remote access is on. It pings every 30 seconds, and after a drop reconnects with jitter, from 1 second up to 60. Opening a pairing reconnects at once.

| Limit | Value |
| --- | --- |
| A message | 16 KB |
| Messages in one call | 64 |
| Calls to one fxbot | 30 a minute |
| A nameplate | 10 minutes |
| A listener's proof | Ed25519 over its address and the time, within 2 minutes |

## What web.fxbot.sh serves

| Address | What |
| --- | --- |
| `https://web.fxbot.sh/` | The app, with its own service worker for its files only |
| `https://web.fxbot.sh/pair` | The same app, opened at pairing |
| `https://web.fxbot.sh/licenses.txt` | The licenses of what the app bundles |
| `wss://web.fxbot.sh/signal/…` | The relay |
| `https://<frame>.fxbot.sh/__fxbot/start` | A frame's first page, which only the app can frame |
| `https://<frame>.fxbot.sh/__fxbot/frame.js`, `/sw.js` | The frame's script and service worker |

Nothing else: every other address in a frame comes from your fxbot, through the connection. The Worker uses no storage, no alarms, and no logs. Its source is `packages/web-app/` in fxbot's repository, and `node build.mjs` there writes each file's SHA-256 to `dist/hashes.txt`.
