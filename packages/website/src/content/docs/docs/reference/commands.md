---
title: "Commands"
description: "The commands for an install: setup.sh, the machine's fxbot command, and a checkout's npm scripts."
---

## setup.sh

```sh
curl -fsSL https://fxbot.sh/setup.sh | sudo bash
curl -fsSL https://fxbot.sh/setup.sh | sudo bash -s -- <tag>
curl -fsSL https://fxbot.sh/setup.sh | sudo FXBOT_PORT=8780 bash
```

Installs fxbot as containers, as root, through whichever of apt, dnf, zypper, or pacman the machine has. It reads the versions the machine has, and sets up what's missing.

**It checks first,** and stops before it changes anything, with what to do, when:
- the system isn't Linux, such as macOS or Windows
- the machine has none of the four package managers, or installs software as a whole image (Fedora Silverblue or CoreOS, openSUSE MicroOS)
- it runs without systemd
- its CPU isn't x86_64 or arm64
- another program listens on the port
- `docker` is a snap
- `/var/lib` has under 3 GB free, for a new install
- pacman has no package lists

With under 1 GB of memory free, it says so and carries on. [Fix an install that stopped](/docs/how-to/fix-an-install/) has each stop and its fix.

**The engine,** for a new install, is the first of:
1. `FXBOT_ENGINE`, when set
2. a Docker that's running
3. podman 4 or newer, when it's installed
4. a Docker that's installed, which it starts
5. podman from the distribution, when it has 4.9 or newer, so the computer can run on it too
6. Docker's own `docker-ce`, from Docker's repository, with its signing key checked against its SHA-256, on Debian, Ubuntu, and the distros built on them

An install keeps the engine it has. `setup.sh` never installs Ubuntu's `docker.io`, which can't also run the computer. A `docker` from `podman-docker` counts as podman. When the engine is docker and no Docker is installed, it installs `docker-ce` on apt.

**Compose:** 2.26 or newer. When the machine's is older, or is v1, or `podman compose` would run one of those, it installs the distribution's package if that's new enough, and otherwise downloads Compose's own release into `/opt/fxbot` and checks it against its hash. podman-compose isn't used: it can't wait for health.

**The images** download before fxbot starts, showing Compose's own progress.

What it creates is in [What setup.sh creates](/docs/reference/install-layout/).

| Input | What it is |
| --- | --- |
| `<tag>` | The release to install, such as `v0.3.0`. Default: the newest stable release. A prerelease installs only by name. |
| `FXBOT_ENGINE` | `podman` or `docker`, for a new install. |
| `FXBOT_PORT` | The port fxbot listens on, on the machine's loopback, for a new install. Default 8787. It's kept in `/opt/fxbot/.env`. |
| `FXBOT_FILES` | Where each release's `deploy/` files are downloaded from, by tag. Default `https://raw.githubusercontent.com/iammrduncan/fxbot` |
| `FXBOT_IMAGE` | The app's image, without its tag. Default `ghcr.io/iammrduncan/fxbot` |
| `FXBOT_RELEASES_URL` | Where the newest release is read, in the shape of GitHub's `releases/latest`. Default `https://api.github.com/repos/iammrduncan/fxbot/releases/latest` |
| `FXBOT_COMPOSE_FILES` | Where Compose's own release is downloaded from, when the machine needs it. Default `https://github.com/docker/compose/releases/download` |
| `FXBOT_DOCKER_FILES` | Where Docker's repository is, when it installs `docker-ce`. Default `https://download.docker.com` |

`FXBOT_FILES`, `FXBOT_IMAGE`, and `FXBOT_RELEASES_URL` point an install at a fork or a mirror. When set, they are kept in `/opt/fxbot/.env`, for updates.

