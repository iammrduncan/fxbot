# web-pairing

A plugin for [fxbot](https://fxbot.sh): your fxbot from your phone or any computer, at [web.fxbot.sh](https://web.fxbot.sh), over a connection straight to it, with no Tailscale.

- **Peer to peer.** A device reaches fxbot over a WebRTC data channel. fxbot.sh passes only the sealed handshake, through a relay that can read none of it and stores nothing.
- **fxbot's own page.** The device runs the same page and plugins it would on the machine, from fxbot itself.
- **Paired once.** A device pairs with a code or a QR code, both screens show the same six digits, and you approve it. It stays paired until you remove it, and reconnects by itself.
- **Pair another from one you have.** A paired device can pair another, from anywhere, and a passkey can pair a wiped one again.
- **It says what will connect.** **Settings** › **Web pairing** checks this machine's network, and a device that can't connect says why, with a link to the docs page that fixes it.
- **STUN only, by default.** Cloudflare's STUN finds each end's public address. Add your own STUN and TURN servers, in your order.

Add it from **Plugins**, or with **Essentials**. It needs fxbot 0.8.0 or newer. It runs inside fxbot: read its code there before you add it. With nothing paired, it connects to nothing. Removing it unpairs every device: it deletes fxbot's keys and its list of devices, so each device pairs again after you add it back. Turn off **Remote access** instead to pause it.

## Settings › Web pairing

| Part | What it does |
| --- | --- |
| **Remote access** | Off closes the relay connection and every device's connection. |
| **Pair a device** | A code and a QR code, for 10 minutes and one try. Then the six digits, and **Approve** or **Deny**. |
| **Devices** | Each paired device: what it is, how and when it paired, when it was last seen. **Rename** and **Remove**. |
| **Passkeys** | The passkeys paired devices added, and **Remove**. |
| **Reachability** | What fxbot found about its network, with **Check again**, and a docs link for each problem. |
| **ICE servers** | The STUN and TURN servers, in order: Cloudflare's STUN by default. Add a STUN server, a TURN server with a username and password, a TURN server with a shared secret (coturn or eturnal), or a Cloudflare TURN key. Move or remove any of them. |
| **Relay and ports** | The relay, fxbot.sh's by default; the UDP ports for WebRTC, 8790 to 8799; and mapping them on the router by NAT-PMP or UPnP. |

The tab also shows this fxbot's key fingerprint, which a paired device's **Devices** screen shows too.

The tab works from fxbot's own page, on the machine or over Tailscale. Inside a paired device, it says to use the web app's own **Devices** screen: a request that comes through a device is refused here, so code in fxbot's page can't pair a device of its own.

## How it works

The [docs](https://fxbot.sh/docs/explanation/web-pairing/) explain it in full. In short:

- **Keys.** On its first start, the plugin makes fxbot's two keys, sealed in fxbot's database with `fx.secrets`: an X25519 key for Noise, and an Ed25519 key it listens at the relay with. Its address at the relay is a hash of both. A device is its own X25519 key, which its browser keeps and can't export.
- **The relay.** While a pairing is open, a device is paired, or a passkey is added, fxbot keeps one WebSocket to the relay, with a ping every 30 seconds, and reconnects with jitter.
- **Pairing.** A link carries a 32-byte secret; a typed code runs CPace first, so each code allows one guess. Then Noise IKpsk2, the six digits, and approval. Three wrong codes in 15 minutes lock pairing for 15 minutes.
- **Connecting.** Noise IK, then fxbot's WebRTC offer and the device's answer, sealed. Each connect carries a counter that only goes up, so a replayed one is refused. The browser checks the channel's certificate against the sealed fingerprint.
- **The bridge.** Each request and WebSocket from the device gets a data channel of its own, which the plugin sends to fxbot's own server at `fx.localUrl`, without the device's `Origin` or cookies.

## Building it

`fxbot/server.js` is `fxbot/server.ts` bundled with [rolldown](https://rolldown.rs), with [werift](https://github.com/shinyoshiaki/werift-webrtc) for WebRTC, [@achingbrain/nat-port-mapper](https://github.com/achingbrain/nat-port-mapper), [@noble/curves](https://github.com/paulmillr/noble-curves), and the protocol in `packages/web-app/protocol/`. The build applies `werift-patches.mjs` to werift: fixes to its SCTP that a lossy link needs, and to its consent checks, which a busy cellular link needs, each an exact replacement that fails the build if it no longer matches. `page.js` is `page.jsx` bundled with qrcode-generator. Their licenses are in `server-licenses.txt` and `page-licenses.txt`. Run these in this folder, in a checkout of fxbot, after changing anything under `fxbot/` or the protocol:

```sh
npm ci && npm ci --prefix ../../packages/web-app
npx rolldown -c
npx rolldown fxbot/page.jsx --format cjs -e react -e react/jsx-runtime -e @fxbot/app --file fxbot/page.js
npx tsc -p tsconfig.json
node ../../packages/web-app/protocol/check.mjs
```

The last checks the protocol against the published test vectors for Noise and CPace. Commit `server.js` and `page.js` with their sources.
