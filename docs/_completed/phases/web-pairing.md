# Web pairing

The owner's fxbot, from their phone or any computer, with nothing exposed and no Tailscale:
- **web.fxbot.sh is a PWA** that opens the owner's own fxbot, with its whole UI and plugins, over a WebRTC data channel straight to their fxbot. It works wherever the two can reach each other: home, work, or a phone's network.
- **Peer to peer and end-to-end encrypted.** fxbot.sh hosts only the handshake: a relay that passes sealed messages between the two, reads none of them, and stores nothing. The page's own code comes from the site. Everything the owner sees, the UI included, comes from their fxbot through the channel.
- **Pairing starts where fxbot already trusts the owner.** That's Settings › Web pairing on the machine, the same page through an SSH tunnel on a server, or a device that's already paired. It shows a QR code and a short code. The new device enters the code, both screens show the same six digits, and the owner approves.
- **A pairing lasts until the owner removes it.** A device is a key its browser keeps, with no tokens and no expiry. It reconnects by itself after a lock screen, a network change, or a restart on either side. A paired device can pair another one from anywhere, so a lost pairing doesn't wait for home.
- **On fxbot's side, it's a plugin,** `web-pairing`, with all of the peer-to-peer code. Once a device is paired, it keeps one outbound connection to the relay, lets in only the devices it paired, and passes their requests to its own API. Until then, it runs nothing.
- **STUN only, by default.** Cloudflare's STUN finds each end's public address, and the two connect directly. fxbot.sh relays no traffic. The owner can:
  - add STUN servers of their own, put them first, or drop Cloudflare's
  - add a TURN server of their own
- **It says in advance what will connect.**
  - **On fxbot's side:** it checks its own network (UDP, its NAT, port mapping, IPv6, a container) and shows what that means for a phone elsewhere.
  - **When a device can't connect:** it says why, from both ends, and links to the docs page that fixes it.
  - **The docs cover each way in detail:** Tailscale, WireGuard, a TURN or STUN server of the owner's own, and a forwarded or mapped port.
- **In the Essentials pack, STUN only.** A new install has it. It opens no connection until a device is paired.

Status: built on 2026-11-09, for 0.8.0, and checked on this machine against a disposable fxbot and the relay under `wrangler dev`, in Chromium, Firefox, and WebKit (section 4). Nothing was run on a phone, against the deployed Worker, or on a real NAT, carrier, or router: those are the human checks. Where the build differs from the plan, section 3 says so under **Built**. The owner's decisions of 2026-11-09 are under What the owner asked. Researched on 2026-11-08:
- the research directive's references
- products that reach a self-hosted agent or server from a phone: Happy, OpenClaw, Claude Code Remote Control, Codex Remote, go2rtc, PairDrop, and others
- the pairing designs of Magic Wormhole, Signal, WhatsApp, Matter, HomeKit, KDE Connect, Syncthing, and Chrome Remote Desktop
- the specs and browser data for WebRTC, Web Crypto, Noise, CPace, and storage
- Cloudflare's Workers and Durable Objects docs and prices
- NAT-traversal measurements

Tried in Node 22 on this machine:
- Noise IK and IKpsk2 on Web Crypto alone, which passed the cacophony test vectors
- CPace on `@noble/curves`, which passed the CPace draft's vectors
- **Headless Chrome 158 against a Node server on werift and on node-datachannel:**
  - setup in 180–206 ms and 57–65 ms
  - 54–71 MB/s and 108–154 MB/s on localhost
  - a tampered fingerprint refused by both
- **werift bundled by rolldown** into one file of 116 KB gzipped, which `import()` loads with no `node_modules`

Nothing was run on a phone. Where this plan says *likely*, it wasn't checked.

## What the owner asked

"so v0.8.0 will mostly work on a peer-to-peer plan... We want to launch a new `packages/web-app` that will live at web.fxbot.sh. It is a PWA app that brings the full UI of fxbot to it, but no backend. It connects over webrtc to a running instance of fxbot somewhere. Fully end to end encrypted. Allows folks to have a phone app without needing tailscale etc and without exposing their installation outside their own private networks etc as long as they can peer together."

"It needs to be highly secure, non-spoofable, initiate pairing codes, and keep its state long lived so they don't magically loose a pairing and have to repair when they are away from their machines (Would suck to go to work only for it to drop pairings and you can re-pair and reconnect until you get home to do the pairing again)."

Then: "this has to be true peer to peer and end to end encrypted. The only thing we may host is a handshake that ehlps them connect, but we cannot host any of their site information etc..."

So:
- **What fxbot.sh may host:**
  - the relay, which passes sealed handshake messages and stores nothing
  - the web app's static files, which hold no owner data
- **What fxbot.sh doesn't host:**
  - TURN, even though TURN carries only encrypted bytes
  - fxbot's UI, which comes from each owner's own fxbot
  - anything that stays after a connection

After reading the plan, on 2026-11-09:

"1. STUN only by default. Cloudflare default, users can add their own and disable cloudflare or set as priority order etc..."

"2. TURN available for users to deploy themselves (later if we host a cloud version they can get it included)..."

"If direct peer to peer won't work (network reasons etc) we should give the user a notice and point them to our docs on how to use tailscale, wireguard, TURN, etc... Which means we should do our best to discover and proactively tell folks how it works. Docs should cover setting up your own tailscale, wireguard, STUn, TURN, etc in detail."

"All of the peer to peer stuff should go into a plugin, not core. It will be enabled in essentials pack and STUN only."

So:
- **ICE servers are an ordered list the owner edits.** It holds Cloudflare's STUN by default; the owner can add their own, reorder it, or remove Cloudflare's. TURN is the owner's own, and a hosted cloud version could include one later.
- **fxbot checks its reachability in advance.** When a connection fails, the notice links to docs for each way through.
- **All of it lives in the `web-pairing` plugin and the web app, in Essentials.**

## 0. Core or plugin