- Run again, it finishes an install that stopped, and leaves a working one alone, on the release it has. An install that stopped before its first start has nothing to keep, so it starts over from the newest release, with its old settings left as `/opt/fxbot/.env.stopped`.
- With `/opt/fxbot` gone but the database's volume still there, it starts on that database, with the key left in `/etc/fxbot`.
- On an install of 0.2, it moves it into containers: see [Update from 0.2](/docs/how-to/update/#from-02).
- Each package it installs, and Docker's repository's files when it adds them, go in `/etc/fxbot/packages`, which `fxbot uninstall` names.
- apt can remove a package to install another. When it would, `setup.sh` stops instead.

### Where it runs

Each checked with a fresh install, its lifecycle, and the computer:

| Distro | Packages | fxbot runs on | The computer runs on |
| --- | --- | --- | --- |
| Debian 13 | apt | podman 5.4 | rootless podman |
| Debian 12 | apt | Docker's own `docker-ce` | rootless `docker-ce` |
| Ubuntu 24.04 | apt | podman 4.9, or the Docker that's there | rootless podman |
| Ubuntu 22.04 | apt | Docker's own `docker-ce` | rootless `docker-ce` |
| Fedora 45 | dnf | podman 6.1 | rootless podman |
| AlmaLinux 9 and 10 | dnf | podman 5.8 | rootless podman |
| openSUSE Tumbleweed and Leap 16 | zypper | podman 6.1 and 5.4 | rootless podman |
| Arch | pacman | podman 6.1 | rootless podman |

The distros built on them install the same way, through the same package manager.

## fxbot

The command for an install made by `setup.sh`: `/opt/fxbot/fxbot`, linked as `/usr/local/bin/fxbot`. Run it as root. It runs `podman compose` or `docker compose`, as `FXBOT_ENGINE` in `/opt/fxbot/.env` says, in `/opt/fxbot`, or the binary `FXBOT_COMPOSE` names there, when `setup.sh` found those too old.

| Command | What it does |
| --- | --- |
| `sudo fxbot status` | The version, the engine, the local embedder, whether fxbot answers, and the containers. After a move from 0.2, it also prints the commands that remove what 0.2 left. |
| `sudo fxbot logs [<service>]` | The containers' last 100 lines, followed in a terminal. Piped, as an agent runs it, it prints them and ends. `<service>` is `fxbot`, `db`, or `embed`. |
| `sudo fxbot compose <args>` | Compose itself, on this install's files, with its engine and profile, such as `sudo fxbot compose ps`. |
| `sudo fxbot update [<version>]` | Moves to the newest stable release, or the one named. See below. |
| `sudo fxbot up` | Starts the containers, and waits up to 5 minutes until the app is healthy. The embedder may still be downloading its model. `fxbot.service` runs it at boot. |
| `sudo fxbot down` | Stops and removes the containers. The database's volume stays. |
| `sudo fxbot apply` | Carries out the app's requests in `/var/lib/fxbot/control/requests`. `fxbot-control.service` runs it. |
| `sudo fxbot backup [<folder>]` | Backs up the database and the data folder. See below. |
| `sudo fxbot restore <folder>` | Puts a backup in place of the database, and unpacks its data folder. See below. |
| `sudo fxbot rotate-key` | Seals every stored secret again under a new key. See below. |
| `sudo fxbot embedder cpu\|gpu\|off` | Runs memory search's local embedder on the CPU, on a GPU, or not at all. See below. |
| `sudo fxbot computer on\|off` | Sets up the computer plugin's engine, or takes it away. See below. |
| `sudo fxbot herdr on\|off` | Opens the herdr plugin's door to herdr, or closes it. See below. |
| `sudo fxbot uninstall [--purge] [--yes]` | Takes fxbot off the machine. See below. |

### fxbot update

Moves to the newest stable release, or the one named, such as `0.3.1` or `0.4.0-rc.1`. In order, it:

1. downloads the release's `compose.yaml`, its GPU file for the engine, its `fxbot` command, and on Docker its `compose.docker.yaml`, and pulls the images it doesn't have yet
2. writes the new version into `/opt/fxbot/.env`, and puts the new files in place
3. recreates the containers that changed, and waits up to 5 minutes for the app to be healthy. The new app backs up and migrates the database as it starts.

Running chats get 30 seconds to finish, and one still running goes on in the new release. The database keeps running. Each step goes to `/var/lib/fxbot/control/status.json`, which Settings shows. Another update waits for the one running.

It refuses, and changes nothing, when:

- the version isn't one such as `0.3.0`
- the release is the running one, or older (going back is a [restore](/docs/how-to/go-back/))
- a file or an image doesn't download

If the new app isn't healthy in time, it goes back to the old compose file, command, and version, and, when the new release ran migrations, restores the backup taken before them. Settings then shows why, from the new app's last log lines.

Once the new release runs, it removes the images the old release's compose files named and the new one's don't. After a failed update, it keeps them.

### fxbot backup

```sh
sudo fxbot backup ~/fxbot-backup
```

Stops the app, writes the database as `database.dump`, in pg_dump's custom format, and the data folder as `data.tar.gz` into the folder, and starts the app again if it was running. With no folder, it's `/var/lib/fxbot/backups/<date>-by-hand`, where fxbot keeps only the five newest. A folder elsewhere belongs to the user who ran `sudo`. `fxbot restore` takes the folder as it is. Keep `/etc/fxbot/secret.key` apart from it: the backup's keys and tokens open only with that key. See [Back up fxbot](/docs/how-to/back-up/).

### fxbot restore

```sh
sudo fxbot restore /var/lib/fxbot/backups/<date>-before-<migration>
```

Stops the app, starts the database if it isn't running, drops the database, and makes it again from the folder's `database.dump`. When the folder has a `data.tar.gz`, it unpacks it into `/var/lib/fxbot/data`. `sudo fxbot up` then starts the app. A relative folder is taken from where you run the command.

### fxbot rotate-key

Seals every stored key and token again, providers' and MCP servers' alike, under a new key, for when the old one may have leaked. It stops the app, makes a new `/etc/fxbot/secret.key`, seals everything again in one transaction, and starts the app. The old key stays beside it as `/etc/fxbot/secret.key.old`: remove it once fxbot works. If sealing fails, nothing changes, and the old key still works.

### fxbot embedder

```sh
sudo fxbot embedder gpu
```

Runs the local embedder for memory search on the CPU (`cpu`), on an NVIDIA GPU (`gpu`), or not at all (`off`), and writes the choice into `/opt/fxbot/.env` as `FXBOT_EMBEDDER`. For `gpu`, it first makes a trial run, `nvidia-smi` in llama.cpp's CUDA image with the GPU, and changes nothing when no GPU answers. Then it recreates the `embed` container on the new compose files, or, for `off`, removes it. Its state goes to `/var/lib/fxbot/control/embedder-status.json`, which Settings shows. **Memory search**, in Settings › Memory, asks for the same through a request, which `fxbot apply` carries out.

It changes what the machine runs, not where the app takes its vectors from: after `off`, pick **Off** in Settings as well. A new embedder is a new model, so the app gives every memory and message a new vector. See [Choose where memory search's vectors come from](/docs/how-to/memory-search/).

### fxbot computer

```sh
sudo fxbot computer off
```

Sets up the [computer](/docs/reference/computer/) plugin's engine (`on`), or takes it away (`off`). It downloads the computer's setup script from the running release's own files into `/opt/fxbot/computer-setup.sh`, and runs it: `on` makes the `fxbot-computer` user, its rootless engine, and the firewall, and gives fxbot's container the engine's socket; `off` removes them, with every computer and its home. Either starts fxbot again. Its state goes to `/var/lib/fxbot/control/computer-status.json`, which **Settings** › **Computer** shows.

Adding the computer plugin asks for `on` through a request, which `fxbot apply` carries out, so you don't run it yourself. Remove the plugin before `off`, or it asks again when fxbot starts.

### fxbot herdr

```sh
sudo fxbot herdr on
sudo fxbot herdr on --user <login> --read-only
sudo fxbot herdr off
```

Opens the [herdr](/docs/how-to/work-with-herdr-agents/) plugin's door to herdr (`on`), or closes it (`off`). The door is `/var/lib/fxbot/control/herdr.sock`, which fxbot's container already sees: systemd's `fxbot-herdr.socket` listens there, for the `fxbot` group only, and runs `/opt/fxbot/herdr-door` as herdr's user for each connection. The script comes with each release, and `fxbot update` brings the new one. It takes a short list of herdr's commands, checks every word, and refuses the rest: no pane commands, keys, environment, or an agent's own flags. Only root opens the door: the app can't ask for it.

`on` checks that herdr's server runs for that user, asks each saved machine the way the door will, with no SSH agent, and names any it can't reach. `fxbot status` says whether the door is open, and `fxbot uninstall` closes it.

| Option | What it does |
| --- | --- |
| `--user <login>` | herdr's user. Default `root` |
| `--read-only` | Bots list and read agents, and send no work and start none |

### fxbot uninstall

```sh
sudo fxbot uninstall
sudo fxbot uninstall --purge
```

Says what it removes and keeps, then asks once, `[y/N]`. With **y**, it stops `fxbot-control.path`, backs up into `/var/lib/fxbot/backups/<date>-uninstall`, takes the computer away with its saved setup script (no network needed), closes herdr's door, and removes the units, the containers, the volumes, fxbot's images at every version, ufw's rules marked `fxbot`, `/opt/fxbot`, and the `fxbot` command. It keeps the backup, `/etc/fxbot` with the key, and the user `fxbot`, so `setup.sh` and `fxbot restore` bring it back. A failed backup stops it before it removes anything.

| Option | What it does |
| --- | --- |
| `--purge` | Takes no backup, and also removes `/var/lib/fxbot`, `/etc/fxbot`, and the user `fxbot` |
| `--yes` | Asks nothing. With no terminal and no `--yes`, it stops. |

It never removes podman, Docker, their other containers, or the packages `setup.sh` installed: it names those, from `/etc/fxbot/packages`, with the package manager's command to remove them. Run again after one that stopped partway, it finishes. See [Uninstall fxbot](/docs/how-to/uninstall/).

## npm scripts

Run from a checkout's root.

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite on `127.0.0.1:5173`, with the API on 8788, or on `FXBOT_PORT` when the shell sets it. The API restarts when the server or the SDK changes. |
| `npm run server` | The API and the last build of the page, on `FXBOT_HOST` (default `127.0.0.1`) at `FXBOT_PORT` (default 8787) |
| `npm run prod` | `npm run build`, then `npm run server` |
| `npm run build` | Builds the page and its service worker into `packages/ui/dist/` |
| `npm run typecheck` | `tsc --noEmit` in each workspace |
| `npm run build-site` | Builds this site into `out/`, and checks its links |
| `npm run rotate-key -- <new key file>` | Seals every stored secret again under a new key. See below. |

The API that `npm run dev`, `npm run server`, and `npm run prod` start, and `npm run rotate-key`, read `.env` in the repository root when it exists.

### npm run rotate-key

For a checkout; a release install uses [`fxbot rotate-key`](#fxbot-rotate-key). Seals every stored key and token again, providers' and MCP servers' alike, under the key in `<new key file>`: 32 random bytes in base64, such as `openssl rand -base64 32` makes. It reads `FXBOT_DATABASE_URL`, and `FXBOT_SECRET_KEY_FILE` for the old key. Stop the server first, and afterwards point `FXBOT_SECRET_KEY_FILE` at the new file.
