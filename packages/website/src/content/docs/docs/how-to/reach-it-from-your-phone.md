---
title: "Reach fxbot from your phone"
description: "Open your own fxbot from a phone or any computer, at web.fxbot.sh, over a connection straight to it, with no Tailscale."
---

Open your own fxbot from a phone or any computer, at [web.fxbot.sh](https://web.fxbot.sh), over a connection straight to it, with no Tailscale. You pair each device once, and it stays paired until you remove it.

You need the **web-pairing** plugin, which **Essentials** adds. Otherwise, add it from **Plugins**. It needs fxbot 0.8.0 or newer.

## Install the app on the device

- **On an iPhone or iPad,** open web.fxbot.sh in Safari, tap **Share**, then **Add to Home Screen**. Open fxbot from the Home Screen, and pair there. The Home Screen app keeps its own storage, apart from Safari's, and Safari clears a site's storage after seven days without a visit. A pairing made in Safari stays in Safari.
- **On Android,** open web.fxbot.sh in Chrome, and tap **Install app** in its menu. Pair in the installed app.
- **On a computer,** open web.fxbot.sh in Chrome, Edge, Firefox, or Safari. Installing it is optional.

Don't pair in a private window: what it stores is gone when it closes. The app says so when it sees one.

## Pair it

1. On your fxbot, open **Settings** › **Web pairing**, and choose **Pair a device**. Use the machine itself, Tailscale, or an [SSH tunnel](#from-a-server-with-no-screen). It shows a code, such as `47-3816-0925`, and a QR code.
2. On the device, in the app, choose **Pair a device**, and type the code. On Android, **Scan the QR code** scans it instead. A laptop can open the QR code's link. On an iPhone, type the code: the camera would open the link in Safari, not in the Home Screen app.
3. Both screens show six digits. Check they're the same, then tap **Approve** on your fxbot. If they differ, tap **Deny**: someone else is pairing.

The device says **Paired**. Tap **Open**: your fxbot's own page fills the screen, with your bots, plugins, and settings.

A code works once, for 10 minutes. A wrong code ends it, so ask for a new one. Three wrong codes in 15 minutes lock pairing for 15 minutes.

## After pairing

- **It reconnects by itself,** when you come back to the app, when the network changes, and when your fxbot restarts. A dot by its name says whether it's connected.
- **Keep a way back.** Pair a second device, such as your laptop, so a phone that loses its storage can [pair again from it](/docs/how-to/pair-another-device/) from anywhere. Or add a passkey there.
- **Check it'll connect from elsewhere.** **Settings** › **Web pairing** › **Reachability** says what your fxbot found about its network, before you leave home. If it says a network won't connect directly, see [When a device can't connect](/docs/how-to/when-a-device-cant-connect/).

The app asks the browser to keep its storage. The **Devices** screen says whether the browser agreed. If it didn't, the browser may clear the pairing when space runs low, so keep a second device or a passkey.

## From a server with no screen

On a VPS or a machine with no browser, open its **Settings** through an SSH tunnel from your computer:

```sh
ssh -N -L 8787:127.0.0.1:8787 <user>@<server>
```

Then open `http://127.0.0.1:8787/settings/plugins/web-pairing` on your computer, and pair from there. Close the tunnel when you're done. The device reaches the server directly afterwards.

## Remove a device

On your fxbot, in **Settings** › **Web pairing** › **Devices**, or on another paired device's **Devices** screen, choose **Remove**. Its connection closes at once, and it can't connect again until it pairs again.
