---
title: "Forward or map a port"
description: "Give your fxbot a UDP port that stays put on your router, so devices behind a symmetric NAT, as on many phone carriers, can reach it directly."
---

Give your fxbot a UDP port that stays put on your router, so devices behind a symmetric NAT, as on many phone carriers, can reach it directly. It doesn't help when your provider has a NAT of its own in front of your router: see [Carrier-grade NAT](/docs/how-to/when-a-device-cant-connect/#carrier-grade-nat).

## The ports

Web pairing uses UDP ports 8790 to 8799 for its connections, one or two each. Change the range under **Settings** › **Web pairing** › **Relay and ports**, from 2 to 100 ports. When every port in it is taken, a connection uses another, and the plugin's log says so: a forwarded port doesn't cover that one.

## Let fxbot map them

With **Map the ports on the router, by NAT-PMP or UPnP** on, which is the default, fxbot asks the router for the range while it listens, renews it, and gives it back when it stops. **Relay and ports** says what it got: by NAT-PMP or UPnP, and at which public address.

This needs NAT-PMP or UPnP on in the router's settings. Many routers call it **UPnP** or **NAT-PMP**, under **Advanced** or **NAT**. Some have it off, since any program on the network can ask. If the router answers neither, the tab says so, and you can forward by hand.

It can't work from inside a container. See [From the release containers](#from-the-release-containers).

## Forward them by hand

In the router's settings, find **Port forwarding** (sometimes **Virtual servers** or **NAT rules**), and add one rule:

| Field | Value |
| --- | --- |
| Protocol | UDP |
| External ports | 8790–8799 |
| Internal address | your fxbot machine's address on the network, such as 192.168.1.20 |
| Internal ports | 8790–8799 |

Give the machine a fixed address on the network first, in the router's DHCP settings, so the rule keeps pointing at it.

## From the release containers

An install made by `setup.sh` runs fxbot in a container, which needs the ports published as well. In `/opt/fxbot/compose.override.yaml`, add:

```yaml
services:
  fxbot:
    ports: [ "8790-8799:8790-8799/udp" ]
```

The file is yours: nothing else writes over it. The computer keeps its own lines in `compose.computer.yaml`. Then run `sudo fxbot up`, which starts the app again with the ports published.

With ufw active, let the range through to the container too, since ufw drops what the machine forwards:

```sh
sudo ufw route allow proto udp to any port 8790:8799
```

Then forward the same ports on the router, by hand: fxbot can't find the router from inside its container.

## Check it

**Settings** › **Web pairing** › **Reachability**, then **Check again**. A port mapped by fxbot shows as mapped. A port forwarded by hand can't be seen from inside, so the best check is a phone on cellular, with Wi-Fi off.
