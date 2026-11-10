---
title: "When a device can't connect"
description: "What each message from web pairing means, and what fixes it, in order: from what costs nothing to what takes a server of your own."
---

A paired device connects straight to your fxbot. When its network and your fxbot's can't reach each other, the app says so after 15 seconds: "Your fxbot answered, but no direct path works between this network and it." Below it are what each side found, and what would work. **Settings** › **Web pairing** › **Reachability** shows your fxbot's side in advance, with **Check again**.

This page has a section for each thing they find.

## The messages that aren't about the network

These come before any connection, and aren't fixed by anything below.

- **"Your fxbot isn't connected to the relay."** Your fxbot is off, web pairing is off or removed, or it lost its network. If it was installed again from nothing, it has new keys: pair again.
- **"Your fxbot doesn't know this device any more."** The device was removed. [Pair it again](/docs/how-to/pair-another-device/).
- **"Remote access is off."** Turn it on in **Settings** › **Web pairing**.

## Try another network

The quickest test. A phone that can't connect on cellular often connects on Wi-Fi, and the other way around: work and guest Wi-Fi often block UDP, and some carriers map ports in a way that doesn't meet your home router's. If another network works, the sections below say which side to fix.

## UDP is blocked

"This network blocks UDP" means a STUN server never answered. A direct connection needs UDP on both sides, so nothing in this list connects through it but these:

1. **A TURN server of your own, over TLS on port 443,** which looks like web traffic. See [Run your own TURN server](/docs/how-to/run-your-own-turn/).
2. **Tailscale,** whose relays run over HTTPS. See [Reach it with Tailscale](/docs/how-to/reach-it/#with-tailscale).

When your fxbot's side says it, its own network blocks UDP: check the machine's firewall lets UDP out.

## A symmetric NAT

"Maps ports per destination" means a symmetric NAT: each server it talks to sees a different port, so the port a STUN server reports is no use to anyone else. Many phone carriers do this, and some routers. Two such sides can't connect directly. The fixes, in order:

1. **A mapped or forwarded port at home,** so your fxbot's side has a port that stays put. See [Forward or map a port](/docs/how-to/forward-a-port/).
2. **IPv6,** where both sides have it: ICE usually connects directly between two IPv6 addresses.
3. **A TURN server of your own.** See [Run your own TURN server](/docs/how-to/run-your-own-turn/).
4. **Tailscale** or **WireGuard.**

Your fxbot can tell only with two STUN answers. With one server in its list, it says it can't tell: [add a second](/docs/how-to/run-your-own-stun/#add-a-second-stun-server).

## Carrier-grade NAT

"Behind carrier-grade NAT" means your fxbot's public address is in 100.64.0.0/10, or the router's own public address differs from the one STUN reports: another NAT sits beyond your router, run by your provider. Forwarding a port on your router doesn't help, since the provider's NAT is in front of it. Devices on many networks can't reach it directly. The fixes:

1. **Ask your provider** for a public IPv4 address, or turn on IPv6.
2. **A TURN server of your own.** See [Run your own TURN server](/docs/how-to/run-your-own-turn/).
3. **Tailscale** or **WireGuard,** whose relays or endpoints sit outside.

## No mapped port

"The router didn't map a port" means fxbot asked the router by NAT-PMP and UPnP, and neither answered. Many routers have both off. It matters only with a symmetric NAT on the other side. Turn on UPnP or NAT-PMP on the router, or forward the ports by hand: see [Forward or map a port](/docs/how-to/forward-a-port/). A port forwarded by hand can't be seen from inside, so this message stays after you forward one.

## In a container

fxbot in a container can't map a port, since the router can't be found from inside it. To forward the ports, publish them from the container: see [Forward or map a port](/docs/how-to/forward-a-port/#from-the-release-containers).

## No STUN server answered

"There's no STUN server in the list" means you removed every one. Without one, neither side learns its public address, and devices connect only on your fxbot's own network. Add one back under **ICE servers**: **Add Cloudflare's STUN back**, or [one of your own](/docs/how-to/run-your-own-stun/).