**Plugin: `web-pairing`,** in `plugins/web-pairing/` ([Core or plugin](../../CONVENTIONS.md#core-or-plugin)), with all of the peer-to-peer code, by the owner's decision. It's in the Essentials pack, STUN only, so a new install has it. It connects to the relay only once a pairing opens or a device is paired, so an owner who never pairs still runs nothing. Reaching fxbot from elsewhere isn't something every bot needs, isn't what plugins plug into, and isn't what fxbot needs to run: Tailscale, a proxy, or the machine itself already work. As a plugin, an owner who doesn't add it has no relay connection, no timer, no table, and no code in the page. It needs nothing it can't have already:
- tables of its own, for devices
- routes of its own, for pairing
- a Settings tab, for Devices
- a long-running task under its `signal`, for the relay connection
- requests to its own server, for the bridge

**Two small hooks in the plugin API,** each the smallest a real plugin needs, and general: neither knows about peers or pairing, and any plugin may use them. Both are additive, so `plugin-breaks.json` gets nothing. `web-pairing` sets `minFxbot` to 0.8.0.
- **`fx.secrets`:** `get(name)` and `set(name, value)` for values the plugin makes itself, sealed by the SDK beside its settings in `plugin_secrets` (`packages/sdk/src/plugins.ts:221`). The plugin's two private keys need it. Today a plugin can only read the secrets the owner typed into its settings (`plugin-api.ts:93-94`). Since 0.8.0.
- **`fx.localUrl`:** the server's own address on its machine, which the SDK already has for MCP sign-ins (`packages/server/src/index.ts:31`). The bridge sends requests there. Since 0.8.0.

**`packages/web-app`, a new package, because the owner asked for it by name.** It's a second static site, as `packages/website` is, and imports none of the other packages. It holds:
- the shell at web.fxbot.sh
- the frame that each paired fxbot's UI runs in
- the relay Worker
- the protocol code that the plugin bundles too, so it lives in one place

CONVENTIONS says a new package needs a second real consumer. Here it's a deployable of its own, as the website is.

**The UI, the server, and the SDK's client don't change.** The frame gives the unchanged UI its `fetch`, `WebSocket`, and URLs (see The web app).

## 1. Research

### fxbot today: how the page reaches the server

fxbot has no login. The server listens on 127.0.0.1:8787 (`packages/server/src/index.ts:15-16`), and whoever reaches it is the owner: today that's the machine itself, or the owner's tailnet through `tailscale serve` ([Reach it](../../packages/website/src/content/docs/docs/how-to/reach-it.md)). The one check is the page's origin: a write whose `Origin` names another host than the one it reached is refused, so a site open in the same browser can't change fxbot (`index.ts:309-312`), and a WebSocket upgrade checks it the same way (`index.ts:337-338`). A request with no `Origin`, from a tool, passes.

Every way the page reaches the server assumes the page and the API share an origin:

| What | How | Where |
| --- | --- | --- |
| The API | `fetch("/api/…")` with JSON, through the SDK's client | `packages/sdk/src/client.ts:74` |
| A bot's chat | one long `fetch` whose body is NDJSON, read as it comes, and asked again from the last cursor after a drop | `client.ts:97` |
| Plugins' own routes | `fetch("/api/plugins/<name>/…")`, from the `api` each plugin's page gets | `packages/ui/src/plugins.tsx:108` |
| Plugins' page code | `fetch(url)` of its `page.js`, run with `new Function`, and its CSS as a `<link>` | `plugins.tsx:122`, `plugins.tsx:172` |
| Images and files | `<img src>` and `<a href>` at `/api/library/…` | `packages/ui/src/library.tsx:30, 138, 203, 239` |
| The computer's desktop and terminal | binary WebSockets at `ws(s)://<host>/api/plugins/computer/…`, built from `location` | `plugins/computer/fxbot/page.jsx:62, 150, 197` |
| An HTML page | an `<iframe src>` of the pages plugin's shell, which frames the page with `sandbox="allow-scripts"`, each with its own CSP header | `plugins/pages/fxbot/page.jsx:14, 128`, `plugins/pages/fxbot/server.ts:28-39` |
| An MCP sign-in | the server builds the callback from the page's origin when it's HTTPS (`<origin>/api/oauth/callback`), and otherwise from its loopback, which a phone pastes back | `packages/sdk/src/mcp.ts:514-540`, `index.ts:166` |
| New builds | the page's own service worker, from vite-plugin-pwa, at `/` | `packages/ui/src/pwa.ts` |

So a page that isn't served by fxbot itself needs four things to run the same UI unchanged: a way for `fetch` to reach the server, a way for `WebSocket` to, a service worker for what the browser loads by URL (images, frames, stylesheets, scripts, downloads, the HTML itself), and to keep the UI's own service worker from taking its place.

### WebRTC in Node

fxbot's side needs a WebRTC data channel in Node, which Node doesn't have. Tried here: headless Chrome for Testing 158 against a Node 22 server on each library, on localhost, with one ordered channel, 32 MB each way, and backpressure. Each row is one run:

| | werift | node-datachannel | @roamhq/wrtc |
| --- | --- | --- | --- |
| What | WebRTC in TypeScript; its crypto is `node:crypto`'s | bindings to libdatachannel (C++) | a fork of node-webrtc, on libwebrtc |
| Version | 0.26.0, 2026-11-01 | 0.33.6, 2026-10-27 | 0.10.0, 2026-03-10 |
| License | MIT | MPL-2.0, with OpenSSL, usrsctp, libsrtp, and no notice files in its builds | BSD-2 |
| Can be in a plugin | **yes**: rolldown makes one ESM file of 441 KB minified, 116 KB gzipped, with only Node's own modules | no: a native addon, 8.7 MB, from a package for each platform | no |
| Chrome → server: setup | 180–206 ms | 57–65 ms | 5–14 ms |
| Throughput down / up (64 KiB chunks) | 68 / 67 MB/s | 140 / 154 MB/s | 162 / 159 MB/s |
| Server CPU for each MB | about 16–27 ms | about 8–9 ms | about 7 ms |
| Peak memory | 151–155 MB (245 MB after 50,000 messages, unexplained) | 118–128 MB | 122–167 MB |
| A tampered fingerprint | refused | refused | — |
| Largest message it takes | 64 KiB (`maxMessageSize`) | 256 KiB | a send over the limit **closes the channel** |
| TURN | over UDP, TCP, and TLS | UDP only, with its builds' libjuice | full |
| Weak points | one maintainer, fast churn with breaking minors; it checks the peer's certificate against the SDP only since 0.23.0 ([#585](https://github.com/shinyoshiaki/werift-webrtc/pull/585), April 2026); **Firefox never connects** ([#438](https://github.com/shinyoshiaki/werift-webrtc/issues/438), open); DTLS 1.2 only | Linux builds link **OpenSSL 1.1.1w**, out of support since 2023; C++ on network input ([CVE-2026-103936](https://github.com/libp2p/js-libp2p/security/advisories/GHSA-x3m2-6mg8-vj7f): one STUN packet killed the process) | libwebrtc from Chrome 106 (2022); `bufferedamountlow` never fired; its upkeep is in question ([#57](https://github.com/WonderInventions/node-webrtc/issues/57)) |

Over a 50 ms round trip, congestion control limits both libraries more than CPU: 1.1–6.4 MB/s with no loss, and neither wins under loss. Even werift is far beyond what fxbot sends: a chat is kilobytes, a watched desktop a few MB/s, and a 32 MB file about 0.9 s of its CPU.

Both reassembled Chrome's post-quantum DTLS ClientHello (X25519MLKEM768, 1,413 bytes over two datagrams), and both connected when Chrome's `.local` candidates were dropped, by learning its address from its checks.

What to know when building on werift:
- **Always pass ICE servers.** It contacts `stun.l.google.com` even with `iceServers: []`.
- **Backpressure:** `bufferedamountlow` fires through `addEventListener` only, not the `onbufferedamountlow` property.
- **Messages:** keep them to 64 KiB or less, since Chrome refused 256 KiB to werift and 1 MiB failed everywhere.
- **Candidates:** queue them until the remote description is set, and strip an `a=` prefix.
- **Bundling:** esbuild's bundle crashed at the first mDNS lookup (`Dynamic require of "buffer"`), and rolldown's didn't.

### The handshake relay

**A relay is unavoidable, and it can know almost nothing.** Two browsers, or a browser and a server, can't open a WebRTC connection without first trading an offer, an answer, and ICE candidates. Something both can reach has to pass those. Everything passed can be sealed by the two ends, so the relay is transport only.

**Public "serverless" signaling isn't fit for an fxbot that listens for months.** This is what Trystero uses:
- **Nostr:** relay.nostr.net's operator blocked Trystero's event kind after "1.2 million events in 20 h" ([trystero#91](https://github.com/dmotz/trystero/issues/91)). Relays reject posts ([#126](https://github.com/dmotz/trystero/issues/126)), and the default lists are pruned every few months ([#88](https://github.com/dmotz/trystero/issues/88)). An open bug says a relay that's down for a minute is retired for good, and later rooms "announce into nothing" ([#208](https://github.com/dmotz/trystero/issues/208)).
- **BitTorrent trackers:** they time out or disappear ([#78](https://github.com/dmotz/trystero/issues/78)). go2rtc's static WebTorrent page relies on a single public tracker by default.
- **Public MQTT brokers:** "not for production", and every subscriber sees every message.
- **Supabase's free plan:** pauses after a week of low database activity.
- **PeerJS's cloud:** has no SLA.

**Cloudflare Workers with Durable Objects** fit, and fxbot.sh already deploys to Cloudflare:
- **One Durable Object per fxbot.** It holds the fxbot's outbound WebSocket under the WebSocket Hibernation API: after about 10 s idle the object sleeps, and its sockets stay open.
- **Each socket's role lives in its tags,** at most 10 of 256 characters, while the socket is open. So the object needs no `ctx.storage`, no alarms, and no `serializeAttachment`.
- **What it keeps:**
  - Data is in the isolate's memory only, and gone when the object sleeps or restarts.
  - Cloudflare still sees IP addresses and connection metadata, and logs object IDs "for billing and debugging" ([data location](https://developers.cloudflare.com/durable-objects/reference/data-location/)).
  - Workers Logs is on by default for new Workers, so it's turned off (`head_sampling_rate: 0`).
- **What drops sockets:**
  - Cloudflare closes hibernated sockets when the object restarts: deploys, runtime updates, and placement changes ([lifecycle](https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/)).
  - Its network closes WebSockets with no data flowing ([network](https://developers.cloudflare.com/network/websockets/)).
  - So the fxbot reconnects with jitter, and pings.
- **What's billed** (updated 2026-10-18):
  - Opening a WebSocket is a request, and incoming messages count at 20:1.
  - Outgoing messages and incoming protocol pings are free.
  - `setWebSocketAutoResponse` answers a matching ping without waking the object, but whether it counts as a request isn't documented.
- **Where it runs.** Pages can't define a Durable Object class. A Worker with static assets can, and its static requests are free and unlimited. So one Worker serves web.fxbot.sh, its frames, and `/signal`.

**Cost,** for each fxbot a day: 50 connection setups of about 10 messages each, 6 reconnects, and pings:

| fxbots | Plan | A month |
| --- | --- | --- |
| 1,000 | Free (100,000 Durable Object requests a day) | $0, at about 80% of the cap |
| 1,000 | Paid ($5 minimum) | about $5.30 |
| 10,000 | Paid | about $11–23 |

On the free plan, going over the cap fails every request until 00:00 UTC, which is a reason to pay the $5. An owner can deploy the same Worker to their own free account, where one fxbot uses about 100 requests a day.

**Others that pass handshakes or relay data:**

| System | What it sees | Who runs it |
| --- | --- | --- |
| Syncthing relays | encrypted data, IPs, device IDs, volume | volunteers |
| Tailscale | keys and endpoints at coordination; WireGuard ciphertext at DERP | Tailscale, or the owner's peer relays |
| Magic Wormhole | sealed messages after SPAKE2, at a mailbox and a transit relay | the project; self-hostable |
| Happy | ciphertext of sessions, plus ids, timing, and push tokens, stored | the project; self-hostable |
| Home Assistant's Remote UI | TLS that ends at the owner's instance (SniTun) | Nabu Casa, $6.50 a month |
| Chrome Remote Desktop | Google's signaling and TURN | Google |

### Getting through NATs without TURN

**How often direct connections fail:**
- **TURN shares:** callstats saw 22% of conferences need TURN (2015–16, [webrtcHacks](https://webrtchacks.com/usage-stats/)). appear.in saw 17.7% relayed, 78% of that over TCP, which points at blocked UDP. Twilio says "around 85%" connect with STUN alone.
- **With more tricks:** Tailscale, with port mapping and port guessing, which browsers don't do, is "well north of 90%" direct. libp2p's hole punching succeeded 70% ± 7.1% over 4.4 million attempts ([arXiv 2510.27500](https://arxiv.org/abs/2510.27500)).
- **Carriers:** over 92% of cellular networks use carrier-grade NAT. About 40% of those map symmetrically, among them "major cellular networks in the US", against under 2% of home routers (Richter et al., [IMC 2016](https://www.prichter.com/imc176-richterA.pdf)).

**What can't connect with plain ICE:**
- symmetric NAT on both ends
- symmetric NAT against a port-restricted one: a phone on such a carrier reaching a typical home router over IPv4
- any network that blocks UDP, common at work and on guest Wi-Fi. Only TURN over TCP or TLS on 443 gets through there, or a relay over HTTPS such as Tailscale's DERP.

**What helps without fxbot.sh relaying anything:**
- **A mapped port at home.** A UDP port mapped on the home router, by UPnP, NAT-PMP, PCP, or by hand, "makes one NAT vanish" (Tailscale). A phone behind a symmetric NAT can then reach it, and ICE finds it as a peer-reflexive candidate (reasoned, not tested).
  - It fails when the home itself is behind carrier-grade NAT.
  - Inside a container, SSDP discovery doesn't cross the bridge.
  - Libraries: `@achingbrain/nat-port-mapper` (UPnP and NAT-PMP, pure JavaScript), and `node-portmapping` (libplum, native, by libdatachannel's author).
- **IPv6.** Google measured 45–50% of users on IPv6 in 2026, and ICE usually connects directly between two IPv6 ends. Docker's bridge networks leave it off by default.
- **The owner's own TURN:**
  - **Cloudflare TURN on their own account:** 1,000 GB a month free, then $0.05/GB. The instance mints credentials (48 hours at most) with the account's key. It offers TURN over TLS on 443.
  - **coturn or eturnal on a €4 VPS:** the instance mints time-limited credentials from a shared secret, with no API call.
  - **A watched desktop** at 3 Mbit/s is about 1.35 GB an hour. A TURN server sees only DTLS-encrypted bytes, plus IPs and timing.
- **Tailscale,** which fxbot already recommends. Its DERP relays run over HTTPS.

**STUN fits the constraint.** A STUN server answers a client's own public address, and sees only that. Cloudflare's is "free and unlimited" ([FAQ](https://developers.cloudflare.com/realtime/turn/faq/)). Google's (`stun.l.google.com:19302`) publishes no terms.

### Pairing and keys

**The two ends authenticate the handshake, not the relay.** WebRTC is end-to-end encrypted by DTLS, but only as far as the fingerprints in the SDP are the real ones:
- **Plain signaling lets its operator sit in the middle.** PairDrop's open issue says so ([#180](https://github.com/schlagmichdoch/PairDrop/issues/180)).
- **WebRTC's own identity providers are dead in practice:** the spec stopped at Candidate Recommendation in 2018, and only Firefox implements it.
- **So the SDP rides in an authenticated, encrypted session.** The browser then refuses a DTLS certificate that doesn't match its fingerprint: "MUST terminate" (RFC 8122 §6.2). That binds the data channel to the paired keys.
- **Precedent:** libp2p's WebRTC-direct does the same with Noise, its prologue carrying both fingerprints.

**Noise needs no library.** Noise IK (`Noise_IK_25519_AESGCM_SHA256`, rev 34), which WireGuard's handshake is built on, runs on Web Crypto's X25519, AES-GCM, HMAC, and SHA-256 alone:
- **On both sides:** in the browser, and in Node 22, where Ed25519 and X25519 are stable from v22.13.0.
- **Tried here:** a 77-line sketch passed the cacophony vectors for IK and IKpsk2. Its static key was non-extractable (`exportKey` refused) and still did the handshake.
- **What it hides:** IK encrypts the initiator's static key, so the relay can't tell which device is connecting.

**Browser support for X25519 and Ed25519** (MDN's data, 2026-11-02):

| | Chrome | Firefox | Safari and iOS | Node |
| --- | --- | --- | --- | --- |
| X25519 | 133 (Feb 2025) | 130 (Sep 2024) | 17 (Sep 2023) | stable from 22.13 |
| Ed25519 | 137 (May 2025) | 129 (Aug 2024) | 17 | stable from 22.13 |

**Non-extractable is an API rule, not hardware.** Web Crypto keys are serializable into IndexedDB.
- **Chromium** writes the key's bytes into the stored value.
- **WebKit** wraps them with a key kept in the Keychain.
- So malware, or a copy of the browser profile, can recover a device key. A web page can't.

**Codes:**

| Design | Strength | Cost |
| --- | --- | --- |
| A QR code with a 256-bit one-time secret and the fxbot's key | no guessing at all; pins the fxbot's key | needs a camera, and on iOS the system camera opens Safari, not the installed app |
| A short typed code with a PAKE | one online guess per code | needs a PAKE, and a nameplate so the relay can route it |
| Comparing six digits (SAS) | no secret to carry | only as good as the comparing; no help against a phishing page, which shows its own matching digits |

A short code can't be a plain pre-shared key. Whoever starts a handshake with it gets an answer encrypted under it, and can try every code offline. So a short code needs a PAKE.

**The PAKEs:**
- **CPace** is balanced, the right shape for a code both sides know. The CFRG chose it in 2020. Draft 21 (22 Apr 2026) is with the RFC Editor.
- **SPAKE2** (RFC 9382) "was not selected" by that process.
- **SPAKE2+** (RFC 9383, Matter's) and **OPAQUE** (RFC 9807) are augmented, for stored passwords.
- **SRP** (HomeKit's) is heavy finite-field math.
- **No audited JS CPace exists.** The packages are young, single-maintainer, or say "do not deploy … until your own independent audit".
- **One built here:** about 28 lines on `@noble/curves`' ristretto255 matched every value in the draft's B.3 vectors. It is 14.5 KB gzipped and takes 0.9 ms a share. noble says a Trail of Bits audit (Aug 2026) covered "everything", and that its field arithmetic isn't constant-time, which is acceptable for a code that lives minutes.

**How others pair:**

| System | Code | Then |
| --- | --- | --- |
| Magic Wormhole | `7-crossover-clockwork`: a nameplate from the mailbox, plus words; SPAKE2; single use | a wrong guess fails visibly |
| Happy Agent (direct) | QR with a one-time 32-byte token, 5 minutes, used by the first try | commitment, then 4 emoji compared on both screens; the device token is derived on both sides and stored hashed |
| OpenClaw | setup QR with a one-time token (10 minutes) and a TLS pin | a key per browser; new browsers approved from another admin browser |
| Signal | the new device shows a QR with an ephemeral key, which the phone scans | Russia-aligned actors phished people with these codes (GTIG, Feb 2025) |
| WhatsApp | QR with the companion's key and a 32-byte linking secret; or an 8-character code | the primary signs the device list; every device has its own key |
| Matter | QR or 11 digits, SPAKE2+, 27-bit passcode | an admin opens a new window to add another; 20 failures close it |
| HomeKit | 8 digits, SRP | 100 failures over a lifetime lock it |
| Chrome Remote Desktop | PIN with SPAKE2 | "remember" stores a random shared secret that replaces the PIN |
| KDE Connect, Syncthing | compare a fingerprint; device ID = certificate hash | the key is pinned after pairing |
| Pi's chord | `XXXX-XXXX`, 10 minutes, approved on a confirm page | the poll secret is stored hashed |

### Keeping a pairing

**Where a browser keeps it, and what loses it:**
- **Safari's 7-day rule.** It deletes IndexedDB, service workers, and caches after 7 days of use without visiting the site ([WebKit, 2020](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/)). Since iOS 14, "an explicit exception for the first-party domain of home screen web applications" ([WebKit](https://webkit.org/blog/11338/cname-cloaking-and-bounce-tracking-defense/)).
- **The installed app has its own storage.** iOS Home Screen apps have "separate cookies and storage from the browser", and macOS's "Add to Dock" copies cookies, not storage (WWDC 2023). So pairing happens inside the installed app.
- **Safari 17's storage policy:**
  - a quota of up to 60% of the disk for each origin
  - eviction under storage pressure is least-recently-used
  - `persist()` is granted by heuristics, such as being opened as a Home Screen app ([WebKit, 2023](https://webkit.org/blog/14403/updates-to-storage-policy/))
- **Chrome** grants `persist()` without asking, by engagement and installation. **Firefox** asks.
- **Clearing site data, or a private window,** loses it everywhere. Whether iOS's "Clear History and Website Data" reaches Home Screen apps wasn't found.

**What others found:**
- **OpenClaw:** "Switching browsers or clearing browser data requires re-pairing."
- **Codex:** forced pairings unused since June 8, 2026 to pair again.
- **Signal:** a linked device unlinks after 45 days offline, which comes from a search summary.
- **The common fix is another device:** Happy's QR from a signed-in device, OpenClaw's Devices page, Pi's confirm page, Jellyfin's Quick Connect, and Matter's new window.
- **Happy also has an offline recovery key:** base32 in groups of five, which forgives look-alike characters.

**A passkey can bring a pairing back.** WebAuthn binds an assertion to `web.fxbot.sh`, so a phishing page can't use it, and a synced passkey survives a wiped browser or a new phone. `getPublicKey()` (Chrome 85, Firefox 119, Safari 16) gives the key without CBOR. Whether it works in an iOS Home Screen app wasn't checked.

### The code the browser runs

**An encrypted web app is only as good as the code its site serves.**
- Signal has never shipped a browser client.
- Meta's Code Verify extension (2022) checks WhatsApp Web's code.
- WAICT, transparency for a site's JavaScript, is a Firefox Nightly prototype behind a pref (May 2026).
- A service worker can't pin a site's code: browsers fetch the worker again at least daily, and a new one runs its install code, with IndexedDB, before it takes over.

So whoever controls web.fxbot.sh can use the keys while their code runs. What helps:
- **A small shell that holds the keys and draws every security screen,** apart from the UI.
- **Each fxbot's UI, plugin code included, in a frame that can't reach the keys,** with code from that fxbot. An opaque-origin sandbox would hide the keys too, but a sandboxed frame gets no service worker, so the UI's images, stylesheets, and frames wouldn't load unchanged. A frame origin of its own for each fxbot keeps both.
- **A strict CSP on the shell, and no third-party scripts.**
- **Reproducible shell builds with published hashes.** This detects tampering after the fact; it doesn't prevent it.

**Plugin page code needs the separation.** fxbot runs plugin page code with `new Function` in the page's own origin (`packages/ui/src/plugins.tsx:132`). In the shell's origin, that code could use every pairing's key.

### The directive's references

None of them has phone pairing, a relay, or WebRTC to a server:
- **[eve](https://github.com/vercel/eve):** reaches a phone through message channels (Slack, Telegram, iMessage, SMS). `eve remote connect --url` opens its terminal UI against a deployed agent. Its docs warn that a same-machine tunnel arrives as `local-dev`, so "put an authenticator in front of any dev server you expose that way" (`docs/reference/cli/index.md:285`).
- **[fx and libfx](https://github.com/vercel-labs/fx):** no remote access. Three libfx facts matter for a flaky link:
  - `session.stream(cursor)` "returns every line after `cursor`… so a client that loses its connection reconnects to any server and carries on".
  - A repeated `messageId` runs nothing new.
  - "libfx doesn't know who is calling. Anyone with a session's id can prompt, steer, cancel, stream" (`sdk/README.md:83, 59, 133`). The transport has to authenticate first.
- **[Pi](https://github.com/earendil-works/pi):** `/share` puts a session in a gist, with its id in the fragment of `pi.dev/session/#…`. Its chord kit pairs a device with an `XXXX-XXXX` code, single use and 10 minutes, approved on a confirm page. Its own warning: "behind a tunnel or relay every remote client shares one address… so ten requests from one party block remote pairing for all" (`packages/chord/src/node/app/README.md:125-143`).
- **[Grok bot](https://docs.x.ai/grok-bot/overview):**
  - **Its apps:** desktop and phone apps where "the same Bots and conversations sync across your signed-in devices", through a Cursor account.
  - **Running on the user's own computer:** a setting with Ask every time, Always allow, or Never allow.
  - **How the cloud reaches the desktop:** not documented.
- **[OpenBot](https://github.com/CopilotKit/openbot), [OpenDuet](https://github.com/CopilotKit/OpenDuet), [openmuse](https://github.com/CopilotKit/openmuse), [OpenDots](https://github.com/CopilotKit/OpenDots):** phone apps against a fixed, reachable server URL with a sign-in or an owner token, never the laptop app. openmuse: "Use HTTPS and restricted network access for a remote host."
- **[agent-browser](https://github.com/vercel-labs/agent-browser):**
  - **Its stream:** loads only from localhost.
  - **Its dashboard:** keeps an "unguessable token" in the URL fragment, then a host-bound cookie.
  - **Its frames:** sent latest-first, with ack pacing, so "the application never builds a backlog", which suits a slow link.
- **[agent-desktop](https://github.com/vercel-labs/agent-desktop), [fx0](https://github.com/vercel-labs/fx0), [durable-harness](https://github.com/vercel-labs/durable-harness):** none. durable-harness's `world-browser` keeps a Workflow World in IndexedDB, with a leader tab.

### Others that reach a phone

- **Happy** ([slopus/happy](https://github.com/slopus/happy), MIT) is the closest, in two modes.
  - **Relay mode:** the server stores session data encrypted by the clients, and sees ids, timing, and push tokens. A new device is added by a QR from a signed-in device, and there's a base32 secret-key backup.
  - **Direct mode** (Happy Agent, 2026), its "Mobile connector", has no relay. The QR carries an address and a one-time token. The phone commits to its key before seeing the daemon's. Both screens show 4 emoji. The device token is derived on both sides and "never crosses the wire". Revoking "closes every request, event stream, WebSocket, and CONNECT tunnel".
  - **Its lessons** (`LEARNINGS.md`):
    - A finished pairing needs a 3-second linger, or closing the socket cut off the phone's own answer.
    - A fixed advertised port collided with a second daemon.
    - After a transport change, "an offline v1 phone needs a new QR".
- **OpenClaw**, a self-hosted gateway with a browser PWA, is the closest shape:
  - Devices › "Connect a device" makes a setup QR.
  - Each browser has its own Ed25519 key that "never leaves the browser".
  - Its gateway sends Web Push itself, with its own VAPID keys, straight to the browser's push service. Since "the Browser Push API permits only one application-server key per service-worker registration", it recommends "one Control UI service-worker scope per Gateway".
- **Claude Code Remote Control:** outbound HTTPS to Anthropic's API, not end-to-end encrypted: the transcript "is stored on Anthropic servers". Devices enroll their own credentials shortly after a full sign-in.
- **Codex Remote:**
  - A QR on the host pairs a phone that's signed in to the same account. "A secure relay layer keeps trusted machines reachable".
  - Its exec-server relay is hybrid Noise IK "without trusting Rendezvous with plaintext or endpoint keys" ([openai/codex#26242](https://github.com/openai/codex/pull/26242)).
  - Pairings unused since a date had to be made again.
- **go2rtc's WebTorrent page** is backend-free, with its secrets in the URL fragment and the SDP sealed with AES-GCM. But its password can be 4 characters, so the relay can guess it offline. Its WebRTC docs: STUN fails for "about 20% of users" behind symmetric NAT.
- **PairDrop:** a 6-digit code or QR, then a 256-character room secret that both keep in IndexedDB, so "pairing is persistent". Its signaling isn't sealed (#180).
- **Excalidraw:** keeps the key in `#key=`, since "anything that's added after the `#` doesn't get sent to the server".

## 2. Key takeaways

1. **The relay passes sealed handshakes and nothing else.**
   - The SDP, its DTLS fingerprints, and ICE candidates travel sealed in a Noise IK session between the paired keys. The relay can't read, change, or replay them, and can't tell which device connects.
   - The browser's own fingerprint check then binds the data channel to those keys.
   - All the owner's traffic is on that channel, peer to peer.
2. **Noise needs no library.** It runs on Web Crypto in both the browser and Node, and passed the official vectors here.
3. **A QR code for a phone with a camera, and a short code for everyone.** The QR's 256-bit secret needs no PAKE. A short code needs CPace, about 28 lines on `@noble/curves`, which passed the draft's vectors. Either way, both screens show six digits, and the owner approves.
4. **A pairing is a key, kept for good.**
   - A device is its public key in fxbot's database, with no token and no expiry.
   - On the device, the key lives in IndexedDB in the installed app, with `persist()`.
   - What loses it is the owner clearing the data, so a paired device can pair another from anywhere, and a passkey is the opt-in last resort.
5. **The UI comes from the owner's own fxbot, unchanged.**
   - The shell at web.fxbot.sh holds the keys and the connections, and draws the security screens.
   - Each fxbot's UI runs in a frame on an origin of its own, `<frame>.fxbot.sh`, served by that fxbot through the channel.
   - The frame's service worker and a small script give the unchanged UI its `fetch`, `WebSocket`, and URLs.
   - Plugin code there can't reach any key, or another fxbot.
6. **One Cloudflare Worker is the whole hosted part.** It serves the static shell and frame files, and the relay. It stores nothing, costs $0–5 a month at 1,000 fxbots, and an owner can run their own.
7. **STUN only, and say what will work.**
   - **The servers:** Cloudflare's STUN by default, in an ordered list the owner controls, plus TURN of their own.
   - **Most connections are direct.** A symmetric-NAT carrier against a home router, or a workplace that blocks UDP, needs one of these: a mapped port, IPv6, the owner's TURN, Tailscale, or WireGuard.
   - **The checks:** fxbot checks its own side in advance, and the device checks its side as it connects.
   - **A failed connection** names the cause, and links to the docs page that fixes it.
8. **Instance side: a plugin with all of the peer-to-peer code, in Essentials, and two small general hooks:** `fx.secrets` and `fx.localUrl`. Its WebRTC is werift, pure TypeScript, bundled into the plugin's server file. node-datachannel, native and 2–3× faster, stays the way out behind the same `RTCPeerConnection` API if werift fails a browser.
9. **Plan for iOS:**
   - Pair inside the installed app.
   - Expect the channel to drop on every app switch, and reconnect on return.
   - Notifications to a closed app are Web Push, a later phase.

## 3. Implementation

### How it fits together

```
 phone or laptop                                                     the owner's machine
 ┌──────────────────────────────────────────┐                     ┌──────────────────────────────┐
 │ web.fxbot.sh: the shell                  │   sealed handshake  │ fxbot                        │
 │  device keys, pairings, connections,     │ ◄─── via relay ───► │  web-pairing plugin          │
 │  pairing and approval screens            │                     │   keys, devices, the bridge  │
 │  ┌─────────────────────────────────────┐ │   WebRTC data       │     │                        │
 │  │ <frame>.fxbot.sh: fxbot's UI, its   │ │ ◄═ channels, P2P ══►│     ▼                        │
 │  │ plugins, from the channel           │ │   (DTLS)            │  its own API, at fx.localUrl │
 │  └─────────────────────────────────────┘ │                     └──────────────────────────────┘
 └──────────────────────────────────────────┘
                 ▲
                 └─ web.fxbot.sh/signal: the relay, one Durable Object per fxbot. It passes sealed
                    messages and stores nothing.
```

**Names:**

| Name | What |
| --- | --- |
| `https://web.fxbot.sh/` | The shell: the installable PWA. |
| `wss://web.fxbot.sh/signal/…` | The relay. |
| `https://<frame>.fxbot.sh/` | One frame origin for each pairing. `<frame>` is 16 random base32 characters the shell picks, so the name says nothing about the fxbot. Cloudflare's free certificate covers first-level names of fxbot.sh only; `<frame>.web.fxbot.sh` would need Advanced Certificate Manager. The frames are same-site with the shell, so their storage and service workers aren't a third party's. |

### Keys

On fxbot, made by the plugin on its first start, and sealed with `fx.secrets`:
- **`I`, X25519:** its Noise static key.
- **`L`, Ed25519:** its key for listening at the relay.
- **`rid`, its address at the relay:** the first 16 bytes of `SHA-256("fxbot/1 rid" ‖ L.pub ‖ I.pub)`, in base32. It's self-certifying: the relay checks a listener against it.

Both keys are in the database, so a backup carries them, and a restore keeps every pairing. A fresh install makes new keys. Its devices then show "This fxbot's key changed. Pair again." It never trusts a new key silently.

On each device, made by the shell when it pairs:
- **`D`, X25519:** `generateKey({ name: "X25519" }, false, ["deriveBits"])`, so it's non-extractable. It's kept in the shell's IndexedDB with `{ rid, I.pub, relay, deviceId, frame, name, seq }`.

On fxbot, for each device:
- **A row in `plugin_web_pairing.devices`:** `id, name, platform, key (D.pub), paired_at, paired_by, last_seen, last_seq`.

Nothing else is stored, by either side.

### Pairing

**The owner starts it where fxbot already trusts them:**
- Settings › Devices › **Pair a device**, on the machine or over Tailscale.
- On a server with no browser: an SSH tunnel to its loopback, `ssh -L 8787:127.0.0.1:8787 <server>`, opens its Settings on the owner's laptop, as the docs show. `deploy/` doesn't change.
- **Pair another device** on a paired device.

Only that side shows a code, so an attacker can't hand the owner one that grants access.

fxbot makes a ticket in memory, never on disk:
- **`tid`:** 16 random bytes.
- **`S`:** 32 random bytes.
- **Its life:** 10 minutes, and it dies on its first failure.
- **Its code:** a nameplate `N` it claims at the relay, plus 8 random digits: `N-DDDD-DDDD`, such as `47-3816-0925`.

It shows the code, and a QR code of the link `https://web.fxbot.sh/pair#1.<rid>.<tid>.<I.pub>.<S>`, about 170 characters. The fragment never reaches a server.

**The new device:**
- **With a camera whose link opens in the same storage,** it opens the link: a laptop, or Android Chrome, whose installed apps *likely* share its storage.
- **In the installed app,** it scans the QR with `BarcodeDetector` where the browser has it, or types the code. On an iPhone, the shell says to add web.fxbot.sh to the Home Screen first, and pair in that app.

**A typed code runs CPace first** (CPACE-RISTR255-SHA512, draft 21):
1. **C1,** device → relay → nameplate `N` → fxbot:
   - `Ya` and a 16-byte `sid` from the device.
   - `PRS` = the 8 digits.
   - `CI` = `lv_cat("fxbot/1 pair-code", N)`, with `ADa = "fxbot/1 device"`.
2. **C2,** fxbot → device: `Yb`, `ADb`, and `AEAD(HKDF(ISK, "fxbot/1 code"), { rid, I.pub, name, tid })`, which confirms the key.
   - The device checks the decryption.
   - The code is now spent: one CPace run per code.
   - CPace's `ISK` takes the place of `S` for what follows.
3. **The lockout:** three spent codes in 15 minutes lock pairing for 15 minutes, with a note in Settings. Magic Wormhole allows one guess per code, and Matter closes after 20.

**Then, either way, Noise IKpsk2:**

| Step | Message | Payload |
| --- | --- | --- |
| P1, device → fxbot | IKpsk2 message 1. Prologue `"fxbot/1 pair" ‖ rid ‖ tid`; the remote static is `I.pub`; `psk = HKDF(S, "fxbot/1 pair psk")`. | `{ name, platform }`. The device's `D.pub` goes encrypted. |
| P2, fxbot → device | message 2 | `{ deviceId, name }`. Once decrypted, the device knows the other end holds `I` and `S`. |
| P3, device → fxbot | the first transport message | `{ confirm }`. Once decrypted, fxbot knows the device holds `S`. |
| Approval | | Both screens show six digits, `HKDF(handshake hash, "fxbot/1 sas")`. The owner checks they match, and taps **Approve** on the side that showed the code. |
| P4, fxbot → device | | `{ approved }`. fxbot writes the device's row, burns the ticket, and tells every paired device that one was added. |

**Then the device secures its storage:**
- The shell calls `navigator.storage.persist()`, and Settings in the shell shows whether it was granted.
- It offers a passkey (M7), and suggests pairing a second device.

### Connecting

Each launch, return to the front, or network change, the device runs Noise IK (`"fxbot/1 connect" ‖ rid`):

| Step | Message | Payload |
| --- | --- | --- |
| K1, device → fxbot | IK message 1 | `{ seq, versions }`. `seq` grows on every connect; a Web Lock keeps two tabs from racing it. |
| fxbot | | It finds the device by the static key it decrypted. It refuses a key it doesn't know, a revoked one, or a `seq` no greater than `last_seq`, as WireGuard keeps the greatest timestamp from each peer. |
| K2, fxbot → device | IK message 2 | `{ iceServers, reachability }`: the owner's ordered list, STUN and any TURN of theirs with fresh credentials, and what fxbot found about its own network |
| Transport messages, both ways | AES-GCM with strict counters | the offer, the answer, and each ICE candidate |
| The channel | | The browser checks the DTLS certificate against the fingerprint it received. Each side's first data-channel message is `HMAC(k, role ‖ handshake hash)`, as a cheap second check. |

What this gives:
- **Forward secrecy:** the transport keys come from fresh ephemerals, so the SDP and the candidates are forward-secret, and DTLS gives the channel its own.
- **What the relay sees:** a `rid`, the IP addresses of its two sockets, timing, and sizes. It doesn't see which device, the candidates, or the SDP.
- **Certificates:** each connection uses a fresh DTLS certificate. libwebrtc caps a stored one at a year.

The device reconnects:
- on `visibilitychange` to visible, on `online`, and on a network change
- with a new `RTCPeerConnection` after a suspension, since iOS kills the channel within about a minute in the background
- with `restartIce()` while the page lives

### The relay (`packages/web-app/relay/`)

One Worker with a Durable Object class, about 120 lines:

| Route | Who | What |
| --- | --- | --- |
| `wss://web.fxbot.sh/signal/listen/<rid>` | fxbot | The relay sends a nonce. fxbot answers with `L.pub`, `I.pub`, and a signature, and the relay checks `rid` against them. One listener per `rid`; a newer one replaces it. |
| `wss://web.fxbot.sh/signal/call/<rid>` | a device | Each message goes to the listener tagged with a call id, and each answer back by it. Nobody signs in to call: the handshake decides. |
| `wss://web.fxbot.sh/signal/plate` | fxbot | Claims a free nameplate, 1–999, for 10 minutes. The plate is a tag on fxbot's socket in a nameplate object, so a code reaches it with nothing stored. |
| `wss://web.fxbot.sh/signal/call/plate/<N>` | a device typing a code | The same, to that nameplate's socket. |

**Rules:**
- Messages of 16 KB at most, 64 messages to a call, and 30 calls a minute to a `rid`, counted in memory.
- No `ctx.storage`, no alarms, and logs off.
- The listener sends a small application ping every 30 s, which `setWebSocketAutoResponse` answers without waking the object. Node's own `WebSocket` has no protocol pings.
- It reconnects after a drop with jitter, from 1 s up to 60 s, since a Cloudflare deploy drops every socket at once.
- fxbot connects only while a pairing is open or a device is paired. With Essentials on every new install, that keeps the relay's load to owners who use it.

**Settings › Devices names the relay,** `https://web.fxbot.sh/signal` by default. An owner who runs the same Worker on their own Cloudflare account puts its address there, and their links carry it.

### Getting through

**STUN only, by default.** A direct connection is the one path fxbot.sh offers:
- **ICE servers are an ordered list** in Settings › Devices, tried in that order.
  - **The default is one entry,** Cloudflare's STUN, `stun:stun.cloudflare.com:3478`.
  - **The owner controls the rest:** they can add STUN servers of their own, move them ahead, or remove Cloudflare's.
- **TURN is the owner's own, when they add one** to the same list, in one of three forms:
  - **A TURN URL** with a username and password.
  - **A Cloudflare TURN key** on their own account. fxbot mints credentials from it, 48 hours at most.
  - **A coturn or eturnal shared secret.** fxbot mints time-limited credentials from it, with no API call.

  The credentials are sealed with `fx.secrets`, and reach the device in K2.
- **The list is the whole list.** fxbot passes it to werift explicitly, since werift adds Google's STUN by itself when given none. The device gets the same list in K2, before it gathers a candidate. Nothing else is contacted.
- **A small fixed UDP range for ICE,** 8790–8799 by default, through werift's `icePortRange` (*likely*). A forwarded or mapped port then holds.
- **Port mapping:** fxbot asks the router for that range by NAT-PMP or UPnP, renews it, and shows what it got. The library is `@achingbrain/nat-port-mapper`, pure JavaScript, in the plugin's bundle. Mapping is off inside a container, where discovery can't cross the bridge.
- **IPv6** wherever the machine has it.

**fxbot checks its own reachability in advance, and says what it found,** under Settings › Devices › Reachability. It checks when the owner opens Settings › Devices, on **Check again**, and when the ICE list changes. While a device is paired, it also checks every 6 hours. With nothing paired, nothing runs in the background:

| Check | How | What the owner reads |
| --- | --- | --- |
| UDP out | any STUN answer at all | none: "This network blocks UDP, so devices can't connect directly. Use Tailscale or WireGuard, or a TURN server of your own over TLS." |
| Its public address | STUN's answer, against the external address port mapping reports | when they differ, or the address is in 100.64/10: "This fxbot is behind carrier-grade NAT. Devices on other networks likely can't reach it directly, and forwarding a port won't help. TURN, Tailscale, or WireGuard will." |
| How its NAT maps | the mapped port that two STUN answers report for one socket; different ports mean a symmetric NAT | it needs two answers: two servers in the list, or one server at two addresses. With one, it says it can't tell. |
| A mapped port | port mapping's answer | "Devices on any network that allows UDP can likely reach this fxbot." A port forwarded by hand can't be seen from inside, so it says so. |
| IPv6 | a global address, and a STUN answer over it | "Devices with IPv6 can likely connect directly." |
| A container | `/.dockerenv` or `/run/.containerenv` | "Port mapping can't work from inside the container. To forward a port, publish 8790–8799/udp" (with the docs' compose override) |

At the top, one line sums it up:
- "Likely reachable from most networks"
- "Reachable from many networks, but not from phones on some carriers"
- "Not reachable directly from outside this network"

The owner sees this before pairing, so they know in advance what a phone at work will need. fxbot sends the same findings, a few fields, to each device in K2.

**The device checks its side as it connects,** from its own ICE candidates:
- no server-reflexive candidate means its network blocks UDP
- two different mapped ports from two STUN servers mean a symmetric NAT
- an IPv6 candidate means it has IPv6

**When no direct path works within 15 seconds,** the shell shows a notice:
1. **What happened:** "Your fxbot answered, but no direct path works between this network and it."
2. **What each side found,** such as:
   - "This network blocks UDP."
   - "This phone's network maps ports per destination, and your fxbot has no mapped port."
   - "Your fxbot is behind carrier-grade NAT."
3. **What would work, in order,** each a link to its page in the docs:
   - another network
   - a mapped or forwarded port at home
   - a TURN server of your own
   - Tailscale
   - WireGuard

The handshake succeeded, so this notice never covers for a wrong key or a removed device; those have messages of their own.

### The bridge (in the plugin)

**One data channel per request,** and one per WebSocket, so each has its own flow control, and nothing waits behind a long stream. A channel opens in-band, with no signaling, so a new one costs little. M1 checks werift with a hundred open at once. If it can't keep up, the bridge carries framed streams on one channel instead.

| Message | Contents |
| --- | --- |
| The first one, the head | `{ kind: "http", method, path, headers }` or `{ kind: "ws", path, protocols }`, as JSON. `path` is a path only, such as `/api/profiles`, never a host. |
| The body | binary chunks of 16 KiB, well under the 64 KiB werift takes, then an empty message for its end |
| The answer's head | `{ status, headers }`, then its body the same way |
| A WebSocket | each message as one, marked text or binary, and closing the channel closes the socket |

**fxbot's side:**
- **HTTP:** it sends `fetch(fx.localUrl + path)` with the head's method and headers, minus `Host`, `Origin`, and `Cookie`. A request with no `Origin` passes the server's check, as a tool's does (`index.ts:309-312`). The tunnel only carries what the paired device's frame sends, so the check's purpose, other sites' pages in the owner's browser, doesn't arise.
- **WebSockets:** Node's own `WebSocket` to the same address, piped both ways.
- **Flow control:** each channel waits for `bufferedAmount` to fall below 1 MiB before sending more.

**What a frame can't ask for:**
- **The plugin's device routes** (list, pair, approve, revoke), whose requests from a frame are refused, so plugin code in a frame can't pair a device of its own. Only the shell, over a control channel of its own, and the local UI manage devices.
- **Anything after revoking.** Revoking closes that device's peer connection at once, and it can't connect again.

**MCP sign-ins** use fxbot's paste route, since the bridge sends no origin. The sign-in opens in the phone's browser; the owner pastes back the address it couldn't load, as on a phone today (`mcp.ts:691`).

### The web app (`packages/web-app/`)

**The shell (`shell/`), at web.fxbot.sh:**
- **What it is:** the installable PWA, with its manifest, its own service worker that caches only the shell's files, and a strict CSP: `script-src 'self'`, no `eval`, `connect-src` to the relay only, `object-src 'none'`, `frame-src https://*.fxbot.sh`.
- **What it does:**
  - lists the paired fxbots, each with a dot for connected
  - pairs one, opens one full screen, and shows the connection
  - for each fxbot: its devices, revoke and rename, **Pair another device** with the code and the approval, and whether storage is persisted
  - says when it's in a private window, or on an iPhone outside the installed app
- **What it holds:** the device keys, the `RTCPeerConnection`s, and a `MessagePort` for each frame, which it checks by origin.

**The frame (`frame/`), at `<frame>.fxbot.sh`:** the Worker serves the same three static files for every frame name, and the frame's service worker serves everything else from fxbot:

| Path | Served by | What |
| --- | --- | --- |
| `/__fxbot/start` | the Worker | It runs only inside the shell (`frame-ancestors https://web.fxbot.sh`), registers `/sw.js`, takes a port from the shell, and loads the path the shell asks for. |
| `/sw.js` | the Worker | The frame's service worker. Every other request it gets, it sends to fxbot through the frame's script and the shell: the UI's HTML, `/assets/…`, `/api/library/…` images, a plugin's CSS, the pages plugin's frames, and a page "Open in a tab". The UI's own worker is also `/sw.js`, so registering it changes nothing. |
| `/__fxbot/frame.js` | the Worker | The service worker adds it to the head of every HTML page it serves. It runs before the UI's own code. |

`frame.js` does four things:
- It gives `window.fetch` a direct line to the shell for same-origin URLs, so the chat's endless stream doesn't depend on the service worker staying alive.
- It replaces `window.WebSocket` with one that goes through the shell for this host, as the computer's desktop and terminal use it.
- It makes `navigator.serviceWorker.register` a no-op for any other script.
- It hands the service worker a new port to the shell when the worker asks.

**Caching:** fxbot's `/assets/` are content-hashed, so the frame's service worker caches them, and a reopened app draws at once while it connects. The HTML is fetched fresh each time.

### Settings › Devices (the plugin's tab)

- **Pair a device:** the code, the QR, then the approval with the six digits.
- **Each device:** its name, what it is, when and how it was paired, and when it was last seen. **Rename** and **Remove**.
- **Remote access:** on or off. Off closes the relay connection and every channel.
- **Reachability:** the summary line and each check, with **Check again**, and a link to the docs for each finding.
- **ICE servers:**
  - the ordered list, Cloudflare's STUN first by default
  - add a STUN server, or one of the three kinds of TURN
  - move an entry up or down
  - remove any entry, Cloudflare's included
- **The relay,** the ICE ports, and the port mapping and what it got.
- **This fxbot's key fingerprint,** for comparing.

### Staying paired

| What could break a pairing | What keeps it |
| --- | --- |
| Time | No expiry, and no token to renew. A device unseen for a long time stays until removed. |
| fxbot restarts or updates | Its keys are in the database, and the relay connection comes back by itself. |
| A restore from backup | The keys come back with the database. |
| A reinstall from nothing | New keys. Devices say so, and pair again. |
| The relay dropping, or Cloudflare deploying | Reconnects with jitter; devices retry the handshake. |
| iOS backgrounding, or a network change | Reconnects on return and on `online`, with a new connection after a suspension. |
| Safari's 7-day deletion | Pairing happens in the installed app, whose domain is exempt; `persist()`. |
| Storage pressure | `persist()`, and the shell shows whether it was granted. |
| The owner clears the device, or loses it | **Pair another device** from any paired device, anywhere. A passkey (M7, opt-in) pairs again with no other device. **Remove** the lost one from any device. |

### Threats

| Threat | What stops it | What's left |
| --- | --- | --- |
| The relay, or someone on its path | Noise between pinned keys; the SDP, fingerprints, and candidates sealed; counters | It sees `rid`, IPs, timing, and sizes; it can refuse service; one guess per typed code |
| STUN, or the owner's TURN | DTLS end to end | They see IPs and volume |
| web.fxbot.sh served bad code (its host, DNS, CI, or a dependency) | A small shell; non-extractable keys; every new device announced to all; reproducible builds with published hashes | Use of the keys and the UI while that code runs. A web app can't fully prevent this, and an Electron or native shell later would. |
| Plugin page code or XSS in fxbot's UI | Its own origin for each frame; no keys there; the device routes refused from frames | It can do what fxbot's own page can, as today |
| A lookalike site asking for a code | Codes typed in the installed app; QR links carry the real address; 10-minute codes; approval with six digits; new devices announced | An owner who reads a live code to someone and approves |
| A leaked or overheard code | Single use, 10 minutes, approval | Approving the wrong device |
| A replayed or forged handshake | `seq` for each device; AES-GCM counters; single-use tickets; the suite named in the prologue | None known |
| Burning codes to block pairing | Nameplate and call limits; the lockout, with a note | The relay can always refuse service |
| A stolen phone | Its lock screen; **Remove** from another device | The time until it's removed |
| A copied browser profile | Revoke; WebKit's Keychain wrapping | Chromium stores the key's bytes |
| fxbot's database and secret key file both taken | Sealing; protected backups | Impersonation until devices pair again |

### The docs

The notice and Reachability link straight to these, so each page has a section per case. They describe what each thing does, step by step.

**Using it:**
- **How-to: Reach fxbot from your phone.** Install the app (on an iPhone, add it to the Home Screen first), pair, the six digits, and pairing a second device.
- **How-to: Pair another device from one you have,** and remove a lost one.
- **How-to: When a device can't connect.** Each finding the notice and Reachability show: what it means, and the fixes, in order.

**Getting through, in detail:**
- **How-to: Forward or map a port.** The ICE range; UPnP and NAT-PMP on common routers; a forward by hand; publishing the range from the release's containers with a compose override; and checking it under Reachability.
- **How-to: Reach fxbot with Tailscale.** The existing Reach it and Tailscale service pages, with a phone's steps added: the app, `tailscale serve`, and MagicDNS. Tailscale works where UDP is blocked, over its DERP relays. With it on, web pairing *likely* connects through the tailnet too, since fxbot's tailnet address is one of its candidates.
- **How-to: Reach fxbot with WireGuard.**
  - **Where it runs:** on the router where it has WireGuard, or on fxbot's machine, with UDP 51820 forwarded.
  - **Setting it up:** keys, a peer for each phone with `AllowedIPs` of fxbot's machine only, the phone's app, and a QR of its config.
  - **Opening fxbot:** through web pairing over the tunnel, *likely*, or with a proxy on the WireGuard address, since fxbot listens on loopback.
  - **When it doesn't help:** when the home itself is behind carrier-grade NAT, the page says so.
- **How-to: Run your own TURN server.**
  - **On a small VPS,** with coturn or eturnal:
    - TLS on 443 with a certificate, for networks that allow only HTTPS
    - `use-auth-secret` with a shared secret
    - `denied-peer-ip` for private and link-local ranges, so it can't be turned on the VPS's own network
    - a quota for each user, and logging off
    - the firewall
    - the secret into Settings
  - **Or Cloudflare's TURN on your own account:** make a TURN key, and put its id and token into Settings. 1,000 GB a month is free, then $0.05/GB of what Cloudflare sends.
  - **Either way,** what a TURN server sees: IPs, timing, and volume; never the contents.
- **How-to: Run your own STUN server.** coturn with `stun-only`, or another public server; then put it first in the list, or remove Cloudflare's.
- **How-to: Run your own relay.** The same Worker on your own Cloudflare account, and its address in Settings.

**Understanding it:**
- **Explanation: How web pairing works.** The shell and the frame; the handshake relay; STUN and TURN; what each party sees; and why some networks can't connect directly, with the cases in the Reachability table.
- **Reference: the `web-pairing` plugin's settings, and what fxbot.sh hosts.**

**Also:**
- **Reach it** gets a line on web pairing beside Tailscale.
- The plugin directory gets the plugin.
- **Onboarding's Essentials** says it adds web pairing, STUN only.
- `CHANGELOG.md` and the README.

### Cost

**For the owner:**
- **Nothing to install on the machine,** and no account.
- **Idle cost:** none until a device is paired. Then one WebSocket to Cloudflare, with a ping every 30 s, and a reachability check every 6 hours.
- **A connection:** about 1 second of setup, *likely*, and then whatever the UI asks for, over the channel.
- **First open on a new device:** about 1.5 MB of fxbot's page, cached after.

**For the project:** $0 a month on Cloudflare's free plan to about 1,000 fxbots, then $5–23 a month to 10,000. No TURN bill.

**For the page:** none in fxbot's own UI. The frame adds `frame.js`, a few KB, before it.

### Not in this phase

- **Hosted TURN.** Owners deploy their own. A hosted cloud version of fxbot, if one comes, could include it.
- **A second relay for devices to fall back on,** so an outage of one doesn't stop reconnects. The owner's call (2026-11-09): later, if adoption grows. Until then, there's one relay, and the owner's own as a setting.
- **PCP port mapping,** until a pure-JavaScript library is fit for the bundle. NAT-PMP and UPnP are in.
- **Notifications to a closed app.** These would be Web Push signed by fxbot's own VAPID key, which needs no host of fxbot's, as OpenClaw's gateway does.
  - On iOS, Web Push works only in Home Screen apps.
  - Each frame origin is a scope of its own, which suits one key for each fxbot.
  - A later phase.
- **Rotating fxbot's key without pairing again,** with a signed handover.
- **A native or Electron phone app,** which would end the web-code trust question.
- **Devices with limited rights,** such as read-only. Every paired device is the owner.
- **Ending devices unseen for N days.** Off, and not built.
- **A recovery code.** The passkey covers it, and can't be phished.

### What changes

All of the peer-to-peer code is in the plugin and the web app. Core gains only two general plugin-API hooks, and a line of data.

| Where | Change |
| --- | --- |
| `plugins/web-pairing/` | New: `plugin.json`; `fxbot/server.ts` (keys, relay, pairing, devices, reachability, the bridge); its migration; `page.jsx` and `page.js` (the Devices tab); README. Also `fxbot/server.js`: its server code bundled by rolldown with werift (pinned, 0.26 or newer), `@noble/curves`, the port mapper, and `packages/web-app/protocol/`, committed beside `server.ts` as `page.js` is beside `page.jsx`. |
| `packages/web-app/` | New: `shell/`, `frame/`, `relay/`, `protocol/` (Noise, CPace, the bridge's messages, and `check.mjs` with the cacophony and CPace vectors), its build, and `wrangler.toml` |
| `packages/sdk/src/plugin-api.ts`, `packages/sdk/src/plugins.ts` | `fx.secrets` and `fx.localUrl`, for any plugin |
| `packages/sdk/src/plugins-registry.json`, `packages/website/public/plugins-registry.json` | `web-pairing` in the directory, and in `essentials` |
| `packages/website/…`, README, `CHANGELOG.md` | The docs above |
| Cloudflare | A Worker for web.fxbot.sh with a wildcard route and DNS record for `*.fxbot.sh` frames, and its Durable Object class |

`deploy/`, the server, the UI, and the SDK's client don't change.

**Size:**

| Part | Lines | Built |
| --- | --- | --- |
| Protocol: Noise, CPace, and the bridge's messages | about 200 | 510, with the WebSocket framing, the error texts, the passkey's helpers, and the docs links both sides share |
| The relay | about 120 | 236, with the shell's and frames' files and headers |
| The plugin's server: keys, relay, pairing, devices, the bridge | about 450 | 825: `server.ts` and `bridge.ts` |
| Reachability and port mapping | about 150 | 254, with the ICE list and TURN credentials |
| The plugin's Devices tab | about 250 | 310, and 12 of CSS |
| The shell, with the notice | about 500 | 854, with passkeys and its worker, and 83 of CSS |
| The frame | about 200 | 319 |
| SDK hooks | about 30 | 33 |
| The vectors check | about 60 | 65 |
| Passkeys (M7) | | 132, in the shell and the plugin |
| Docs | about 700 | 635 in 10 new pages, and Reach it |

### Built

Where the build went its own way, and why:

- **werift 0.25.2,** not 0.26. 0.26.0 came out on 2026-11-01, under the two weeks a dependency waits. M1 ran on 0.25.2.
- **fxbot makes the WebRTC offer,** and opens the control channel; the device answers, and opens a channel of its own for each request. With the device offering, werift is DTLS's client, and Firefox never connected ([#438](https://github.com/shinyoshiaki/werift-webrtc/issues/438)). With fxbot offering, the browser is the client, and Firefox, Chromium, and WebKit all connected (M1). So no fork of werift was needed.
- **A listener proves its keys in the URL,** signing its address and the time with Ed25519, which the relay checks within two minutes before it accepts the socket, in place of a nonce round trip. A socket's role then lives in its tags from the start, which hibernation keeps.
- **Envelopes:** after each handshake, every message is a sealed `t`. P3 and P4 are such messages, not kinds of their own. A passkey pairs with `r1` and `r2`. An `err` carries a name, and both sides keep the words for it in `wire.ts`.
- **fxbot's offer comes whole,** with its candidates gathered, in 5 seconds at most; the device answers at once and sends its candidates as they come.
- **A new connection, not `restartIce()`.** After a drop or a return to the front, the device runs the handshake again and makes a new connection, which covers a suspended page and a changed network alike.
- **The channel check is on the control channel,** each side's first message, and fxbot serves no other channel until it passes, rather than on every channel.
- **The tab is Settings › Web pairing,** since a plugin's tab takes its name. Its settings, the ICE list with its credentials among them, are sealed with `fx.secrets` beside the keys, not plugin settings. It polls; it has no socket.
- **A WebSocket's messages go in pieces,** each up to 16 KiB with a first byte that says whether it's text and whether more follows, since werift takes 64 KiB at most and the computer's frames can be bigger. Each side starts with a head, so a refused socket says so.
- **Sandboxed frames are written in as `srcdoc`.** Browsers don't send a sandboxed frame's page, one without `allow-same-origin`, through a service worker, so the pages plugin's HTML pages reached the Worker, which has none of fxbot's. The frame's worker now writes such a frame's page into the frame around it, with the page's own policy as a meta tag. A `srcdoc` page also takes the policy of the page around it, so that page's policy takes in the framed page's sources; its own text is the plugin's fixed shell. Found by M1's check of the pages plugin's shape.
- **A device key where X25519 keys can't be stored.** WebKit's Linux build, which Playwright runs, refuses to store an X25519 `CryptoKey` in IndexedDB; ECDH and AES keys store. There, the shell keeps the key's bytes sealed under a non-extractable AES-GCM key. Real Safari wasn't checked, and takes the same path if it refuses.
- **Pairing doesn't wait on `persist()`.** Firefox asks the person first, so the answer can come long after. The **Devices** screen shows it when it comes.
- **Ports.** Each connection takes one or two UDP ports, so the ten in 8790–8799 fill with a few devices. A device's new connect closes its own attempts that never connected, an attempt that never connects ends at 20 seconds, and when every port is taken, a connection uses another and the log says so. IPv6 sockets open only where the machine has a global IPv6 address.
- **werift falls back to Google's STUN** when given no STUN server. With none in the owner's list, it's given `127.0.0.1:9` instead, so it contacts no one it wasn't told to.
- **A code survives the relay restarting** as a new code: the ticket claims another nameplate, and the screen shows it. Opening a pairing reconnects the listener at once rather than waiting out its backoff. Node's `WebSocket` fires only `error` when the relay refuses an upgrade, so the listener treats that as a close.
- **A fresh install's devices say "isn't connected to the relay",** with "if it was installed again from nothing, it has new keys: pair again". A new install has a new address at the relay, so a device can't tell a new key from an fxbot that's off.
- **werift, patched, and channels kept.** The owner's first phone, on cellular, loaded fast for about 30 seconds and then nothing more. A capture showed the connection alive, with pings answered both ways, while fxbot sent no data at all. Loading the page over werift's own simulated loss of 3 to 5% stalled it the same way, and showed three faults in werift 0.25.2's SCTP:
  - Ordered delivery left a waiting message behind after handing up the one before it, until another chunk came on its stream. A channel's open message lost and sent again arrived after its request, and the request, waiting on its answer, was never delivered.
  - Gap blocks and the cumulative TSN sorted TSNs as text, which breaks at a power of ten and at the 32-bit wrap.
  - Closing a channel resets its stream at both ends, and under loss werift's reset could land on the next channel to reuse the number, whose answer never came, patched or not.

  `plugins/web-pairing/werift-patches.mjs` fixes the first two in the bundle, as exact replacements its build applies. For the third, a channel now carries one exchange after another and is never closed: the app keeps a pool, a cancelled request says `{"abort":true}` and still gets its end, and a WebSocket closes with `{"close":true}` and `{"closed":…}`. fxbot says `reuse` in K2, so an app before this closes channels as it did. Checked over 5% loss each way: 600 requests on reused channels finished in 16 to 18 seconds five times out of five, where a channel for each stalled within a minute; through the whole stack, 6,099 requests and 153 WebSockets in 90 seconds with none failing, where the app before this hung one request for 30 seconds.
- **Consent waits for a slow answer.** With those fixed, the owner's iPhone on cellular still dropped, 30 to 72 seconds in, and the log said "its path stopped answering": werift's consent to send had expired. It waited for each consent check's answer twice the last round trip, at least half a second, and cancelled it when it sent the next, every 4 to 6 seconds. A cellular link's round trips grow past a second while a page loads, so every answer came too late, and a path still carrying data was called dead after 30 seconds. Two werift peers on this machine, through a relay holding one side's packets 1.5 seconds, showed it: the path failed at 39 seconds with data still flowing. A fourth patch in `werift-patches.mjs` gives each check the whole 30-second window, as browsers give theirs up to a minute, and stops the next check cancelling it. Patched, the same path stayed up with answers held 1.5 and 4 seconds, and one whose answers stopped was still called dead, 25 seconds after the last.
- **A phone's `.local` candidate no longer holds the rest.** werift waits up to 10 seconds to resolve one, which nobody can answer for a phone elsewhere, and fxbot handled each candidate in turn, so the owner's iPhone took 10.4 seconds to connect. Candidates now go to werift without waiting: 0.4 seconds.
- **Only interfaces a device can reach.** werift opened a socket on every interface, container bridges too, so on a machine with five each connection took five of the ten ICE ports. fxbot now gives it the machine's addresses less containers' bridges.
- **Each connection is logged:** its route, how long its answer and its path took, and each drop, and the tab shows a connected device's route.
- **The frame's worker loads pages by GET only,** and fxbot's pages there allow framing by the app and the frame alone, and send no referrer to other sites. Without it, another site in the same browser that learned a frame's name, which a link out of fxbot's page would tell it, could send a form there while the app was open, and its POST would reach fxbot through the connection. Checked: a form POST from another site is refused at the worker, nothing reaches the bot, and another site can't frame the page.
- **The shell's CSP allows any `wss:` relay,** not fxbot.sh's alone, since an owner may run their own, and `ws:` only when the shell itself is plain http on the owner's machine.
- **Removing the plugin unpairs everything:** removing a plugin drops its schema and its sealed values, keys among them. **Remote access** off pauses it instead.
- **fxbot's name,** shown on devices, is the first part of its machine's hostname.
- **Passkeys (M7).** A passkey's user id carries the fxbot's address and key, so a wiped device finds it: 49 bytes, within WebAuthn's 64. The relay isn't in it: the recovery screen takes one, fxbot.sh's by default. The challenge is a hash of the device's new key, the time, and a nonce, so one prompt pairs it, and fxbot checks the origin, the rpId, user presence and verification, the signature, the time within two minutes, and that the nonce is new. A refused passkey is logged, and doesn't count toward the lockout, which is for wrong codes. A passkey keeps fxbot listening, so it works with no other device paired.
- **The Worker's environments:** `wrangler.toml`'s top level is `npm run dev` on this machine, at `localhost:8771` with frames at `<frame>.localhost:8771`, since routes make `wrangler dev` rewrite every host; `[env.production]` has the routes, and `npm run deploy` uses it.
- **Typechecks:** `packages/web-app` isn't a workspace, so wrangler stays out of fxbot's image, and has three typechecks of its own: the pages, the workers, and the Worker. The plugin's server is checked by its own `tsconfig.json`, since it needs its bundle's packages, and `plugins/tsconfig.json` leaves it out.
- **A request through the bridge** takes fxbot's own limit for plugin routes, 12 MiB; the bridge's own is 256 MiB.
- **Licenses:** `server-licenses.txt` and `page-licenses.txt` beside the plugin's bundles, and `licenses.txt` in the shell, each with the license of every package the bundle carries. `server.js` is 1 MB, under fxbot's 2 MiB for a plugin's file.

## 4. Checklist

**M1. The risky parts first.** A spike, before the rest. Each answer goes into this doc.
- [x] A frame on `<frame>.fxbot.sh` inside web.fxbot.sh registers its service worker, and serves fxbot's UI, an image, a plugin's CSS, and the pages plugin's sandboxed frame through it. Check it on iOS Safari and in an iOS Home Screen app, Android Chrome and its installed app, and desktop Chrome, Firefox, and Safari. *Checked in headless Chromium, Firefox, and WebKit, at `localhost:8771` with frames at `<frame>.localhost:8771`: the UI with its bot, an image by address, the Web pairing tab's stylesheet, and a sandboxed frame in a frame with the pages plugin's headers, which needed `srcdoc` (see **Built**). The phones and their installed apps weren't run: they're human checks.*
- [x] werift 0.26, bundled, against Safari on iOS and macOS, Android Chrome, and Firefox, which werift's open issue says never connects ([#438](https://github.com/shinyoshiaki/werift-webrtc/issues/438)).
  - Each gets a channel, a 32 MB file both ways, and a hundred channels at once.
  - If a browser can't connect, werift gets the fix, upstream or in a fork the plugin bundles, since it's plain TypeScript, and this doc says so. A native library would need core to carry it, which the owner ruled out.

  *werift 0.25.2. With the browser offering, Firefox never connected, as the issue says. With fxbot offering, all three did, with no fork: setup in 260 ms (Chromium), 145 ms (WebKit), and 119 ms (Firefox); 32 MB down and up at 33.7/47.9, 30.5/36.1, and 14.2/33.0 MB/s; a hundred channels in 15, 10, and 10 ms. Through the finished bridge, 32 MB down at 28–33 MB/s in each. iOS, macOS Safari, and Android weren't run.*
- [ ] An iPhone app sent to the background loses its channel, and returns to a working one within 3 s of coming back. *Not run: no iPhone here. The shell reconnects on `visibilitychange`, `online`, and a network change, and after a drop.*

**M2. Protocol and relay**
- [x] `packages/web-app/protocol/`: Noise IK and IKpsk2, CPace, and the bridge's messages. `check.mjs` runs the cacophony and CPace draft-21 vectors, and the plugin's README says to run it after any change. *16 checks pass.*
- [x] The relay Worker, listen, call, and nameplates, under `wrangler dev`:
  - a listener with the wrong key is refused
  - the limits hold
  - the Worker uses no storage API (checked in its code)
  - logs are off

  *17 checks pass: a listener signing with another key, with an old time, or for another address is refused; a call with no listener hears `offline`; messages reach the listener by call and back; ping and pong; a message over 16 KB, a call's 65th message, and calls past 30 a minute are refused; a newer listener replaces the older; a nameplate is claimed, reached, answered, and refused to a second device and to a code nobody holds. `worker.ts` has no storage, alarm, attachment, or console call, and `wrangler.toml` turns Workers Logs off.*

**M3. The plugin**
- [x] `fx.secrets` and `fx.localUrl`, with notes under `## Unreleased`.
- [x] Keys made once and sealed; `rid`; the listener, which reconnects after the relay is killed. *The relay killed and started again: fxbot listened again 4 s after it was up. A code open meanwhile came back as a new code, which paired.*
- [x] No relay connection until a pairing opens or a device is paired, and none after the last device is removed. *And none after the last passkey is removed.*
- [ ] `web-pairing` in `essentials`: a new install's onboarding adds it, and with nothing paired it makes no connection and no timer. *In the list and in Essentials. A fresh install with nothing paired had no relay connection, and the code starts no timer until it wants one. Onboarding adding it wasn't run: it adds plugins from the repository's default branch, which has no `plugins/web-pairing` until this release is merged.*
- [x] Pairing by link and by code, against a check page that stands in for the shell:
  - approval with the six digits
  - a wrong code burns it, and three lock pairing
  - a ticket dies after 10 minutes, and with a restart

  *Against the shell itself, in three browsers, and from Node as a device: the same six digits on both sides, by link and by code; a wrong code ends its ticket, and three lock pairing and refuse a new one; a ticket from before a restart is refused as expired; and one left open was open at 9 minutes 55 seconds and expired at 10 minutes 5, its code and link gone.*
- [x] Connecting: an unknown key, a removed one, and a replayed K1 are refused. *And a K1 with an older counter.*
- [x] The bridge: JSON, the chat's stream, a 32 MB file, and the computer's desktop WebSocket, through the channel. The device routes are refused from a frame. Removing a device closes its connection at once. *In three browsers: JSON, a chat's reply streamed into the UI from a mock model, 32 MB down, 11 MiB up (fxbot takes 12 MiB at most in a plugin route), and a WebSocket with text and a 100 KB binary message, through a check plugin's echo: the computer can't run in checks as root here. The device routes answered 403 in the frame, and removing the device closed its connection, which said why.*
- [x] A server with no browser, paired through an SSH tunnel to its 127.0.0.1:8787. *Paired through the server's loopback, which is what the tunnel reaches; the tunnel itself wasn't run.*

**M4. The web app**
- [x] The shell: pair, list, open, reconnect, Devices, Pair another device, `persist()`, and the private-window and iPhone notes. *Pair, list, open, a reload that keeps the pairing and opens it again, the Devices screen, and pairing a second device by a code from the first, approved there, which then showed the new device's name. The private-window and iPhone notes weren't seen: the checks run neither.*
- [x] The frame: the unchanged UI, plugins and all: a chat, the library, the computer's desktop, a page, and Settings. *A chat, an image by address, a sandboxed page as the pages plugin draws one, and Settings › Web pairing, which says to use the web app's own screen. The computer's desktop wasn't run.*
- [x] Against a disposable fxbot on this machine, with `FXBOT_PORT` off 8787 and a local relay. *Port 8772, its own Postgres on a tmpfs, and the relay at 8771.*

**M5. Getting through, and saying so**
- [x] The ICE list, with Cloudflare's STUN as the one default entry:
  - add, move, and remove entries, Cloudflare's included
  - the three kinds of TURN, with credentials minted and sealed
  - a capture on fxbot's machine shows packets only to listed servers, and none to Google's

  *9 checks: each kind added, an address that isn't STUN refused, no password or secret back to the page, a shared secret minted into a 24-hour credential, the list in order to the device, Cloudflare's removed and back. A Cloudflare TURN key with a made-up token was refused by Cloudflare and added nothing; a real key wasn't tried. A capture on every interface during a pairing and connection: fxbot's ports 8790–8794 and the browser sent STUN to `stun.cloudflare.com` only, with no packet to Google's and no lookup of it; the only other STUN was the machine's own Tailscale.*
- [ ] The fixed UDP range, IPv6, and NAT-PMP and UPnP mapping, renewed and shown. *werift's sockets were on 8790–8795. IPv6 sockets open only with a global address, which this machine hasn't. Mapping: no router here answers either protocol, and the tab says so; a mapping and its renewal weren't seen.*
- [x] Reachability, each case in a throwaway container's own network, with its own nftables, so nothing changes on this machine:
  - UDP blocked
  - one STUN server, then two
  - a symmetric NAT
  - an address in 100.64/10
  - a container

  *In containers: one with no network said UDP is blocked, and one on podman's bridge said it's in a container. On this machine: UDP out, two answers, one port. The rest from STUN servers on this machine that answer as each network would, with no nftables: one answer, two with one port, two with two (symmetric), an address in 100.64/10, a router whose address differs, a mapped port, a TURN server in the list, and an empty list. 9 checks pass.*
- [x] The device's own checks, and the 15-second notice, with the right findings and links for each case. *A device whose browser found no path showed the notice at 15.4 s, with what it found and fxbot's findings, and the five ways through in order. Each finding's link lands on its section.*

**M6. Docs**
- [x] Every page above, `npm run build-site`, and `CHANGELOG.md`. *Ten new pages and Reach it. The site builds, with every link resolving.*
- [x] Each link from the notice and from Reachability lands on its section. *All 17 of `wire.ts`'s links, checked against the built site.*

**M7. Passkey recovery, opt-in**
- [x] Setting it up after pairing; using it on a wiped device; fxbot checking the origin, the rpId, user verification, the signature, the time, and the nonce; and every device told. *With Chromium's virtual authenticator: added from a paired device's Devices screen, then a new browser with only the passkey paired, listed as by passkey, and opened fxbot. A connected device showed that a device paired with a passkey. Whether a passkey works in an iOS Home Screen app wasn't checked.*

**Human checks**
- [ ] An iPhone (Home Screen app) and an Android phone, each paired at home:
  - a week away, on cellular and on a work network
  - fxbot restarted and updated meanwhile
  - with no re-pairing
- [ ] A phone that's lost its data, paired again from a laptop while away.
- [ ] A Cloudflare deploy: every paired fxbot back within a minute.
- [ ] A network that blocks UDP: the notice, then each guide followed end to end:
  - the TURN guide, on a VPS over TLS on 443
  - Cloudflare TURN on its own account
  - the WireGuard guide
  - the Tailscale guide
- [ ] Reachability on a real home network with UPnP, on one behind carrier-grade NAT, and in the release's containers.

## 5. Open questions

Decided by the owner on 2026-11-09 (see What the owner asked):
- STUN only by default, Cloudflare's, in a list the owner orders and edits.
- TURN is the owner's own.
- All of the peer-to-peer code is in a plugin, in Essentials.
- A second relay waits for adoption.

Still open:
1. **Frame names: `<frame>.fxbot.sh` or `<frame>.web.fxbot.sh`?** The default is `<frame>.fxbot.sh`, which Cloudflare's free certificate covers. The second reads better but needs Advanced Certificate Manager, about $10 a month. *Built as the default: 16 base32 characters the shell picks, and the Worker answers only names of that shape.*
2. **A short code with CPace, or a long one without a PAKE?** The default is `47-3816-0925` with CPace, 28 lines checked against the draft's vectors. A code of about 20 base32 characters, around 100 bits, needs no PAKE and no `@noble/curves`, but it's longer to type. *Built as the default.*
3. **The passkey (M7): build it, opt-in?** The default is yes: it's the one way back with no other device and nobody at home, and it can't be phished. Whether it works in an iOS Home Screen app is untested. *Built, opt-in, and checked with Chromium's virtual authenticator. iOS is still untested.*
4. **Cloudflare's free plan, or paid ($5 a month)?** The default is paid from launch. On the free plan, going over the cap stops every pairing worldwide until midnight UTC. Essentials adds no load until a device is paired. *The owner's, at deploy.*
5. **May a paired device pair others?** The default is yes, since that's what keeps a pairing from waiting for home. The alternative is that only fxbot's own screen approves. *Built as the default.*
6. **If werift fails a browser in M1, fix it or fork it?** The default is a fix upstream, with a fork bundled meanwhile. It's plain TypeScript with one maintainer, so either is in reach. node-datachannel connects in a third of the time at 2–3× the speed, but it's native, so core would have to carry it, which the owner ruled out. *Neither was needed: with fxbot making the offer, Firefox connects (see **Built**).*

## After the build

On 2026-11-10, for 0.9.0, the owner took web pairing out of **Essentials**: "web-pairing does not belong in essentials." It's added from **Plugins**, and an install that has it keeps it. The guides and the README say so.
