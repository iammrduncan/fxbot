---
title: "Fix an install that stopped"
description: "When setup.sh can't install fxbot, or the computer's setup can't make its engine, it stops and says why. Find the line it printed, and its fix."
---

When `setup.sh` can't install fxbot, it stops before it changes anything, and prints a line that starts with `fxbot setup stopped:`. The computer's setup, which runs when you add the computer, stops the same way, and **Settings** › **Computer** shows its line. Find that line below, fix what it names, and run the same command again: both pick up where they stopped.

## On the wrong system

**`fxbot runs on Linux, and this is macOS`**, or Windows, or another system. fxbot installs on a Linux machine: a server, a small VPS, a computer at home, or a Linux VM. On Windows, WSL 2's Ubuntu works, with systemd on (below).

**`setup.sh installs through apt, dnf, zypper, or pacman`**. It runs on Debian, Ubuntu, Fedora, RHEL and its rebuilds, openSUSE, Arch, and the distros built on them. This system has none of those package managers.

**`this system installs software as a whole image`**. Fedora Silverblue and CoreOS, and openSUSE MicroOS, change only as whole images, so `setup.sh` can't add the packages fxbot needs. Use a distro that installs packages one at a time.

**`fxbot needs systemd`**. fxbot starts at boot, and updates from **Settings**, through systemd. In WSL, turn it on: add these lines to `/etc/wsl.conf`, run `wsl --shutdown` in Windows, then open Ubuntu again.

```ini
[boot]
systemd=true
```

**`fxbot's images are for x86_64 and arm64`**. A 32-bit Raspberry Pi OS is `armv7l`. On a Raspberry Pi 4 or 5, install the 64-bit Raspberry Pi OS.

## Another program listens on the port

**`another program listens on port 8787`**. fxbot listens on `127.0.0.1:8787`, and something else does already, such as RStudio Server. Install fxbot on another port:

```sh
curl -fsSL https://fxbot.sh/setup.sh | sudo FXBOT_PORT=8780 bash
```

It keeps that port for good, in `/opt/fxbot/.env`. Use it wherever these docs say 8787, such as `sudo tailscale serve --bg 8780`.

## Docker from snap

**`Docker here is a snap, which can't reach fxbot's folders`**. Ubuntu offers Docker as a snap, whose daemon reaches only home folders. Remove it, then run `setup.sh` again, which installs an engine that works:

```sh
sudo snap remove docker
curl -fsSL https://fxbot.sh/setup.sh | sudo bash
```

Or keep the snap for other things, and give fxbot podman: run `setup.sh` with `FXBOT_ENGINE=podman` in place of the second line.

## Not enough room

**`fxbot's images need 3 GB free in /var/lib`**. Free some space where the engine keeps its images, `/var/lib`, then run `setup.sh` again. The computer's image takes 1.2 GB more, later.

## A package that won't install

**`installing … would remove …, so nothing was installed`**. apt would remove a package to install one of fxbot's. `setup.sh` won't do that unasked. Read what apt would do, with the package it named, and decide:

```sh
sudo apt-get install --simulate podman
```

## Old package lists on Arch

**`pacman has no package lists`**, or **`pacman couldn't install …`**. `setup.sh` doesn't update an Arch system itself, since that upgrades everything on it. Update it first, then run `setup.sh` again:

```sh
sudo pacman -Syu
```

## No engine to install

**`this system's packages have no podman 4.9 or newer, and Docker publishes no docker-ce for it`**. Install podman or Docker yourself, and `setup.sh` uses it. On Amazon Linux 2023:

```sh
sudo dnf install docker
sudo systemctl enable --now docker
```

**`Docker's signing key … isn't the one it should be`**. `setup.sh` checks the key of Docker's repository before adding it. A key that doesn't match comes from somewhere else: a proxy, or a mirror. Nothing was installed. Run it again where `download.docker.com` is reached directly.

## The computer

### Ubuntu's own Docker

**`the computer needs podman 4.9 or newer, or a Docker that runs rootless`**, or **`dockerd-rootless.sh isn't installed`**. The computer runs on a second engine, rootless, for a user of its own. On Ubuntu 22.04, podman is too old for it, and Ubuntu's own `docker.io` has no way to run rootless. Docker's own `docker-ce` has one. Swap Ubuntu's Docker for it, keeping fxbot and its database:

```sh
sudo fxbot backup
sudo fxbot down
sudo apt-get remove docker.io docker-compose-v2 containerd runc
curl -fsSL https://fxbot.sh/setup.sh | sudo bash
```

`apt-get remove` keeps `/var/lib/docker`, where fxbot's database is, and takes Ubuntu's Compose too, whose files Docker's own would clash with, and `setup.sh` adds Docker's repository and installs `docker-ce`, as [Docker's own steps](https://docs.docker.com/engine/install/ubuntu/) do, then starts fxbot again. Then press **Try again** in **Settings** › **Computer**.

On Ubuntu 24.04, the computer needs nothing of this: it runs on rootless podman, beside Ubuntu's Docker. On Amazon Linux 2023, which has no podman and whose Docker can't run rootless, the computer can't run.

### An old podman

**`the computer needs podman 4.9 or newer, and this machine has podman 4.3.1`**, as Debian 12 has. fxbot runs on that podman, and the computer needs a newer one, or Docker's own `docker-ce`, which runs rootless. Move fxbot onto `docker-ce`, with its bots and chats:

```sh
sudo fxbot uninstall
curl -fsSL https://fxbot.sh/setup.sh | sudo FXBOT_ENGINE=docker bash
sudo fxbot restore /var/lib/fxbot/backups/<date>-uninstall
sudo fxbot up
```

The uninstall keeps a backup and the key. `setup.sh` installs `docker-ce` from Docker's repository, and the restore brings back what you had. A new install on Debian 12 gets `docker-ce` by itself.

### cgroups v1

**`this machine runs cgroups v1, and the computers' limits need v2`**. Without cgroups v2, each computer's limits on memory, CPU, and processes would do nothing. RHEL 8 and its rebuilds boot v1. Switch the kernel to v2, then restart:

```sh
sudo grubby --update-kernel=ALL --args=systemd.unified_cgroup_hierarchy=1
```

### No user namespaces

**`this machine keeps its users from making user namespaces`**. A rootless engine needs them. Arch's `linux-hardened`, and some hardened setups, turn them off. Turn them on:

```sh
echo 'kernel.unprivileged_userns_clone = 1' | sudo tee /etc/sysctl.d/90-fxbot-userns.conf
sudo sysctl --system
```

On a system that sets `user.max_user_namespaces` to 0, set it to `28633` the same way.

## fxbot doesn't answer after a start

**`fxbot did not answer`**, and `sudo fxbot logs fxbot` shows `getaddrinfo EAI_AGAIN db`. The app can't find its database by name. On podman, the containers ask the network's own DNS server for names, and a firewall that denies incoming connections drops those asks:
- **ufw:** `sudo fxbot up` lets port 53 in on podman's network, marked `fxbot`. Run it again.
- **firewalld:** `sudo fxbot up` turns on `netavark-firewalld-reload.service`, which puts podman's rules back after each `firewall-cmd --reload`. Run it again.
