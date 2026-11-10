---
title: "Reach fxbot from other devices"
description: "fxbot listens on 127.0.0.1:8787 and has no login of its own. This guide shows the ways to open it: on the machine, then from other devices, starting with web pairing, the recommended way."
---

fxbot listens on 127.0.0.1:8787 and has no login of its own. This guide shows the ways to open it: on the machine, then from other devices, starting with web pairing, the recommended way.

## On the machine itself

Open `http://127.0.0.1:8787` in a browser on that machine. Everything works there, [installing the app](/docs/how-to/reach-it-from-your-computer/#install-it-as-an-app) included, and nothing else can reach it.

## With web pairing (recommended)

The **web-pairing** plugin opens your fxbot at [web.fxbot.sh](https://web.fxbot.sh) on a phone or any computer, over a WebRTC connection straight to it. Nothing on the machine is exposed, and fxbot.sh passes only the sealed handshake. You pair each device once. See [Reach it from your phone](/docs/how-to/reach-it-from-your-phone/) and [from your computer](/docs/how-to/reach-it-from-your-computer/).

Most networks connect directly. Some, such as work Wi-Fi that blocks UDP, need Tailscale, WireGuard, or a TURN server of your own: **Settings** › **Web pairing** › **Reachability** says in advance, and [When a device can't connect](/docs/how-to/when-a-device-cant-connect/) has the fixes.

## Over SSH

For a machine with no screen, such as a VPS, run this on a computer that reaches it by SSH:

```sh
ssh -N -L 8787:127.0.0.1:8787 <user>@<machine>
```

While it runs, fxbot is at `http://127.0.0.1:8787` on that computer, and on nothing else. For a phone, use web pairing or Tailscale.

## With Tailscale

[Tailscale](https://tailscale.com) gives fxbot an HTTPS address that only your own devices reach. On the machine, with Tailscale running and [HTTPS turned on](https://tailscale.com/kb/1153/enabling-https) for your tailnet:

```sh
sudo tailscale serve --bg 8787
```

fxbot is then at `https://<machine>.<tailnet>.ts.net` on every device in your tailnet. To give it a name of its own, such as `bot.<tailnet>.ts.net`, see [Serve it at its own name](/docs/how-to/tailscale-service/).

On a phone:

1. Install Tailscale from the App Store or Google Play, and sign in with the same account as the machine.
2. Turn the VPN on in the app.
3. Open `https://<machine>.<tailnet>.ts.net` in the browser. [MagicDNS](https://tailscale.com/kb/1081/magicdns), on by default, makes that name work. Add it to the Home Screen to install fxbot as an app.

Tailscale connects where web pairing can't directly, such as on networks that block UDP, through its own relays over HTTPS. With Tailscale on the phone too, web pairing likely connects through the tailnet as well, since the machine's tailnet address is one of its candidates.

## Through a proxy or VPN of your own

Anything else in front of fxbot works if it:

- **adds its own login or access control.** Whoever reaches fxbot can use all of it: every bot, chat, and provider.
- **serves HTTPS.** Phones install the app only from an HTTPS address, and an MCP server's sign-in comes back to fxbot by itself only over HTTPS.
- **passes the `Host` header through unchanged,** such as nginx's `proxy_set_header Host $host`. fxbot refuses a write whose page origin doesn't match the host it was reached at.
- **doesn't buffer responses,** such as nginx's `proxy_buffering off`, and lets them run long: each chat streams its replies.

Point the proxy at `http://127.0.0.1:8787` on the same machine.

## Never

- Open port 8787 to a network directly, or forward it from a router.
- Share fxbot publicly, such as with [Tailscale Funnel](https://tailscale.com/kb/1223/funnel), without a login in front of it.

The [security model](/docs/explanation/security/) explains why fxbot leaves this to what you put in front of it.
