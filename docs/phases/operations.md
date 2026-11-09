# Operations

Getting fxbot onto a machine, keeping it running, and taking it off again, with as little as possible for the owner to know:
- **The computer runs wherever fxbot runs.** On Ubuntu 24.04's and 22.04's `docker.io`, the computer's setup stops today, because their `docker.io` has no rootless Docker script. The computer's engine becomes rootless podman wherever the distro has 4.9 or newer, beside whichever engine fxbot itself runs on, and rootless Docker where podman is older: Docker's `docker-ce`, Debian's `docker.io`, Fedora's `moby-engine`, or openSUSE's `docker`. `setup.sh` never installs `docker.io` again: where podman is too old, on Debian 12 and Ubuntu 22.04, it installs Docker's own `docker-ce`.
- **Every popular distro installs, Arch included:** Debian, Ubuntu, Fedora, RHEL and its rebuilds, openSUSE, Arch, and the distros built on them, through apt, dnf, zypper, or pacman, whichever the machine has. Arch's support builds on [PR #11](https://github.com/iammrduncan/fxbot/pull/11) and credits its author. SELinux and firewalld, on by default on Fedora, RHEL, and openSUSE, are handled, not turned off.
- **`setup.sh` checks before it changes anything,** and stops with what to do: a port in use, a Docker from snap, a CPU with no image, too little disk. It picks the engine that's already running, takes the engine and the port from the owner when asked, and shows its downloads as they go.
- **One command takes fxbot off the machine:** `sudo fxbot uninstall`, which keeps a backup and the key unless told `--purge`, and says what's left and how to remove it.
- **One command backs it up:** `sudo fxbot backup`, for moving to a new machine, and before an uninstall.
- **A Mac installs with the same one line.** `setup.sh` on macOS asks once, yes by default, then makes a Linux VM with Lima and Debian 13, the distro fxbot and its computer were checked on, installs fxbot in it, starts it at login, gives the Mac an `fxbot` command, and opens the app at `http://127.0.0.1:8787`. No Homebrew and no password.
- **The docs say how:** a page to uninstall, a page for a Mac, and a page with the fix for each way an install stops.

Status: planned on 2026-11-07, for 0.8.0, not built. Researched the same day against the research directive's references, nine other installers' scripts, Debian's and Ubuntu's package indexes, and the docs and source of Lima, OrbStack, and Multipass for a Mac. Widened on 2026-11-09 to Arch, after reviewing [PR #11](#arch-and-pr-11), and to the other popular distros: each put to its own package manager in a throwaway container, with how the directive's references and other installers handle distros and a Mac read from their code, and the Mac's tools read again. Re-reviewed later on 2026-11-09 against `release/0.8.0`, with web pairing built: web pairing from the release's containers, the images an update leaves, SELinux's two other mounts, uninstall's order and its offline computer script, a move to a new machine with paired devices, and the computer's override shared with the owner's ports were added, and the line numbers read again. Then, at the owner's word, the Mac's install became the whole install, from the same one line, on Lima 2.2.1 read from its release and source, with [a handoff](#the-mac-handoff) for a session on the owner's Mac to check it. Where this plan says *likely*, the checklist checks it before the build relies on it. The owner's questions are answered in [fxbot today](#fxbot-today-the-owners-questions).

## What the owner asked

"I want you to look at our install setup... for fxbot..."

1. "What happens if user doesn't have docker or podman?"
2. "What happens if user has docker.io and not docker-ce?"
3. "Why can't one of my users run docker.io in rootless and run fxbot, they have to use docker-ce to do both?"
4. "How can we make install and operation of the application easier and more simple for end users?"
5. "How can we make uninstall of the application more straightforward and documented?"

"I want to make the app as easy as possible for users to install and get going!"

Then: "also what if user is on macos?"

Later on 2026-11-09, on `setup.sh` printing a Mac's steps rather than running them: "yeah lets do that, but default to [Y/n] on use lima .. But I really want a fully baked mac install... tons of mac users in ths persona ... they need one line install and then access their agent. That sets up the application and the get robust going. When we are ready for mac section I can clone repo to my mac and open claude there and have it pick up a handoff from you so it can do automated testing etc..."

On 2026-11-09, after [PR #11](https://github.com/iammrduncan/fxbot/pull/11), "Add support for Arch Linux": "Lets credit them on our arch implementation from their PR. but lets do arch the right way and support it on our install. Also double check our install for mac and other popular linux distro's if needed. make sure install deals with the whole docker.io vs docker-ce rootless stuff." Then: "just do planning updates only."

## 0. Core or plugin

**Core: what fxbot needs to run** ([Core or plugin](../../CONVENTIONS.md#core-or-plugin)). Install, updates, and backups are core, and uninstall goes with them. The work is in `setup.sh`, the machine's `fxbot` command (`deploy/fxbot`), the release's compose file and health check, and the docs. The app's code and the plugin API don't change.

One part is the computer plugin's own: its `host/setup.sh` picks the computer's engine. That is a fix to a built feature, which falls short on Ubuntu's `docker.io`. It can be built at once, as a bug fix, and recorded in [the computer](../_completed/phases/computer.md)'s **What the build changed**. It is here because it answers questions 2 and 3. `fxbot uninstall` takes the computer's engine away with `fxbot computer off`, which the `fxbot` command has run since [the computer on Add](../_completed/phases/computer-on-add.md), so the core names no plugin it didn't before.

## 1. Research

### fxbot today: the owner's questions

**1. No docker or podman.** `setup.sh` installs an engine from apt (`setup.sh:41-55`): podman when apt has 4 or newer, and `docker.io` otherwise. Then it finds a Compose 2.26 or newer, from apt or from Compose's own release (`setup.sh:73-125`).

| Machine | fxbot's engine | Compose | The computer |
| --- | --- | --- | --- |
| Debian 13 | podman 5.4.2 | apt's `docker-compose` 2.26.1 | Works: checked on this machine |
| Ubuntu 26.04 | podman 5.7.0 | apt's `docker-compose-v2` 2.40.3 | *Likely* works, on pasta, as on Debian 13: unchecked |
| Ubuntu 24.04 | podman 4.9.3 | apt's `docker-compose-v2` 2.40.3 | *Likely* fails when a computer starts: no `slirp4netns` (below) |
| Debian 12 | podman 4.3.1, on CNI with `dnsname` | Compose 2.40.3, downloaded: apt's `docker-compose` is v1 (1.29.2) | Stops: "podman 4.3 is too old: the computer needs 4.9 or newer" |
| Ubuntu 22.04 | `docker.io` 29.1.3: apt's podman is 3.4.4 | apt's `docker-compose-v2` 2.40.3 | Stops: "dockerd-rootless.sh isn't installed" |
| macOS | Stops: see **6. On a Mac**, below | | |
| No apt (Fedora, RHEL and its rebuilds, openSUSE, Arch) | Stops: "Elsewhere, follow the README's steps." The README has no such steps. [PR #11](#arch-and-pr-11) adds pacman. | | |
| No systemd | Installs, then says "start it yourself: sudo fxbot up". Nothing starts it at boot, Settings can't update it, and on podman nothing starts the socket that Compose reaches podman through. | | |

`setup.sh` and the computer's script both install with `--no-install-recommends`. podman 4.9's rootless network is slirp4netns: pasta became the default only in podman 5.0.0 ([release notes](https://github.com/containers/podman/blob/main/RELEASE_NOTES.md)). The computer installs `passt` and not `slirp4netns` (`plugins/computer/host/setup.sh:81`). So on a fresh Ubuntu 24.04, where podman came in without its recommends, a computer's first start *likely* fails for want of `slirp4netns`. The computer was checked only on podman 5.4.2.

**2. `docker.io`, not `docker-ce`.** fxbot itself runs: `setup.sh` treats any `docker` alike, and Compose comes from apt or Compose's release. The computer depends on whose `docker.io` it is (`plugins/computer/host/setup.sh:82-102`):
- **Debian's** ships `dockerd-rootless.sh` and `dockerd-rootless-setuptool.sh` in `/usr/share/docker.io/contrib/` (12 and 13), beside a `rootlesskit` package. The computer was checked on Debian 13's `docker.io` 26.1.5.
- **Ubuntu 24.04's and 22.04's** ship neither (`contrib/` holds only `check-config.sh` and `nuke-graph-directory.sh`), and no package in Ubuntu 24.04 has a file named `dockerd-rootless.sh` (packages.ubuntu.com's contents search, 2026-11-07). Ubuntu 26.04's `docker.io` (29.1.3-0ubuntu4.1) ships both, beside `rootlesskit` 2.0.2, so there the computer's Docker path *likely* works, unchecked. The script installs `rootlesskit` and `slirp4netns`, then stops at line 102: "dockerd-rootless.sh isn't installed". The docs say Ubuntu's `docker.io` works (`reference/computer.md:127`, the computer's `README.md:50`, `computer.md:222`). It was only ever run on Debian's.

So on Ubuntu 24.04 or 22.04 with `docker.io`, the computer in **Essentials** fails on the first screen of a new install, and **Try again** fails the same way.

**3. Why only `docker-ce` does both.** fxbot runs two engines. Its own three containers run on the machine's engine as root, started by systemd, with the `fxbot` user's ids inside. The computer needs a second engine, rootless, for a user of its own, `fxbot-computer`, so a bot that breaks out of its computer lands in a user who can read nothing of fxbot's. Docker runs rootless only through `dockerd-rootless.sh` and RootlessKit. Docker's own packages carry both, in `docker-ce-rootless-extras`. Debian's `docker.io` carries the script, and Ubuntu 24.04's and 22.04's leave it out (26.04's has it again). So on Ubuntu 24.04 and 22.04, `docker-ce` is the only Docker that can be both engines. Podman can be both on every distro the computer supports, since rootless is how podman runs by default.

If the owner's user meant fxbot itself on a rootless Docker, with no root engine at all: `setup.sh` doesn't do that. It runs as root and uses the root engine, and on a machine whose Docker is rootless only, `systemctl enable --now docker` (`setup.sh:66`) quietly starts the root daemon that the owner had turned off. A rootless fxbot is [not in this phase](#not-in-this-phase).

**4. What else gets in the way.** Read from the scripts:
- **Docker from snap.** Ubuntu's hint for a missing `docker` offers the snap beside `docker.io`. The snap's daemon reaches files only under home folders and removable media ([its README](https://github.com/canonical/docker-snap)), and its unit is `snap.docker.dockerd.service`. fxbot bind-mounts `/var/lib/fxbot` and `/etc/fxbot/secret.key`, and `fxbot.service` says `Requires=docker.service`. `setup.sh` would take that `docker`, install everything, and then fail to start. The computer's script already refuses a snap. Coolify refuses one too, with `snap remove docker`.
- **Both engines.** podman 4 or newer wins over docker whenever it's installed (`setup.sh:44-47`), even with Docker's daemon running. A running Docker sets the `FORWARD` chain's policy to `DROP`, which can filter podman's bridged traffic ([Red Hat](https://access.redhat.com/solutions/5885821), [podman](https://github.com/podman-container-tools/podman/discussions/29817)). This machine keeps a root Docker off beside its release on podman for that reason.
- **The port.** 8787 is fixed, though compose takes `FXBOT_PORT`. It's RStudio Server's default port too ([Posit](https://docs.posit.co/ide/server-pro/admin/access_and_security/network_port_and_address.html)). The check comes after apt, the engine, Compose, and the downloads (`setup.sh:237`), so a machine with RStudio on it gets all of those and then a stop.
- **The CPU.** fxbot's image is for amd64 and arm64. A 32-bit Raspberry Pi OS gets podman, then a stop that asks for a Compose, which wouldn't help, or, where apt has one new enough, a failed pull.
- **Silence.** The images (about 110 MB, 163 MB, and llama.cpp's) download inside `systemctl start fxbot`, whose output goes to the journal. The terminal shows nothing for minutes, up to the unit's 10-minute timeout.
- **ufw.** An owner's install on Ubuntu 24.04 with ufw active crash-looped on `getaddrinfo EAI_AGAIN db` after an update on 2026-11-07, and `fxbot up` waited out its 5 minutes. Containers on podman ask aardvark-dns, on the bridge's gateway, for names, and ufw's default deny dropped it. `ufw allow in on podman1 to any port 53` fixed it. Docker's DNS answers inside each container, so only podman has this.
- **A database without its `.env`.** An owner who removes `/opt/fxbot` by hand and runs `setup.sh` again gets a new random database password (`setup.sh:169`). The `fxbot_pgdata` volume keeps the old one, since Postgres's image sets the password only on an empty volume, so the app can't sign in and the start fails.
- **A truncated download.** `curl | sudo bash` runs what arrives. A script cut off mid-line runs half. Tailscale wraps its installer in `main()` for this.
- **For agents.** `fxbot logs` follows (`deploy/fxbot:331`), so an agent's call never returns. `agent-setup.txt` works around it with `fxbot compose logs --tail 50`.
- **Old images.** Nothing in `setup.sh` or `deploy/fxbot` removes an image. An update pulls the new release's images and leaves the old ones, and the GPU's trial run (`deploy/fxbot:225-232`) pulls llama.cpp's CUDA image, 4.38 GB, and keeps it when the trial fails. Root's podman on this machine holds `pgvector:0.8.7-pg17` (451 MB) beside the `-trixie` tag in use, and the CUDA image.
- **Web pairing in the containers.** Web pairing is in **Essentials** from 0.8.0, and the owner's checks of it ran on a checkout, outside any container. In the release, the app runs on the engine's bridge (`deploy/compose.yaml` has no `network_mode`), so, read from the plugin and werift:
  - werift's host candidates hold only the container's bridge address, not the machine's LAN or tailnet address.
  - Port mapping is off there, by the plugin's own check, and UDP 8790–8799 isn't published.
  - A phone's own host candidates are `.local` names, which browsers use in place of addresses, and mDNS doesn't cross the bridge.

  So a phone *likely* connects only by the server-reflexive path: on the machine's own Wi-Fi only where the router hairpins, and elsewhere by hole punching through the machine's NAT and then the router's. Unchecked: web pairing's checklist leaves "Reachability… in the release's containers" to a human. werift's `iceAdditionalHostAddresses` advertises more host addresses on the same ports, so a published range, and the machine's addresses passed in, would give a phone on the LAN or the tailnet a direct path ([open question 15](#5-open-questions)).
- **The computer's override is the owner's too.** [Forward or map a port](https://fxbot.sh/docs/how-to/forward-a-port/) has the owner add web pairing's UDP range to `/opt/fxbot/compose.override.yaml`, the file the computer's script writes. Setting the computer up again writes over it (`plugins/computer/host/setup.sh:238`), and `fxbot computer off` deletes it (`:63-64`), with the owner's lines in it.

**5. Uninstall today.** There is no command and no page. The owner would have to know [What setup.sh creates](https://fxbot.sh/docs/reference/install-layout/), and remove each part by hand:

| What | Removed by |
| --- | --- |
| The containers, `fxbot_default`, and the volumes `pgdata` and `models` | `fxbot compose down --volumes` |
| The images: fxbot's, pgvector's, and llama.cpp's, about 1 GB unpacked | `podman rmi` or `docker rmi`, by name |
| The computer: its user, engine, computers, homes, image (1.2 GB), firewall, and override | `fxbot computer off` |
| `fxbot.service`, `fxbot-control.path`, and `fxbot-control.service` | `systemctl disable --now`, then `rm` and `daemon-reload` |
| `/usr/local/bin/fxbot`, `/opt/fxbot`, `/etc/fxbot`, and `/var/lib/fxbot` | `rm` |
| The `fxbot` user | `userdel` |
| podman, netavark, aardvark-dns, nftables, Compose, or `docker.io`, whichever `setup.sh` installed | `apt-get purge`, if nothing else uses them. Nothing records which it installed. |
| `tailscale serve --bg 8787`, if the owner ran it | `tailscale serve reset`. Left alone, the address answers 502. |

**6. On a Mac.** `curl -fsSL https://fxbot.sh/setup.sh | sudo bash` runs in macOS's own bash 3.2 and stops at line 29, changing nothing: "this script is for Debian and Ubuntu. Elsewhere, follow the README's steps." Without `sudo`, it first says to run it as root. Neither says what a Mac owner can do. [Your first fxbot](https://fxbot.sh/docs/tutorials/first-fxbot/) and the home page ask for "a Debian or Ubuntu machine", and `agent-setup.txt` says fxbot "doesn't run on macOS or Windows", and has the agent ask which Linux machine to use.

A release install can't run on macOS itself:
- `setup.sh` and the `fxbot` command need apt and systemd: `fxbot.service` starts it at boot, and `fxbot-control.path` carries out Settings' updates.
- Compose bind-mounts `/var/lib/fxbot` and `/etc/fxbot/secret.key`, owned by a system user, `fxbot`, whose ids the app runs as.
- The computer needs a Linux kernel: a rootless engine for a user of its own, with cpu, memory, and pids delegated by systemd, and an nftables firewall that matches that user's uid.

Docker Desktop, OrbStack's Docker, and Podman Desktop run their containers in a Linux VM of their own already, but none is a Linux machine where `setup.sh` runs: podman's machine is Fedora CoreOS, with no apt, and Docker Desktop's VM has no shell for the owner. A checkout may run on the Mac itself, since libfx publishes `darwin-arm64` and `darwin-x64` builds (`package-lock.json`), with the database from `deploy/compose.dev.yaml` in any of those engines: unchecked, and for contributors, not owners.

So a Mac runs fxbot in a Linux VM. fxbot's images are for arm64 and amd64, so a VM on Apple silicon or on an Intel Mac runs them natively. Its catch is the Mac's own sleep: while the Mac sleeps, so does fxbot, so a routine waits, and a phone can't reach it. A Mac that stays on, such as a Mac mini, is a fine home for it.

### The directive's references

All twelve are public. Read from their READMEs, docs, and install scripts on 2026-11-07:
- **CopilotKit OpenBot**, the closest to fxbot, runs from source with Docker and Bun (`scripts/start.sh`, which never checks Docker is there), or as one `docker run` of its image. Its desktop app picks an engine: a Docker that answers, then Docker Desktop, then podman, which it installs itself through the package manager, rootful, "because k3d needs a rootful engine". It saves the choice and never switches (`desktop/src-tauri/src/install.rs`). Its updates take a `pg_dump` first and never run `down --volumes`. "Uninstalling the app alone is not a reset": it keeps `~/OpenBot` and the containers on purpose, and a separate reset script removes the containers, volumes, and podman machine, keeping the engine and, unless `--images`, the images (`docs/installer-runbook.md`).
- **OpenDuet** is built on OpenBot, with `start.sh` and `stop.sh`, and its volumes stay. **OpenDots** is `npm ci` or `docker compose up`, and `down` keeps its volume. **openmuse** is pnpm and a Render blueprint, and without Docker its computer "reports the connection error". None of the three documents an update or an uninstall.
- **Pi** installs with `curl -fsSL pi.dev/install.sh | sh` into `~/.pi/agent/install`. With no Node 22.19, it asks `[Y/n]`, then installs one with brew, apt through sudo, apk, or a tarball, and with no terminal it stops and says what to install. Running the installer again offers **u** to uninstall, and with no terminal it never uninstalls. Its docs say what stays: "None of these methods removes configuration, credentials, sessions, or installed Pi packages."
- **fx** installs one binary into `~/.local/bin` with `curl -fsSL fx.sh/setup.sh | bash`, needing only curl or wget. It updates itself, and `fx doctor --json` checks its config, credentials, and sessions, and prints the commands that fix them. No uninstall is documented.
- **agent-browser**: `agent-browser install --with-deps` runs apt, dnf, or yum through sudo, and on apt it simulates the install first and stops if any package would be removed (`cli/src/install.rs`). Its `doctor` takes `--fix` for repairs that change things, and `--json`. No uninstall command.
- **agent-desktop** installs nothing it needs: `status` reports what's missing, such as the accessibility bus. Uninstall is "through its original package manager".
- **eve** is a framework, run under the owner's process manager. Only its sandbox needs Docker: with no daemon, the first sandbox session fails with what to start, and `EVE_DOCKER_PATH` points it at podman. An upgrade strands the sessions that were running. No uninstall is documented.
- **Grok Bot** is hosted, with desktop apps; its `.deb` updates through apt. Uninstalling the app "leaves the account in place".
- **fx0** deploys to Vercel with Neon and Upstash, and **durable-harness** is an npm library whose Postgres `bootstrap` is "safe to run again". Neither has an installer or an uninstall.

None covers `docker.io` against `docker-ce`, or rootless Docker.

### Other installers

Read from their scripts on 2026-11-07, line numbers as of that day:
- **k3s** checks for systemd or OpenRC and a known CPU, then writes `/usr/local/bin/k3s-uninstall.sh` at install (`install.sh:900-1016`). It asks nothing, and removes the units, the data folder, the binaries, and only the SELinux package it added.
- **Ollama** checks the CPU, WSL 1, sudo, and missing tools, and warns and carries on without systemd. Its downloads show `curl --progress-bar`. Uninstall is a list of `rm` and `userdel` in its Linux docs, which leaves out the CUDA drivers it may have installed.
- **Coolify** checks root, an OS list, and disk, which only warns. It refuses Docker from snap with "snap remove docker" (`install.sh:694-703`), and Docker older than 24. With no engine, it runs get.docker.com. Its terminal shows a list of steps, everything else goes to a log, and a failure prints the log's last 15 lines and its path. Uninstall is a page of `docker rm`, `rmi`, and `volume rm`, which warns against `docker volume prune`.
- **get.docker.com** warns and waits 20 seconds when `docker` exists. It doesn't notice `docker.io`, and `docker-ce` replaces it through apt. It installs `docker-ce-rootless-extras`, and has `--dry-run`. Its uninstall is `apt purge`, with images and volumes left until removed by hand.
- **Tailscale** wraps the whole script in `main()`, so a cut-off download runs nothing. It asks its server whether the distro and version are supported, and an unsupported one gets the details to paste into a support request.
- **Netdata** installs its uninstaller at `/usr/libexec/netdata/netdata-uninstaller.sh`, and `kickstart.sh --uninstall` downloads it if it's gone. It refuses without `--yes`, then asks about each folder and user unless `--force`. It has `--dry-run` and `--reinstall-clean`.
- **Pi-hole**: `pihole uninstall` asks once, "Are you sure… [y/N]", and removes its folders, units, user, and the meta-package that holds its dependencies, then says to autoremove those and to reset the router's DNS.
- **CasaOS** checks the CPU, the distro, 400 MB of memory, and 5 GB of disk, and picks the first free port from 80. It writes `/usr/bin/casaos-uninstall` at install, which asks about containers, images, and app data. Its "all containers" is every container on the machine, not only its own.
- **Immich** needs Docker first, and shows Compose's own pull progress. Removing it is `docker compose down -v` and deleting its two folders, from its FAQ.
- **Umbrel** no longer installs on Debian or Ubuntu: umbrelOS is the operating system.

None of them detects podman, or sets up rootless Docker for a user of its own.

### How they handle other distros, and a Mac

Read from their scripts and code on 2026-11-09, at the commits named, with line numbers as of that day:
- **OpenBot's desktop app** (`desktop/src-tauri/src/install.rs` @64ccb61) installs podman from the distro, "not a binary but a set of them (conmon, crun, netavark, slirp4netns)" (:38-41). It finds the package manager by its binary, `apt-get`, `dnf`, `zypper`, then `pacman`, and runs it through `pkexec`: `pacman -S --noconfirm` for Arch (:648-653). With none, "Install the `podman` package, then start OpenBot again." On a Mac it installs podman's own `.pkg`, pinned by SHA-256, and makes a rootful `podman machine` (`acquire.rs:282-340`). An Intel Mac gets "OpenBot cannot install the container engine on an Intel Mac. Install Podman Desktop or Docker Desktop" (:84-90).
- **agent-browser** (`cli/src/install.rs` @d081bcd) finds `apt-get`, `dnf`, or `yum` by binary (:723-756), simulates only apt's install and aborts on any `Remv ` line (:765-835), and says in a comment that dnf and yum "do not remove packages during install" (:859-862). No pacman or zypper.
- **Pi** (`pi.dev/install.sh`) and **fx** (`fx.sh/setup.sh`) read only `uname`. Pi uses brew, apt, or apk when their Node is new enough, and otherwise a Node tarball checked against its checksum, so Arch, Fedora, and openSUSE get the tarball. fx installs one archive for Linux or macOS.
- **eve** runs its sandbox in Docker and says nothing of distros. **agent-desktop** on Linux asks for Ubuntu 24.04 or newer.
- **Tailscale** (`scripts/installer.sh` @9ceb71a) branches on os-release's `ID`, never `ID_LIKE`, with derivatives named one by one: eight Arch ones on one line (:279-282), Rocky and Alma with Fedora's (:249-252). Arch gets `pacman -S tailscale --noconfirm` (:663). A Mac gets the App Store. An unknown Linux gets "Couldn't determine what kind of Linux is running. You could try the static binaries", and an unsupported one its details, to paste into a support request (:476-505).
- **Coolify** (`scripts/install.sh` @bcd165a) maps Manjaro and EndeavourOS to Arch, and Mint, Pop!_OS, and Zorin to Ubuntu, by hand (:485-517). On Arch it runs `pacman -Sy --noconfirm --needed` for its tools (:578), a partial upgrade, and `pacman -Syu --noconfirm --needed docker docker-compose` for Docker (:773). Its Docker comes from each distro's own route: Docker's RHEL repository on Rocky (:748-752), Amazon Linux's `docker` and Compose's binary (:783-786), and get.docker.com on Fedora.
- **get.docker.com** (@6937af6) installs on apt and dnf distros only, finds forks such as Mint through `lsb_release -u` (:391-430), and stops Arch, openSUSE, and Amazon Linux with "Unsupported distribution". A Mac gets "Please get Docker Desktop". Its `rootless-install.sh` refuses root and prints, rather than runs, each fix it needs: `uidmap` or `shadow-utils`, and subordinate ids (:145-243).
- **Netdata's kickstart** (@0a41daa) maps derivatives by `ID` (:1124-1127), installs its own packages where it has them, and on Arch says "We do not provide native packages" and falls back to a static build (:2346, :3144-3146).
- **k3s** (@2b723db) is the only one that handles SELinux: it installs its policy package, which pulls in `container-selinux`, labels its binary with `chcon`, and stops when SELinux is enforcing and that fails, naming the package to install (:585-727). It never says to turn SELinux off.
- **None of them opens a port** in firewalld or ufw, or trusts an interface.

So: finding the package manager by its binary (OpenBot, agent-browser) needs no list of derivatives, where reading `ID` (Tailscale, Coolify, Docker, Netdata) needs one, kept by hand. For pacman, no two agree, and none says why. For SELinux, k3s labels and never disables. And for a Mac, each points somewhere else (Docker Desktop, the App Store) or brings a VM (OpenBot's podman machine).

### Packages

Read from packages.debian.org and packages.ubuntu.com on 2026-11-07:

| Distro | podman | `docker.io` | Its rootless script | `rootlesskit` | Compose v2 |
| --- | --- | --- | --- | --- | --- |
| Debian 13 | 5.4.2 | 26.1.5 | yes, in `contrib/` | 2.0.2 | `docker-compose` 2.26.1 |
| Debian 12 | 4.3.1 | 20.10.24 | yes, in `contrib/` | 1.1.0 | none: `docker-compose` is 1.29.2 |
| Ubuntu 26.04 | 5.7.0 | 29.1.3 | yes, in `contrib/` | 2.0.2 | `docker-compose-v2` 2.40.3 |
| Ubuntu 24.04 | 4.9.3 | 29.1.3 | **no** | 1.1.1 | `docker-compose-v2` 2.40.3 |
| Ubuntu 22.04 | 3.4.4 | 29.1.3 | **no** | 0.14.6 | `docker-compose-v2` 2.40.3 |

- **podman beside Docker.** podman needs `conmon`, `crun` or `runc`, and `containers-common` on Debian 13 and Ubuntu 24.04, none of which is a Docker package. Rootless podman's network is a process run as its user, slirp4netns or pasta, so Docker's `FORWARD` rules never see it, and the computer's firewall by uid covers it as it does today.
- **Ubuntu 24.04's AppArmor** has profiles for `podman`, `slirp4netns`, `crun`, `runc`, and `rootlesskit` in its `apparmor` package. The computer's check for a profile (`plugins/computer/host/setup.sh:106`) finds `podman`'s.
- **Docker's own docs** say rootless needs `docker-ce-rootless-extras` when `dockerd-rootless-setuptool.sh` is missing, and that on Ubuntu 24.04 the `apparmor` package already covers that package's `rootlesskit` ([rootless](https://docs.docker.com/engine/security/rootless/), [troubleshooting](https://docs.docker.com/engine/security/rootless/troubleshoot/)).
- **Rootless Docker's daemon** held 183 MB at rest on this machine, all the time ([the computer](../_completed/phases/computer.md#docker-rootless)). Rootless podman starts on a call and stops 5 seconds after.

### Arch, and PR #11

[PR #11](https://github.com/iammrduncan/fxbot/pull/11), opened on 2026-11-08 by Olen Thompson against 0.6.0's `main`, is the first try at another distro. It picks `apt-get` or `pacman` by which one exists, runs each install through the one it found, installs podman on Arch, and adds "or on Arch" to eight lines of the docs. Read on 2026-11-09, and its package names put to pacman in a throwaway Arch container:
- **Its way in is right:** choose by the package manager, and keep one engine and one script. On Arch, podman (6.1.4) is new enough for fxbot and for the computer, and pulls in `passt` itself. `/etc/subuid` and `/etc/subgid` ship in Arch's `filesystem` package, so the computer's subordinate ids work as they are.
- **The computer stops on every Arch machine.** It asks for `uidmap`, which Arch doesn't have: `newuidmap` comes with `shadow`, which every Arch system has. pacman answers "error: target not found: uidmap", and the script, under `set -euo pipefail`, stops.
- **Arch's Docker can't be the computer's.** On a machine with Docker, `setup.sh` keeps it, and the computer's script then stops, since Arch's package is `docker`, neither `docker-ce` nor `docker.io`.
- **pacman's flags.** `pacman -S --noconfirm` without `--needed` reinstalls what's there on every run. Without a fresh package list, pacman can ask its mirrors for versions they've dropped.
- **Compose.** On Arch it asks `apt-cache` three times ("command not found"), then downloads Compose 2.40.3, though Arch packages `docker-compose` 5.7.0.
- **Not needed:** the `nologin` and `nft` paths it sets for Arch, since Arch links `/usr/sbin` to `/usr/bin` and the old paths work.
- **The docs** would say "Arch and its kin" untested, list `uidmap` among Arch's packages, and say the commands reference's apt steps happen "the same through pacman", which they don't.

So Arch comes into this phase, built on its plan below, and its commit credits the PR with a `Co-authored-by` line for Olen Thompson, as the owner asked.

### Other distros

Put to each distro's own package manager in a throwaway container on 2026-11-09, except Debian's and Ubuntu's, read from their archives (madison, Launchpad, and Ubuntu's `Contents` index), and Docker's, read from `download.docker.com`. Releases past their end of life are left out: Leap 15.6 ended on 2026-04-30 ([endoflife.date](https://endoflife.date/opensuse)).

| Distro, and those built on it | Packages | podman | `passt` | Its own Docker | That Docker rootless | Docker's `docker-ce` and its rootless extras | Compose 2.26 or newer |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Debian 13; Raspberry Pi OS 13 | apt | 5.4.2 | yes | `docker.io` 26.1.5 | its script in `contrib/`, `rootlesskit` 2.0.2 | yes | `docker-compose` 2.26.1 |
| Debian 12; Raspberry Pi OS 12 | apt | 4.3.1, none newer in backports | yes | `docker.io` 20.10.24 | its script in `contrib/`, `rootlesskit` 1.1.0 | yes | none: `docker-compose` is 1.29.2 |
| Ubuntu 26.04 | apt | 5.7.0 | yes | `docker.io` 29.1.3 | its script in `contrib/`, `rootlesskit` 2.0.2 | yes | `docker-compose-v2` 2.40.3 |
| Ubuntu 24.04; Mint 22, Pop!_OS 24.04 | apt | 4.9.3 | yes | `docker.io` 29.1.3 | **no script** | yes | `docker-compose-v2` 2.40.3 |
| Ubuntu 22.04; Mint 21, Pop!_OS 22.04 | apt | 3.4.4 | no | `docker.io` 29.1.3 | **no script** | yes | `docker-compose-v2` 2.40.3 |
| Fedora 45 | dnf | 6.1.3 | yes | `moby-engine` 29.9.2 | `moby-engine-rootless-extras` | yes | `docker-compose` 5.6.0 |
| RHEL 10; Alma 10.2, Rocky 10 | dnf | 5.8.2 | yes | none: `docker` is podman's `podman-docker` | | yes | none |
| RHEL 9; Alma 9.8, Rocky 9 | dnf | 5.8.2 | yes | none, likewise | | yes | none |
| Amazon Linux 2023 | dnf | **none** | yes | `docker` 25.0.18 | **no script** | no | none |
| openSUSE Tumbleweed | zypper | 6.1.4 | yes | `docker` 29.7.2 | `docker-rootless-extras` | no | `docker-compose` 5.7.0 |
| openSUSE Leap 16.0 | zypper | 5.4.2 | yes | `docker` 29.7.2 | `docker-rootless-extras` | no | `docker-compose` 2.33.1 |
| Arch; Manjaro, EndeavourOS, CachyOS | pacman | 6.1.4 | yes, as podman's dependency | `docker` 29.9.3 | **no script** (`rootlesskit` 3.3.0 alone) | no | `docker-compose` 5.7.0 |

Docker's own repository has `docker-ce` 29.9.3 and `docker-ce-rootless-extras` for Debian 12 and 13, Ubuntu 22.04, 24.04, and 26.04 (amd64 and arm64), Fedora 43 to 45, and RHEL and CentOS 9 and 10, under one signing key (fingerprint `9DC8 5822 9FC7 DD38 854A E2D8 8D81 803C 0EBF CD88`; the file's SHA-256 is `1500c1f56fa9e26b9b8f42452a553675796ade0807cdce11975eb98170b3a570` for Debian and Ubuntu alike). It has nothing for Raspbian 13, openSUSE, Arch, or Amazon Linux.

What the rest have in common, and where they differ:
- **The names are the same** for `podman`, `netavark`, `aardvark-dns`, `passt`, `slirp4netns`, `nftables`, `curl`, and `ca-certificates`, on all four package managers. Only apt splits `newuidmap` into `uidmap`, and has `dbus-user-session`. dnf's `shadow-utils`, zypper's `shadow`, and pacman's `shadow` carry `newuidmap`, and every system has them.
- **`/etc/subuid` and `/etc/subgid` are there** on all of them, in each one's base image.
- **`/usr/sbin/nologin` and `/usr/sbin/nft` work everywhere:** Fedora 45 and Arch link `/usr/sbin` to `/usr/bin`, and the rest keep both in `/usr/sbin`.
- **podman 6** is Fedora 45's, Tumbleweed's, and Arch's. The computer was checked on podman 5.4.2 only.
- **`podman-docker`** puts a `docker` command on Fedora, RHEL, and Ubuntu that runs podman, so `docker info` answers there with no Docker at all. RHEL's `dnf install docker` installs it.
- **Amazon Linux 2023 has no podman,** and its Docker can't run rootless, so the computer has no engine there.
- **SELinux** is enforcing by default on Fedora, RHEL and its rebuilds, and openSUSE (Tumbleweed's new installs since 2025-02, and Leap 16's), and permissive on Amazon Linux 2023. Debian, Ubuntu, and Arch don't run it.
- **firewalld** is on by default on Fedora, RHEL and their rebuilds, and openSUSE. Ubuntu ships ufw, off until the owner turns it on, as the owner's own machine had. Debian and Arch have none.
- **cgroups v2,** which the computer's limits need, is the default on every distro above. RHEL 8 and its rebuilds still boot cgroups v1.

### Linux on a Mac

Read from each tool's docs and source on 2026-11-07:

| Tool | What it is | Reaching fxbot from the Mac | Starts with the Mac | Cost |
| --- | --- | --- | --- | --- |
| [Lima](https://github.com/lima-vm/lima) 2.3.0 | A real VM, on Apple's Virtualization framework on macOS 13.5 and later. `brew install lima`, then `limactl start --name fxbot template:debian-13`, with templates for Debian 12 and 13 and Ubuntu 22.04 to 26.04. By default up to 4 CPUs, up to 4 GiB of memory (half the Mac's, if less), and a 100 GiB disk. | Its built-in last rule forwards every TCP port the guest listens on at 127.0.0.1 to the Mac's 127.0.0.1 (`templates/default.yaml`). podman doesn't listen on fxbot's port (below), so a rule of its own forwards it | `limactl start-at-login fxbot`, through launchd (`cmd/limactl/start-at-login.go`) | Free and open source |
| [OrbStack](https://docs.orbstack.dev/machines/) | Linux "machines" with systemd, on one shared Linux kernel. `orb create debian fxbot`, then `orb -m fxbot`. | "Any servers that you run in Linux machines are accessible from Mac" at `localhost`. A server on `0.0.0.0` or `::` reaches the network too; fxbot listens on 127.0.0.1 | With OrbStack | Free for personal use; $8 a month for work |
| [Multipass](https://documentation.ubuntu.com/multipass/) | Ubuntu VMs from Canonical | No forwarding: SSH, or Tailscale in the VM | No | Free |
| UTM | A VM with a window, set up by hand | By hand | No | Free |

- **Lima's VM is a whole Linux machine,** with its own kernel, systemd, and apt, so `setup.sh` and the computer run in it as on any other. Its user has `sudo` without a password on a Linux guest, by default (`passwordlessSudo`). Its Debian 13 template is the distro fxbot and its computer were checked on, with podman 5.4.2.
- **The computer in a VM:** Lima's address for the Mac, `host.lima.internal`, is 192.168.5.2, inside `192.168.0.0/16`, which the computer's firewall refuses, so a bot's computer *likely* can't reach the Mac. OrbStack's machines share one kernel, which its docs say "isn't a substitute for a full VM against actively malicious code" ([architecture](https://docs.orbstack.dev/architecture)), and a rootless engine nested in one, with its nftables table, is unchecked.
- **Multipass's defaults** are 1 CPU, 1 GB of memory, and a 5 GB disk (`include/multipass/constants.h`), too small for fxbot, its database, and its embedder: it needs `--memory 4G --disk 20G`.
- **Removing it all:** `limactl delete --force fxbot` deletes the VM and everything in it, then `brew uninstall lima`. `orb delete fxbot` does the same on OrbStack.

Read again on 2026-11-09:
- **Lima 2.3.0** (2026-11-06) still has `templates/debian-13.yaml` and `limactl start-at-login`, and runs on Apple's Virtualization framework (`vz`) from macOS 13.5.
- **Lima forwards only a port something listens on** (`pkg/guestagent/guestagent_linux.go:152-160`), and rootful podman, which `setup.sh` picks on Debian 13, doesn't listen on the ports it publishes: it forwards them through the firewall, and calls `listen()` only with `force_port_listen` set, which is off by default (containers.conf's docs). So `http://127.0.0.1:8787` on the Mac *likely* gets nothing on podman, where Docker's `docker-proxy` does listen. A rule with `static: true` forwards a port from the VM's start, over SSH, whether anything listens yet or not (`pkg/hostagent/hostagent.go:729-730, 918-933`).
- **Colima** 0.10.3 is a Lima VM of Ubuntu 24.04 with Docker running, and `colima ssh` opens a shell in it, so `setup.sh` *likely* runs there and takes its Docker, and the computer takes podman 4.9.3.
- **Apple's `container`** 1.7.1 (2026-11-06) now makes long-lived machines that run an image's own init, systemd included (`docs/container-machine.md`), on Apple silicon with macOS 26 only. A later way, unchecked.
- **podman machine** is Fedora CoreOS, which installs as a whole image, so `setup.sh` stops there.
- **OrbStack** is free for personal use only: $8 a person a month for any work, freelancers' included.
- **Homebrew** 7.0.12 still refuses to run as root (`Library/Homebrew/brew.sh:168-201`), so `setup.sh`, run with `sudo`, can't install Lima.

Read once more on 2026-11-09, for an install that does it all, from Lima's release and its source at `v2.2.1`:
- **Which Lima.** 2.3.0 came out on 2026-11-06, inside the two weeks fxbot waits before taking a version. 2.2.1 (2026-10-03) is the newest before it. Its release has `lima-2.2.1-Darwin-arm64.tar.gz` (50 MB) and `lima-2.2.1-Darwin-x86_64.tar.gz` (38 MB), with SHA-256s in `SHA256SUMS`: `9e9eacce88f37e185c346bad73aa6136f738d8cdf8c3bb23cd42b071824bc66e` and `6b776e4bc41f358e6ee01fefcc78e2eb26f11635a0fcff632234af77a566c6c4`. Lima's install docs give that archive as the way without Homebrew (`curl … | tar Cxzvm /usr/local`).
- **What's in it,** unpacked here (arm64): `bin/limactl`, which carries `com.apple.security.virtualization`, the entitlement Apple's framework needs; the guest agent for a VM of the Mac's CPU (`share/lima/lima-guestagent.Linux-aarch64.gz`); and `templates/debian-13.yaml`, whose images are Debian's of 2026-10-01, pinned by SHA-512. Other CPUs' guest agents are in a separate archive, which fxbot doesn't need.
- **What 2.2.1 has:** static port forwards (`pkg/limatype/lima_yaml.go:313`, `pkg/hostagent/hostagent.go:854-856`) and `limactl start-at-login`.
- **Root:** `limactl` refuses it, with "limactl: must not run as the root user" (`cmd/limactl/main.go:35-38`). So `setup.sh`, under `sudo`, runs Lima as `$SUDO_USER`.
- **The Mac's files:** every VM mounts the Mac's home folder by default, read-only (`templates/_default/mounts.yaml`).
- **macOS:** Apple's framework needs macOS 13 (`pkg/driver/vz/vz_driver_darwin.go:268-270`), and on an Intel Mac, macOS 15.5 for Linux 6.12 or newer, Debian 13's kernel, with qemu as the other way (:271-275), which Lima's archive doesn't carry.
- **bash 3.2 here:** Docker Hub's official `bash:3.2` image (updated 2026-11-05) runs macOS's version of bash on Linux, so the Mac's part can be parsed and run here, with stubs for the Mac's commands, before a Mac sees it.

## 2. Key takeaways

1. **The computer's engine is rootless podman where the distro has 4.9 or newer, and the machine's own Docker, run rootless, where it doesn't.** podman 4.9 or newer is in every distro's packages but Debian 12's, Ubuntu 22.04's, and Amazon Linux 2023's. It sits beside either Docker, doesn't depend on whose `docker.io` this is, costs nothing between calls, and leaves one engine to set up and check. Where podman is older, the installed Docker runs rootless from its own packages: `docker-ce-rootless-extras`, Debian's `contrib/`, Fedora's `moby-engine-rootless-extras`, or openSUSE's `docker-rootless-extras`. Only Ubuntu's `docker.io` (22.04 and 24.04), Arch's `docker`, and Amazon Linux's have no way to, and carrying moby's script for them isn't needed: on 24.04 and Arch podman takes the computer, and on 22.04 `docker-ce` does. A computer already set up keeps its engine.
2. **Check first, then change.** Every stop that `setup.sh` can see coming, it sees before apt runs: Coolify, CasaOS, and Tailscale check the system first, and Coolify names the fix.
3. **The engine that's running wins,** as in OpenBot's desktop app, which takes a Docker that answers before it installs podman, and keeps its choice. A running Docker daemon is a stronger sign of what the owner uses than an installed podman, and it keeps podman's bridge clear of Docker's rules. The owner can name one with `FXBOT_ENGINE`.
4. **Long steps show themselves.** Compose's own pull progress, as Immich shows, before the service starts.
5. **Uninstall is a command on the machine,** as with k3s, Netdata, Pi-hole, and CasaOS. The `fxbot` command is already there, versioned with each release, and knows the engine. It asks once, and never without a terminal unless told, as Pi and Netdata do. It keeps a backup and the key by default, as OpenBot and Pi keep the owner's data and say so, and removes everything with `--purge`. It touches only fxbot's own containers, volumes, and images, by project and name, never by pruning: CasaOS's "all containers" is every container on the machine.
6. **Record what `setup.sh` installed, and say it at uninstall.** Pi-hole and k3s remove only what they added. fxbot lists it with the command to remove it, since the owner may now use podman or Docker for other things. Before it installs, apt's own simulation shows whether anything would be removed, and `setup.sh` stops if so, as agent-browser does.
7. **A backup command.** Uninstall, moving to a new machine, and [Back up fxbot](https://fxbot.sh/docs/how-to/back-up/) all need the same four steps, so they become one.
8. **Every stop has its fix on one page,** under the words `setup.sh` prints.
9. **On a Mac, the same one line, and a Linux VM it makes itself.** Lima with Debian 13: free, a whole machine, the distro fxbot and its computer were checked on, forwarded to the Mac's own `127.0.0.1` by a static rule, since podman doesn't listen on its ports, started at login by launchd, and gone with one `limactl delete`. Lima's own archive, pinned and checked as Compose's is, needs no Homebrew, and Lima runs as the owner, so nothing asks a password, and an agent on the Mac can run the line too. It asks once, yes by default, as Pi's installer asks before it installs Node. A native macOS install would mean launchd units, a second `fxbot` command, and no computer, for the same Linux VM that any engine on a Mac runs anyway.
10. **Find the package manager by its binary,** as OpenBot and agent-browser do. Every package fxbot needs has one name per package manager, so apt, dnf, zypper, and pacman cover Mint, Pop!_OS, Raspberry Pi OS, Rocky, Alma, Oracle, Manjaro, EndeavourOS, and CachyOS with no list to keep, where Tailscale, Coolify, and Docker each keep one by hand. os-release is read only for Docker's repository and for the words of a stop.
11. **Never install `docker.io`.** Where a machine has no engine and its distro's podman is older than 4.9 (Debian 12, Ubuntu 22.04, and Mint 21, Pop!_OS 22.04, and Raspberry Pi OS 12), `setup.sh` installs Docker's own `docker-ce`, from Docker's repository with its key pinned, as Docker's docs and get.docker.com do, and Coolify does on Rocky. It runs fxbot, and runs rootless for the computer.
12. **Only apt removes packages unasked.** dnf, zypper, and pacman each refused a conflict without a question, checked by installing `podman-docker` over their Docker. So the simulate step stays apt's, as agent-browser keeps it.
13. **Arch the Arch way:** `pacman -S --needed --noconfirm`, never `-Sy` alone, which is a partial upgrade Arch doesn't support, and never `-Syu` unasked, which upgrades the whole system. An old package list stops with `sudo pacman -Syu` to run first. Arch's `newuidmap` is in `shadow`, which every Arch system has, so it asks for no `uidmap`.
14. **SELinux: label, never disable,** as k3s does. `:z` on fxbot's folders and its key, in the compose file, labels them on SELinux and does nothing elsewhere, on either engine. The computer's system user needs its podman storage labelled like `/var/lib/containers`, which podman's own troubleshooting names.
15. **firewalld: keep podman's trust across reloads.** netavark trusts its subnets until firewalld reloads, then the containers lose their DNS, as they did under ufw. Its own `netavark-firewalld-reload.service` keeps them, and no distro turns it on. None of the installers read touches a firewall.
16. **Not taken:** a `doctor` command, since `fxbot status` saying whether fxbot answers covers the common case, and `--dry-run`, since the checks now run first and [agent-setup.txt](../../packages/website/public/agent-setup.txt) has an agent read the script before it runs.

## 3. Implementation

### The computer's engine (`plugins/computer/host/setup.sh`)

The computer needs a rootless engine for `fxbot-computer`, whatever fxbot itself runs on. The script takes the first of:
1. **The engine the user is already set up on,** so a second run changes nothing: rootless Docker when `$home/.config/systemd/user/docker.service` is there, and podman otherwise.
2. **`--engine`,** when given.
3. **Rootless podman, 4.9 or newer,** installed or in the package manager: every distro in [Other distros](#other-distros) but Debian 12, Ubuntu 22.04, and Amazon Linux 2023. It sits beside either Docker, and starts on a call.
4. **Rootless Docker, from the Docker that's installed,** where that Docker can run rootless: `docker-ce` with `docker-ce-rootless-extras` from Docker's repository, which `docker-ce` came from; Debian's `docker.io` with its script in `contrib/` and `rootlesskit`; Fedora's `moby-engine` with `moby-engine-rootless-extras`; openSUSE's `docker` with `docker-rootless-extras`.
5. **Otherwise it stops, with the way out.** Only Ubuntu 22.04 with `docker.io`, and Amazon Linux 2023, come here: "the computer needs podman 4.9 or newer, or a Docker that runs rootless. This machine's podman is 3.4.4, and Ubuntu's docker.io can't run rootless. Switch to Docker's own docker-ce, which can: https://fxbot.sh/docs/how-to/fix-an-install/#docker-io".

```bash
# Rootless podman when the system has 4.9 or newer, beside whichever engine fxbot runs on: it starts on a call, and
# doesn't depend on whose Docker this is. Where podman is older, the installed Docker, run rootless, if it can be.
if [ -z "$engine" ]; then
  if [ -f "$home/.config/systemd/user/docker.service" ]; then engine=docker
  elif [ -n "$(podman_at_least 4.9)" ]; then engine=podman
  elif [ -n "$(docker_rootless_package)" ]; then engine=docker
  else die "the computer needs podman 4.9 or newer, or a Docker that runs rootless. …"
  fi
fi
```

This replaces lines 72-76, which read `FXBOT_ENGINE` from the release's `.env`, and preferred podman only when it was installed. Line 29, which stops anything without apt ("it needs systemd and apt: Debian 13 or Ubuntu 24.04") before even `--remove`, asks for systemd and one of the four package managers instead. `podman_at_least` reads the installed version, or the package manager's candidate (`candidate`, under [Package managers](#package-managers)). `docker_rootless_package` names the package from step 4 for the Docker that's installed, or nothing.
- **Packages,** through `setup.sh`'s `install_packages`, by the names under [Package managers](#package-managers): for podman, `podman passt slirp4netns`, since podman 4.9 needs `slirp4netns` and only recommends it; for Docker, step 4's package and `slirp4netns`; and on apt, `uidmap` and `dbus-user-session` too. Always `nftables` and `curl`.
- **Two checks, before anything changes:** cgroups v2 (`stat -fc %T /sys/fs/cgroup` is `cgroup2fs`), without which the computers' limits silently do nothing, as on RHEL 8; and user namespaces a user may make (`kernel.unprivileged_userns_clone` isn't 0, as Arch's `linux-hardened` sets it, and `user.max_user_namespaces` isn't 0).
- **Too old, with no Docker to fall back on:** Debian 12 on its podman gets "podman 4.3.1 is older than the 4.9 the computer needs. Docker's own docker-ce runs rootless here: https://fxbot.sh/docs/how-to/fix-an-install/#podman". `setup.sh` no longer leaves a new install there ([its engine](#setupsh)).
- **The docker branch now does real work,** on Debian 12 and Ubuntu 22.04, where podman is too old, as well as for a user already on it and for `--engine docker`. [Open question 2](#5-open-questions) keeps it.
- **SELinux:** the computers' homes are named volumes (`plugins/computer/fxbot/server.ts:508`), which the engine labels itself. But `fxbot-computer` is a system user with no login shell, so SELinux's rules for home folders skip it (libsemanage's `genhomedircon.c:575-577`), and its podman's storage, `/var/lib/fxbot-computer/.local/share/containers`, keeps `/var/lib`'s label, not the one container-selinux gives podman's storage (`container.fc:103-113`). podman's troubleshooting guide names this case. So where `selinuxenabled` answers, the script gives that folder `/var/lib/containers`'s labels: `semanage fcontext -a -e /var/lib/containers "$home/.local/share/containers"`, then `restorecon -R`, with `policycoreutils-python-utils` for `semanage` (dnf's and zypper's name alike). `--remove` deletes the rule with `semanage fcontext -d`. *Likely*: read from source, and checked on a Fedora VM before the docs say so.
- **SELinux and the socket:** the app reaches the computer's engine through its socket, in `/var/lib/fxbot-computer/run`, mounted into the app's container by the override. A confined container can't connect to an engine's socket on SELinux, which is why images that drive an engine say to run them with `label=disable`. So where `selinuxenabled` answers, the override gives the `fxbot` service `security_opt: [ label=disable ]`, as `compose.gpu.podman.yaml` does for the GPU. That container holds the engine's socket anyway, and with it the engine. *Likely*, and checked on the Fedora VM.
- **Its own override file:** the script writes `compose.computer.yaml`, not `compose.override.yaml`, and `compose()` in `deploy/fxbot` adds it when it's there. `compose.override.yaml` is then the owner's alone, for web pairing's ports or anything else, and nothing writes over it or deletes it. When the script finds the old file with its marker, it takes its own three lines out of it (the marker, the volume, and `group_add`), and deletes the file when only `services:` and `fxbot:` are left, so an owner's ports stay. [Open question 16](#5-open-questions).
- **The plugin's code doesn't change:** it reads the engine through the Docker API's `/info` and `/version`, which podman answers (`plugins/computer/fxbot/server.ts:977-983`).
- **Its docs:** the computer's `README.md`, [Give bots a computer](https://fxbot.sh/docs/how-to/give-bots-a-computer/), and [The computer](https://fxbot.sh/docs/reference/computer/) say the computers run on rootless podman where the distro has 4.9 or newer, whatever fxbot runs on, and on the installed Docker, run rootless, where it doesn't, with each package manager's packages, and drop Ubuntu's `docker.io`. The computer goes to 0.3.2 for its README.

The script comes from the release's tag (`deploy/fxbot:302`), so the fix reaches installs with the release.

### `setup.sh`

**The checks, before anything changes.** First the system, then root, then the rest:

| Check | When it fails |
| --- | --- |
| `uname -s` is Linux | On macOS, the Mac's install, [below](#on-a-mac). On Windows' own shells (`MINGW`, `MSYS`, `CYGWIN`), stops: "fxbot runs on Linux. On Windows, run this in WSL 2's Ubuntu, with systemd on." Anything else: "fxbot runs on Linux, and this is <system>." |
| A package manager it knows: the first of `apt-get`, `zypper`, `dnf`, and `pacman` (zypper before dnf, since openSUSE can carry dnf too) | Stops: "setup.sh installs through apt, dnf, zypper, or pacman: on Debian, Ubuntu, Fedora, RHEL and its rebuilds, openSUSE, Arch, and the distros built on them. This is <PRETTY_NAME from os-release>." With a link to the commands reference, in place of the README |
| Packages can be installed: no `/run/ostree-booted` and no `transactional-update` | Stops: "this system installs software as a whole image (Fedora Silverblue or CoreOS, openSUSE MicroOS), so setup.sh can't add packages to it." |
| systemd | Stops: "fxbot needs systemd, to start at boot and to update from Settings." On WSL, it adds how to turn systemd on. See [open question 3](#5-open-questions) |
| The CPU is x86_64 or aarch64 | Stops: "fxbot's images are for x86_64 and arm64, and this machine is armv7l." |
| The port is free, unless fxbot holds it | Stops: "another program listens on port 8787. Run this again with FXBOT_PORT set to a free one, such as: curl -fsSL https://fxbot.sh/setup.sh \| sudo FXBOT_PORT=8780 bash". The example stays clear of 8790–8799, web pairing's UDP range |
| `docker` isn't a snap: `readlink -f "$(command -v docker)"` under `/snap/` | Stops, unless `FXBOT_ENGINE=podman`: "Docker here is a snap, which can't reach fxbot's folders. Remove it (sudo snap remove docker) and run this again, or run it with FXBOT_ENGINE=podman." |
| 3 GB free where the engine keeps images: `/var/lib` | Stops, with what's free. The computer's image needs 1.2 GB more, later |
| 1 GB of memory available | Warns, and carries on: fxbot, its database, and the embedder hold about 500 MB, and a computer about 120 MB at idle |

The system check comes before root, so `curl … | bash` on a Mac, without `sudo`, goes to the Mac's install, not to "run it as root". It also comes before `main`'s definition (below), as the script's first command: bash runs each top-level command as it reads it, so on a Mac, bash 3.2 reads the Mac's part, a function defined and called before anything else, which ends in `exit`, and never parses the Linux part.

The port check is today's (`setup.sh:237`), moved up: it stops when something answers on the port and `fxbot.service` isn't running.

**Three inputs,** beside `FXBOT_FILES` and the others:
- `FXBOT_ENGINE`: `podman` or `docker`, for a fresh install. An install keeps the engine it has.
- `FXBOT_VM`, on a Mac: the VM's name, `fxbot` by default. fxbot's folder on the Mac, `~/.fxbot`, takes the same name, so a check's VM, `fxbot-check`, keeps clear of an owner's own. With Lima's own `LIMA_HOME` and zsh's `ZDOTDIR`, a check changes nothing in the owner's home.
- `FXBOT_PORT`: written to `/opt/fxbot/.env`, and used by the port check, the health check, and the last lines. Compose publishes it today (`deploy/compose.yaml:25`), but the app inside still listens on 8787, and an MCP sign-in reached over `http://127.0.0.1` comes back to `http://127.0.0.1:<the app's port>/callback` (`packages/server/src/index.ts:32`, `packages/sdk/src/mcp.ts:523`). So compose passes `FXBOT_PORT` to the app too and publishes it as the same port on both sides, and `deploy/health` checks `${FXBOT_PORT:-8787}`. Web pairing's bridge reaches the app at the same `localUrl`, so it follows.

**The engine,** for a fresh install:
1. `FXBOT_ENGINE`, when set.
2. docker, when `docker info` answers: its daemon is running. A `docker` that says it's podman (`docker --version`), from `podman-docker`, counts as podman.
3. podman 4 or newer, when it's installed.
4. docker, when it's installed and not a snap. `setup.sh` starts it, as today.
5. podman from the package manager, when it has **4.9** or newer, so the computer can use it too: every distro in [Other distros](#other-distros) but three.
6. Docker's own `docker-ce`, from Docker's repository, on Debian 12 and Ubuntu 22.04 and the distros built on them, whose podman is older. `setup.sh` adds the repository as [Docker's docs](https://docs.docker.com/engine/install/ubuntu/) and get.docker.com do: the key to `/etc/apt/keyrings/docker.asc`, checked against its SHA-256 as Compose's download is, and `/etc/apt/sources.list.d/docker.sources` for `ubuntu` and `$UBUNTU_CODENAME` when os-release has one (Mint and Pop!_OS do), or `debian` and `$VERSION_CODENAME`. Then `docker-ce docker-ce-cli containerd.io docker-compose-plugin`. Then the computer's rootless Docker comes from the same repository.
7. Otherwise it stops: "this system's packages have no podman 4.9 or newer, and Docker publishes no docker-ce for it. Install podman or Docker, then run this again." On Amazon Linux 2023, that's `sudo dnf install docker`, and step 4 takes it.

Step 2 is new: on a machine with a running Docker and an installed podman, a new install takes docker, where today it takes podman. Steps 5 to 7 are new: **`setup.sh` never installs `docker.io`,** the Docker that can't run rootless on Ubuntu 22.04 and 24.04. Today it installs it on Ubuntu 22.04, where it then leaves the computer nowhere to run. An install keeps the engine it has.

**The downloads,** seen: before `systemctl start fxbot`, `"$install/fxbot" compose pull --policy missing`, with Compose's own progress, and skipping an image that's here already, as a check's own build is. The service then starts on images that are already here. The embedder's model still downloads on its first start, as the end says.

**ufw,** in `deploy/fxbot`'s `start()`: on podman, with `ufw status` active, after `compose up -d` makes the network and before the wait:

```bash
# ufw's default deny drops the containers' DNS to aardvark-dns on the bridge, so each start lets port 53 in on it.
iface=$(podman network inspect "${COMPOSE_PROJECT_NAME:-fxbot}_default" --format '{{.NetworkInterface}}' 2>/dev/null) &&
  ufw allow in on "$iface" to any port 53 comment fxbot >/dev/null || true
```

ufw skips a rule it has. `fxbot down` removes the network, so the next start may get another bridge, and adds its rule; uninstall removes every rule marked `fxbot`. It is in `start()`, not `setup.sh`, so `fxbot update` brings it to the installs that need it, such as the owner's from 2026-11-07, and so does a ufw turned on later. [Open question 4](#5-open-questions).

Web pairing's UDP range, when the owner publishes it, comes in through the machine's forwarding, which ufw's own policy drops (`DEFAULT_FORWARD_POLICY="DROP"`). Docker's rules accept it ahead of ufw's, as Docker's own docs warn. netavark's *likely* depend on its driver: on iptables they share ufw's chain, and on nftables they sit in a table of their own, where ufw's drop still applies. Unchecked. M2 checks it, and if it's dropped, [Forward or map a port](https://fxbot.sh/docs/how-to/forward-a-port/) gains ufw's line for the range: `sudo ufw route allow proto udp to any port 8790:8799`.

**firewalld,** on by default on Fedora, RHEL and its rebuilds, and openSUSE, lets podman's DNS in by itself, until it reloads. Read from netavark's source (2.1.0, and 1.17.2 for RHEL 9) and firewalld's docs on 2026-11-09:
- netavark puts each network's subnet in firewalld's `trusted` zone (`src/firewall/firewalld.rs:984-998`), whichever of its drivers the distro builds: nftables on Fedora, RHEL 10, and Tumbleweed, iptables on RHEL 9.
- That change is to the running firewalld only, and `firewall-cmd --reload` drops every such change (`firewall-cmd`'s docs). So after a reload, which an owner or a package can run, the containers' DNS fails as it did under ufw, `EAI_AGAIN db`, until fxbot restarts.
- netavark ships `netavark-firewalld-reload.service`, which puts its rules back after each reload (`contrib/systemd/system/netavark-firewalld-reload.service.in`). No distro turns it on: Fedora's, RHEL's, and openSUSE's presets leave it off.
- Docker needs nothing: it keeps a `docker` zone of its own for its bridges, and puts them back after a reload (moby's `daemon/libnetwork/iptables/firewalld.go:286-305`).

So `start()`, on podman with firewalld running (`firewall-cmd --state`), turns it on, beside ufw's rule:

```bash
# firewalld forgets podman's trusted subnets on a reload, and with them the containers' DNS; netavark's unit puts them back.
systemctl enable --now netavark-firewalld-reload.service >/dev/null 2>&1 || true
```

Uninstall leaves it on, since podman's other networks need it too. [Open question 14](#5-open-questions).

**SELinux,** enforcing on Fedora, RHEL and its rebuilds, and openSUSE (Tumbleweed's new installs since February 2025, and Leap 16's), keeps a container from a host folder that isn't labelled for containers. Read from Compose's, Docker's, and podman's source on 2026-11-09:
- `:z` on a bind mount labels it for containers, through Compose on either engine (compose-go's `format/volume.go:101-113`, podman's compat API), and does nothing where SELinux is off (podman's `libpod/container_internal_common.go:3152-3155`, go-selinux's `label/label_linux.go:116-119`). It works on a single file too.
- Compose's file `secrets:` can't take it: Compose mounts them through the Mount API, which has no SELinux option (`pkg/compose/create.go:1335-1343`). fxbot's key comes in that way (`deploy/compose.yaml:60-61`).
- Docker's own `docker-ce` leaves SELinux off for its containers (`--selinux-enabled` is false by default), so they read any folder. Fedora's `moby-engine` and openSUSE's `docker` turn it on.

So `deploy/compose.yaml` adds `:z` to its three folders, and brings the key in as a read-only bind at the same `/run/secrets/fxbot_key`, in place of `secrets:`. `fxbot rotate-key` mounts one more file, the new key, from `/etc/fxbot` (`deploy/fxbot:149`), so its `-v` takes `:ro,z` too, or a rotation on SELinux can't read the key it seals with:

```yaml
    volumes:
      - ${FXBOT_ROOT:-}/var/lib/fxbot/data:/var/lib/fxbot/data:z
      - ${FXBOT_ROOT:-}/var/lib/fxbot/backups:/var/lib/fxbot/backups:z
      - ${FXBOT_ROOT:-}/var/lib/fxbot/control:/var/lib/fxbot/control:z
      - ${FXBOT_ROOT:-}/etc/fxbot/secret.key:/run/secrets/fxbot_key:ro,z
```

Nothing in `setup.sh`, nothing turned off, and every install gets it with its next update. Of the installers read, only k3s handles SELinux, and it labels and never disables. Immich and Home Assistant document no labels, and Nextcloud AIO turns labels off for its Docker socket. [Open question 13](#5-open-questions).

**A database without its `.env`:** when `setup.sh` starts fresh and finds `fxbot_pgdata`, it starts the database alone, sets the new password over its local socket, which trusts local connections as `fxbot restore` already relies on, and goes on:

```bash
"$install/fxbot" compose up -d --wait db
"$install/fxbot" compose exec -T db psql -U fxbot -d postgres -qc "alter role fxbot password '$password'"
```

The owner's bots, chats, and providers come back, with the key that `setup.sh` leaves in `/etc/fxbot`. If the key is gone too, the sealed keys and tokens can't be opened, and Settings asks for them again.

**What it installed:** each package that wasn't on the machine before goes on a line of `/etc/fxbot/packages`, after a first line naming the package manager. The computer's script appends its own the same way. When `setup.sh` added Docker's repository, its two files go there too, `/etc/apt/sources.list.d/docker.sources` and `/etc/apt/keyrings/docker.asc`. Uninstall reads the file.

**The end** names the real address, with the port, and each way in:
```
fxbot 0.8.0 runs on http://127.0.0.1:8787
Open it there, or reach it:
  from your computer, over SSH:  ssh -N -L 8787:127.0.0.1:8787 <you>@<this machine>
  from your phone, with Tailscale:  sudo tailscale serve --bg 8787
  from your phone, anywhere:  add Essentials, then Settings › Web pairing, and open web.fxbot.sh
Settings shows each new release, with an Update button. To uninstall: sudo fxbot uninstall
```
The Tailscale line names `tailscale` as installed or not, with its download page when not. The web pairing line stays only if [open question 15](#5-open-questions) is settled with a phone on the machine's own Wi-Fi reaching it; until then, Tailscale is the way in that's known to work from the release.

**The guard:** the script's body becomes a `main` function, called on its last line, so a download cut off midway runs nothing.

### Package managers

One `install_packages` function runs every install, in `setup.sh` and, through the same few lines, in the computer's script, with the package manager the checks found. The conflicts and `--needed` were run against dnf, zypper, and pacman in throwaway containers on 2026-11-09, by installing `podman-docker` over each one's Docker; the other rows are each manager's own flags:

| | apt | dnf | zypper | pacman |
| --- | --- | --- | --- | --- |
| On | Debian, Ubuntu, Mint, Pop!_OS, Raspberry Pi OS | Fedora, RHEL, Alma, Rocky, Oracle, Amazon Linux | openSUSE Tumbleweed and Leap | Arch, Manjaro, EndeavourOS, CachyOS |
| Install | `apt-get install -y -qq --no-install-recommends`, after `apt-get update -qq` | `dnf install -y -q --setopt=install_weak_deps=False` | `zypper --non-interactive install --no-recommends` | `pacman -S --needed --noconfirm` |
| Removes a package to install one? | **Yes, unasked.** So `--simulate` runs first, and any `Remv` line stops it, changing nothing: "installing podman would remove <package>." agent-browser does the same. | No: "installed package moby-engine conflicts with … podman-docker", and it asks for `--allowerasing` | No: `--non-interactive` answers the conflict with **c**, cancel | No: "podman-docker and docker are in conflict", and `--noconfirm` keeps docker |
| Package lists | `apt-get update` | dnf refreshes old ones itself | zypper refreshes them itself | **not refreshed:** a failed install stops with "if pacman's package lists are old, update the system first (sudo pacman -Syu), then run this again" |
| There before? | `dpkg -s` | `rpm -q` | `rpm -q` | `pacman -Q` |
| A version on offer (`candidate`) | `apt-cache policy` | `dnf repoquery --latest-limit 1` | `zypper info` | `pacman -Si` |
| Uninstall prints | `sudo apt-get purge …` | `sudo dnf remove …` | `sudo zypper remove --clean-deps …` | `sudo pacman -Rns …` |

`--needed` skips what's there ("docker-1:29.9.3-1 is up to date -- skipping"), so a second run reinstalls nothing. pacman never runs `-Sy` alone, which would be a partial upgrade, and Arch doesn't support those ([System maintenance](https://wiki.archlinux.org/title/System_maintenance#Partial_upgrades_are_unsupported)). Nor does it run `-Syu` unasked, which would upgrade the owner's whole system. Of the references, only Coolify runs pacman for Docker, with `-Syu`, and `-Sy` for its tools.

**The names.** `podman`, `netavark`, `aardvark-dns`, `passt`, `slirp4netns`, `nftables`, `curl`, and `ca-certificates` are the same on all four. The rest:

| Need | apt | dnf | zypper | pacman |
| --- | --- | --- | --- | --- |
| `newuidmap`, for the computer | `uidmap` | there: `shadow-utils` | there: `shadow` | there: `shadow` |
| The computer's user bus | `dbus-user-session` | there | there | there: systemd needs `dbus-units` |
| Compose, when none answers | `docker-compose-plugin`, `docker-compose-v2`, or `docker-compose`, as today | `docker-compose` (Fedora) | `docker-compose` | `docker-compose` |
| The computer's rootless Docker | `docker-ce-rootless-extras`; `rootlesskit` beside Debian's `docker.io` | `docker-ce-rootless-extras`; `moby-engine-rootless-extras` | `docker-rootless-extras` | none |
| Names for a podman on CNI | `golang-github-containernetworking-plugin-dnsname`, Debian 12's | none | none | none |

Where no package has Compose 2.26 or newer (RHEL and its rebuilds, Amazon Linux 2023), `setup.sh` downloads Compose 2.40.3, as it does today.

### On a Mac

The same line installs it, `curl -fsSL https://fxbot.sh/setup.sh | sudo bash`, or without `sudo`, which a Mac doesn't need. `setup.sh` makes a Linux VM with Lima, installs fxbot in it as on any Linux machine, starts it with the Mac, and opens the app in the browser. The owner's next step is the app's own first run: **Essentials**, a provider, and a first bot. No Homebrew, and no password: Lima runs as the owner, and the VM's `sudo` asks none.

**It asks once,** with yes as the default, reading the answer from `/dev/tty`, since the script itself comes in on standard input:

```
fxbot runs on Linux, so on a Mac it runs in a Linux VM, made with Lima.
This downloads Lima 2.2.1 (50 MB) and Debian 13 (about 400 MB), and gives the VM up to
4 CPUs, 4 GB of memory, and a disk that grows as it's used.
Set fxbot up in a VM on this Mac? [Y/n]
```

**n** prints the steps by hand (below), with the page, and changes nothing. With no terminal, as an agent runs it, it takes the default and says so: the agent asked the person first, as `agent-setup.txt` says (below).

**The checks, first,** changing nothing:

| Check | When it fails |
| --- | --- |
| macOS 13.5 or newer (`sw_vers -productVersion`), on Apple silicon or Intel | Stops: "fxbot's VM needs macOS 13.5 or newer. Update macOS, then run this again." |
| On an Intel Mac, macOS 15.5 or newer | Stops: "on an Intel Mac, Debian 13's kernel needs macOS 15.5 or newer." Lima warns of the same, and its other way, qemu, isn't in its archive |
| 15 GB free in the home folder (`df -k ~`) | Stops, with what's free |
| A user to run as: the one running it, or `$SUDO_USER` under `sudo` | Stops when root has no `SUDO_USER`: "run it as yourself, without sudo." Lima refuses root, so under `sudo` every step runs as `$SUDO_USER`, through `sudo -u`, and nothing runs as root |
| The port is free on the Mac | Stops, with `FXBOT_PORT`, as on Linux |

**The steps,** each said as it starts:
1. **Lima.** A `limactl` on `PATH`, 2.2 or newer, is used as it is: the owner's own, from Homebrew or elsewhere. Otherwise fxbot's own copy, Lima 2.2.1, from Lima's release, checked against its SHA-256 for the Mac's CPU, as Compose's download is, and unpacked into `~/.fxbot/lima`. The archive carries `limactl`, signed with the entitlement Apple's framework needs, the guest agent for the VM's CPU, and the templates. A download by curl gets no quarantine flag, so Gatekeeper *likely* lets it run: checked on the Mac.
2. **The VM.** `limactl start --name fxbot --tty=false --set '.mounts = [] | .portForwards += [{"guestPort": 8787, "hostPort": 8787, "static": true}]' template:debian-13`.
   - `.mounts = []`: Lima mounts the Mac's home folder in every VM by default, read-only. fxbot needs nothing of the Mac's, and with no mount, the computer's user, in the same VM, can read none of it.
   - The static rule forwards the port from the VM's start, since podman doesn't listen on it ([Linux on a Mac](#linux-on-a-mac)). With `FXBOT_PORT`, both ports are that one.
   - Otherwise Lima's defaults: up to 4 CPUs, up to 4 GiB of memory (half the Mac's, when that's less), and a 100 GiB disk that fills as it's used.
   - When the VM is there already, it's started if it's stopped, and reused.
3. **fxbot in it.** `limactl shell fxbot -- bash -c 'curl -fsSL https://fxbot.sh/setup.sh | sudo FXBOT_PORT=… bash'`: the same script as on any Linux machine, with `FXBOT_FILES`, `FXBOT_IMAGE`, and `FXBOT_RELEASES_URL` passed on for checks. Its output goes to the Mac's terminal as it runs.
4. **With the Mac.** `limactl start-at-login fxbot`, a launchd agent that starts the VM at login. In it, `fxbot.service` starts fxbot.
5. **The Mac's `fxbot` command.** `~/.fxbot/bin/fxbot`, from the release's `deploy/fxbot-mac`, as Linux gets `deploy/fxbot`. One line in `${ZDOTDIR:-$HOME}/.zprofile`, zsh being macOS's shell, marked as fxbot's and written once, puts `~/.fxbot/bin` on `PATH`, as rustup's and Bun's installers do for theirs.
6. **The app.** `open http://127.0.0.1:8787`, as the owner.

**The end:**
```
fxbot 0.8.0 runs in a VM on this Mac, at http://127.0.0.1:8787, open in your browser.
It starts when you log in. While the Mac sleeps, so does fxbot.
In a new terminal:  fxbot status | logs | update | backup | uninstall
From your phone:  https://fxbot.sh/docs/how-to/run-on-a-mac/#from-a-phone
```

**The Mac's `fxbot` command** (`deploy/fxbot-mac`, bash 3.2) runs without `sudo`: where the docs say `sudo fxbot …`, a Mac says `fxbot …`. `sudo fxbot` on a Mac finds no command, since `sudo`'s `PATH` leaves out the home folder, so the Mac's page says so once, and the command, run as root by some other way, runs itself again as `$SUDO_USER`, as `setup.sh` does.

| Command | What it does |
| --- | --- |
| `fxbot open` | Opens `http://127.0.0.1:<port>` |
| `fxbot start`, `fxbot stop` | Starts or stops the VM |
| `fxbot backup` | `sudo fxbot backup` in the VM, then copies the folder out to `~/fxbot-backups/<date>`, with the key beside it as `secret.key`, which only the owner can read, through `limactl shell … sudo tar -cf -`, since the VM has no mount of the Mac's. It says to keep the key apart from the rest when the folder goes anywhere else |
| `fxbot restore <folder>` | Copies the folder in, puts its `secret.key` in `/etc/fxbot` when it has one, then `sudo fxbot restore` and `sudo fxbot up` |
| `fxbot uninstall [--purge] [--yes]` | Below |
| Anything else | `limactl shell fxbot sudo fxbot <it>`: `status`, `logs`, `update`, `computer`, and the rest |

**Run again,** the line leaves a working install alone: it starts the VM if it's stopped, runs `setup.sh` in it, which changes nothing on a working install, writes the Mac's `fxbot` command again, and replaces fxbot's own Lima when the release pins a newer one. A run that stopped partway goes on from where it stopped, and a failed step prints its last lines and `limactl delete --force fxbot`, to start over.

**Uninstall on a Mac**, `fxbot uninstall`: it asks once, `[y/N]`, then backs up, as `fxbot backup` does, into `~/fxbot-backups/<date>-uninstall` unless `--purge`; turns off the start at login; deletes the VM, `limactl delete --force fxbot`; removes `~/.fxbot`, leaving the owner's own Lima when that's what ran it; and takes its line out of `.zprofile`. Last, it says what it kept and how to install again and restore it (the one line, then `fxbot restore`), and names Lima's download cache, `~/Library/Caches/lima`, with Debian's image in it, about 400 MB, to remove "if you don't use Lima for anything else". With no terminal and no `--yes`, it stops, as on Linux.

**By hand,** for an owner who'd rather: the page lists the same steps as commands (Lima from Homebrew or its archive, `limactl start` as above, `setup.sh` in `limactl shell fxbot`, then `limactl start-at-login fxbot`). With OrbStack, `orb create debian fxbot`, then `orb -m fxbot`, and `setup.sh` in it, reached at `localhost` through OrbStack's own forwarding: free for personal use, paid for work. With Colima, `colima ssh` and `setup.sh` in its Ubuntu 24.04 and its Docker: *likely*, unchecked, so the page names it as untried.

**From a phone:** Tailscale in the VM, `limactl shell fxbot`, then Tailscale's Linux install and `sudo tailscale serve --bg 8787`, so the VM has a tailnet name of its own. Web pairing from the VM goes through two NATs, the containers' and Lima's own network, and is unchecked: the Mac's checks read **Reachability** there. [Open question 15](#5-open-questions)'s addresses would be Lima's, not the Mac's, so on a Mac it wouldn't help. Not while the Mac sleeps: a Mac that stays on, such as a Mac mini, keeps fxbot reachable and its routines on time.

**`agent-setup.txt`:** on a Mac, the agent no longer stops at step 1. It asks whether to set fxbot up in a VM on this Mac, says what that downloads and the memory it takes, and with a yes runs the one line itself, without `sudo`: nothing on a Mac asks a password. Asking which Linux machine to use stays as the other choice.

### The `fxbot` command (`deploy/fxbot`)

| Command | What it does |
| --- | --- |
| `fxbot backup [<folder>]` | Stops the app, writes `database.dump` and `data.tar.gz` into the folder, `/var/lib/fxbot/backups/<date>-by-hand` by default, and starts the app again if it was running. It says to keep `/etc/fxbot/secret.key` apart, and that the app keeps only the five newest folders in `backups/`, so a backup to keep goes elsewhere. `fxbot restore` takes the folder as it is. |
| `fxbot uninstall [--purge] [--yes]` | Below |
| `fxbot status` | Adds whether fxbot answers: "fxbot answers at http://127.0.0.1:8787", or "fxbot doesn't answer. See: sudo fxbot logs fxbot" |
| `fxbot logs` | Follows only on a terminal. Piped, as an agent runs it, it prints the last 100 lines and exits |
| `fxbot update` | Once the new release runs, removes the images the old compose files named and the new ones don't, each by its name. A failed update keeps them, since going back needs them |
| `fxbot embedder gpu` | When the trial run finds no GPU, removes the CUDA image it pulled for it |

`backup` is about 15 lines, the steps in [Back up fxbot](https://fxbot.sh/docs/how-to/back-up/), which then uses it.

**Move to a new machine,** in that page, says what moves beside the backup and the key: `/etc/fxbot/fxbot.env`, the app's settings, and the choices in `/opt/fxbot/.env` that aren't the machine's (`FXBOT_PORT`, `FXBOT_EMBEDDER`), given to `setup.sh` again, and `/opt/fxbot/compose.override.yaml` when the owner wrote one. And it says to stop the old fxbot first, with `sudo fxbot down`, or uninstall it: web pairing's keys come back with the database and the key, so devices paired at web.fxbot.sh reach the new machine with nothing done, but two fxbots on the same keys replace each other at the relay, which closes the older listener (`packages/web-app/relay/worker.ts:119-120`), and each reconnects within about a second and a half (`plugins/web-pairing/fxbot/server.ts:180-189`), so devices would land on either.

### Uninstall

`sudo fxbot uninstall` says what it removes and what it keeps, then asks once, from the terminal:

```
fxbot uninstall removes fxbot from this machine:
  its containers, its database and model volumes, and its images
  the computer: the user fxbot-computer, its computers and their homes, and its firewall
  fxbot.service and fxbot-control, the fxbot command, and /opt/fxbot
It keeps, so you can install again and restore:
  a backup of the database and plugins' files, in /var/lib/fxbot/backups/<date>-uninstall
  the key that opens its stored keys and tokens, /etc/fxbot/secret.key
  the user fxbot, which owns them
To remove those too: sudo fxbot uninstall --purge
Uninstall fxbot? [y/N]
```

| What | `uninstall` | `--purge` |
| --- | --- | --- |
| A backup first, with `fxbot backup` | yes | no |
| The containers, `fxbot_default`, and the volumes `pgdata` and `models` | removed: `compose down --volumes` | removed |
| The images in this install's compose files, every tag of fxbot's own, and llama.cpp's CUDA image from the GPU's trial | removed: `compose down --rmi all`, then each by name, never a prune | removed |
| Older tags of pgvector's and llama.cpp's, from releases before `fxbot update` removed them | listed: another project may use those images | listed |
| The computer, when its override or its user is there | removed: `fxbot computer off` | removed |
| ufw's rules marked `fxbot` | removed | removed |
| The units, `/usr/local/bin/fxbot`, and `/opt/fxbot` | removed | removed |
| `/var/lib/fxbot`: the backups and plugins' files | kept | removed |
| `/etc/fxbot`: the key and the app's settings | kept | removed |
| The user `fxbot` | kept: it owns what's kept | removed |
| Packages `setup.sh` installed | listed, with the package manager's own command ([Package managers](#package-managers)) | listed |
| Docker's repository, when `setup.sh` added it | listed, with its two files | listed |
| podman, Docker, and their other containers | left alone | left alone |

- **The order:** ask; stop `fxbot-control.path`, so the app can't ask for the computer, an update, or the embedder midway; back up, leaving the app stopped; remove the computer's compose file, then the computer, so its script doesn't start fxbot again; disable and stop the other units; `compose down --volumes --rmi all`, and the other images; the ufw rules; read `/etc/fxbot/packages` into memory; the files; with `--purge`, the user. Each step that fails says so and the rest go on, so a second run finishes what the first left.
- **The computer's script** is the copy in `/opt/fxbot/computer-setup.sh`, which uninstall runs itself with `--remove`, so it works with no network. `fxbot computer off` can't stand in: it always downloads the release's script first, and stops when it can't (`deploy/fxbot:302-305`). The copy is the script that last set the computer up, the right one to take it down. Uninstall downloads it only when there's no copy.
- **`--yes`** skips the question, for an agent or a script. With no terminal and no `--yes`, it stops: "add --yes to uninstall without a question".
- **What it prints last:** what it kept and how to restore it (`curl -fsSL https://fxbot.sh/setup.sh | sudo bash`, then `sudo fxbot restore /var/lib/fxbot/backups/<date>-uninstall`); the packages from `/etc/fxbot/packages`, with the package manager's command (`sudo apt-get purge <them>`, `sudo dnf remove`, `sudo zypper remove --clean-deps`, or `sudo pacman -Rns`) "if nothing else here uses them", and Docker's repository's two files when `setup.sh` added them; `sudo tailscale serve reset` when `tailscale serve status` shows port 8787; and, for the owner's devices, that the installed app goes from the home screen like any other, and that keys made for fxbot at providers are revoked there. With `--purge`, web pairing's keys go with the database, so each device paired at web.fxbot.sh gets **Forget on this device**, under its devices in the app, and a passkey made for it is deleted from the phone's passwords. Without it, a restore brings the keys back, and the devices reach fxbot again.
- **Running from `/opt/fxbot`:** bash has the script open, so removing the folder doesn't stop it, and the last lines print from memory.
- **A 0.2 install that moved** also has `/opt/fxbot/{repo,releases,current}`, which go with `/opt/fxbot`, and the machine's Postgres database, which uninstall names with its `dropdb` line, as `fxbot status` does.

**When the `fxbot` command is gone,** [Uninstall fxbot](#the-docs) lists the same steps by hand.

### A checkout

Docs only, in [Run a checkout beside a release](https://fxbot.sh/docs/how-to/checkout-beside-release/): `podman compose -f deploy/compose.dev.yaml --env-file .env down --volumes`, removing `/etc/fxbot-dev` and `.env`, and the computer's `host/setup.sh --remove`.

### The docs

- **New:** [Uninstall fxbot](https://fxbot.sh/docs/how-to/uninstall/), a how-to: the command, `--purge`, what's left and how to remove it, installing again on a backup, the steps by hand, and a section for a Mac.
- **New:** **Fix an install that stopped**, a how-to: each line `setup.sh` prints after `fxbot setup stopped:`, and its fix, with ufw's `EAI_AGAIN db` and Docker's snap. And the computer's: Ubuntu 22.04's `docker.io` (`#docker-io`), switched to `docker-ce` by `sudo fxbot down`, `sudo apt-get remove docker.io`, which keeps `/var/lib/docker`, Docker's repository and `docker-ce` as [Docker's docs](https://docs.docker.com/engine/install/ubuntu/) give them, and `sudo fxbot up`; and a podman too old for the computer (`#podman`). And pacman's old package lists (`#pacman`).
- **New:** **Run fxbot on a Mac**, a how-to: the one line, what it asks and downloads, the Mac's `fxbot` command, from a phone, sleep, backup and uninstall, and the steps by hand, with OrbStack and Colima.
- **Changed:** [Back up fxbot](https://fxbot.sh/docs/how-to/back-up/) uses `fxbot backup`, and gains **Move to a new machine**. [Commands](https://fxbot.sh/docs/reference/commands/): `backup`, `uninstall`, `FXBOT_ENGINE`, `FXBOT_PORT`, and the checks. [What setup.sh creates](https://fxbot.sh/docs/reference/install-layout/): `/etc/fxbot/packages`, ufw's rule, and what uninstall removes. [Your first fxbot](https://fxbot.sh/docs/tutorials/first-fxbot/): the CPU, memory, and disk under **You need**, the distros, and, for a Mac, a link to its page. The home page's install step, its footer, and its **Machine** line (`src/home.tsx:76`, `:169`, `:239`) name the distros, as [open question 12](#5-open-questions) has them, and add "or a Mac, in a Linux VM". [Commands](https://fxbot.sh/docs/reference/commands/) gains a table of the distros, the package manager each uses, and the engines fxbot and the computer get on each. The computer's pages, as above, with the packages on each package manager, in place of PR #11's line. `agent-setup.txt`'s first check names the distros too.
- **`agent-setup.txt`:** its checks say `setup.sh` checks too, and a last section says how to uninstall, with the owner's yes first and `--yes` in the command.
- **Web pairing's pages:** [Forward or map a port](https://fxbot.sh/docs/how-to/forward-a-port/) loses its caveat about the computer's file, since `compose.override.yaml` is the owner's alone, and gains ufw's line if M2 finds it needed. The uninstall page says what `--purge` means for paired devices and passkeys. [The computer](https://fxbot.sh/docs/reference/computer/) names `compose.computer.yaml` in place of the override.
- **README:** a row each for `backup` and `uninstall` in the commands table, and a line each under Install on a Mac and on how to uninstall. `src/sidebar.ts` lists the three pages.
- **`CHANGELOG.md`,** under `## Unreleased`: the computer on Ubuntu's `docker.io`, the other distros, with Arch's line thanking Olen Thompson for [PR #11](https://github.com/iammrduncan/fxbot/pull/11), the checks, `fxbot backup`, and `fxbot uninstall`. No migration, and nothing in the plugin API.

### Cost

- **Loading the page, sending, and streaming:** unchanged. The app's code doesn't change.
- **`setup.sh`:** the checks take milliseconds. The pull it shows is the one the service ran before.
- **Each start:** one `ufw status`, when ufw is installed and the engine is podman.
- **A machine whose fxbot runs on Docker,** once the computer is added: about 45 MB of podman packages on disk (Ubuntu 24.04's podman is 42.6 MB installed), and nothing running between calls, where rootless Docker held 183 MB.
- **On Debian 12 and Ubuntu 22.04,** where the computer runs on rootless Docker: its daemon's 183 MB, all the time, once the computer is added.
- **On a Mac:** the VM's memory, up to 4 GiB, while it runs, and its disk, which grows as it's used; about 50 MB for fxbot's Lima, and about 400 MB for Debian's image in Lima's cache.

### Not in this phase

- **fxbot itself rootless,** with no root engine. Its units, folders, port, and updates assume root.
- **Systems that install as a whole image:** Fedora Silverblue and CoreOS, and openSUSE MicroOS. `setup.sh` stops on them.
- **Alpine,** which has no systemd, and **NixOS,** which has none of the four package managers and is set up by its own configuration.
- **RHEL 8 and its rebuilds,** whose cgroups v1 the computer refuses. fxbot itself isn't checked there.
- **The computer on Amazon Linux 2023,** which has no podman and no Docker that runs rootless. fxbot itself installs once `dnf install docker` has run.
- **SLES,** whose packages weren't put to zypper here, and **Gentoo, Void, and Slackware,** with other package managers.
- **fxbot on macOS itself,** without a VM: launchd units in place of systemd's, another `fxbot` command, and no computer, which needs a Linux kernel. Every engine on a Mac runs a Linux VM anyway.
- **An Intel Mac before macOS 15.5,** whose VM can't run Debian 13's kernel on Apple's framework, and **Lima's qemu**, which its archive doesn't carry.
- **Windows.** WSL 2's Ubuntu with systemd may run `setup.sh` as it is: unchecked. The system check names it.
- **Proxmox's LXC containers,** which need nesting turned on for an engine to run inside.
- **Removing packages** on uninstall.
- **Backups on a schedule,** or to another machine.
- **A `doctor` command,** and **`--dry-run`**.

### What changes

| Part | Change | Lines |
| --- | --- | --- |
| `plugins/computer/host/setup.sh` | the engine's order, the packages on four package managers, the cgroups and user namespace checks, the messages, `/etc/fxbot/packages`, SELinux's storage rule and its `label=disable`, its own compose file | about 48, and about 10 removed |
| `plugins/computer/README.md`, `plugin.json` | the engine on each distro, and 0.3.2 | about 8 |
| `setup.sh` | the checks, two inputs, the engine, Docker's repository, the four package managers, SELinux's labels, the pull, the old database, the packages, the end, `main` | about 140, and about 15 removed |
| `deploy/fxbot` | `backup`, `uninstall`, ufw's and firewalld's rules, `status`, `logs`, the usage, the images an update and a failed GPU trial leave, the computer's compose file, rotate-key's `:z` | about 108 |
| `deploy/compose.yaml`, `deploy/health` | `FXBOT_PORT` inside the app's container too; `:z` on the three folders, and the key as a bind in place of `secrets:` | about 9 |
| `setup.sh`'s Mac part, before `main` | the Mac's checks, the question, Lima, the VM, `setup.sh` in it, start at login, the `PATH` line, `FXBOT_VM`, bash 3.2 only | about 60 |
| `deploy/fxbot-mac` | the Mac's `fxbot` command: `open`, `start`, `stop`, `backup`, `restore`, `uninstall`, and the rest passed to the VM | about 40 |
| Website, `README.md`, `CHANGELOG.md`, `agent-setup.txt` | three new pages, the Mac in `agent-setup.txt` and on the home page, and the others above | about 300 |

Size: about 300 lines of shell for Linux, about 100 more for a Mac, and about 380 of docs.

## 4. Checklist

Checks run on machines made as the installer checks of 2026-11-05 made them: `podman run -d --privileged --systemd=always` from a distro's image with systemd added (Debian 12 and 13, Ubuntu 22.04 and 24.04, Fedora 45, Alma 9 and 10, Tumbleweed, Leap 16, and Arch), with volumes on `/var/lib/containers`, `/var/lib/docker`, and `/var/lib/containerd`, at most three at a time, each removed when done, clear of the real install on 8787. An image built from this branch, and the branch's files, come from a mirror on the host's network, through `FXBOT_IMAGE`, `FXBOT_FILES`, and `FXBOT_RELEASES_URL`. Where rootless podman won't run nested in such a machine, a VM stands in, with the owner's go-ahead. New users, units, nftables tables, and packages on this machine itself need the owner's go-ahead. An install that passes proves little: each runs the lifecycle after (restart, `update`, `restore`, `rotate-key`, `down`, `up`).

Print each check's setup, and match exact fields.

**The bound:**
- **Size:** at most 310 lines of shell for Linux, and 110 for a Mac.
- **Out of scope:** [Not in this phase](#not-in-this-phase).
- **If it must be cut,** the end's address lines go first, then ufw's rule, then the old database, then removing the images an update leaves, then zypper, leaving openSUSE for later. On a Mac, the `fxbot` command's `backup` and `restore` go first, leaving them to the VM's own. The computer's engine, the checks, apt, dnf, and pacman, `backup`, `uninstall`, the Mac's install and its uninstall, and their docs stay.

**M1. The computer on every engine** (a fix: it can be built and released first)
- [ ] Before the change, on Ubuntu 24.04 with `docker.io`: the computer's setup stops with "dockerd-rootless.sh isn't installed". On Ubuntu 24.04 with podman from `setup.sh`: a computer's first start, as it is today, and what it says. Record both in `computer.md`.
- [ ] After: on Ubuntu 24.04 with `docker.io`, with `docker-ce`, and with podman, and on Debian 13 with `docker.io` and with podman, adding the computer sets up rootless podman for `fxbot-computer`. A bot's computer starts, runs a command, reaches the internet, and is refused this machine and `10.0.0.0/8`.
- [ ] Docker's daemon keeps running beside it, and fxbot's own containers still answer.
- [ ] A user already set up on rootless Docker keeps it on a second run, and its computers still list.
- [ ] On Fedora 45, Alma 9 and 10, Tumbleweed, Leap 16, and Arch, adding the computer sets up rootless podman, with the packages named under [Package managers](#package-managers), and a bot's computer starts, reaches the internet, and is refused this machine. On Arch with Docker running, podman beside it.
- [ ] On Debian 12 and Ubuntu 22.04 with `docker-ce`, it sets up rootless Docker from `docker-ce-rootless-extras`, and a bot's computer does the same. On Debian 12 with `docker.io`, rootless `docker.io` from `contrib/`: *likely*, on Docker 20.10, and checked here before the docs say so.
- [ ] Debian 12 on podman 4.3 stops with `#podman`'s message, Ubuntu 22.04 on `docker.io` with `#docker-io`'s, and both change nothing. Amazon Linux 2023 stops too.
- [ ] The cgroups v2 and user namespace checks are read in the diff, with a stubbed `stat` and `/proc/sys` values run through each.
- [ ] `--remove` takes it all away, and the packages stay.
- [ ] The script writes `compose.computer.yaml`, and the app reaches the engine through it. An old `compose.override.yaml` with the marker and an owner's `ports` line loses only the computer's three lines, and one with nothing else is deleted. `--remove` leaves the owner's file alone.
- [ ] The computer's docs and README, 0.3.2, `CHANGELOG.md`, and `computer.md`'s **What the build changed** say so.

**M2. `setup.sh`**
- [ ] Each stop comes before apt changes anything, checked with `dpkg -l` before and after: port 8787 held by another program, a `docker` under `/snap/` (a stub file stands in), and no systemd (a machine run without `--systemd`). The CPU and disk checks are read in the diff, with a stubbed `uname` and `df` run through each.
- [ ] Memory under 1 GB warns and carries on.
- [ ] `FXBOT_PORT=8780` installs on 8780: `.env` has it, the app listens on it inside its container, the health check and the end use it, and `fxbot update` keeps it. An MCP server's OAuth sign-in from `http://127.0.0.1:8780`, against a mock authorization server, comes back to 8780 and finishes.
- [ ] With Docker running and podman installed, it picks docker. With `FXBOT_ENGINE=podman` on the same machine, podman. On Fedora with `podman-docker` and no Docker, podman.
- [ ] A fresh Debian 12 and a fresh Ubuntu 22.04 get `docker-ce` from Docker's repository, and neither gets `docker.io`. With the key file changed on the mirror, it stops before apt runs.
- [ ] A fresh Fedora 45, Alma 9 and 10, Tumbleweed, Leap 16, and Arch get podman from their package manager. On Alma, Compose is the download; on the rest, the package.
- [ ] On Arch with its package lists emptied (`/var/lib/pacman/sync/`), it stops with `#pacman`'s line, and `pacman -Q` is the same before and after.
- [ ] With `/run/ostree-booted` there, it stops before anything changes.
- [ ] The pull shows its progress in a terminal.
- [ ] On Fedora 45 with firewalld running in the machine: fxbot answers, `firewall-cmd --reload` runs, and fxbot still reaches its database, with `netavark-firewalld-reload` enabled. Before the change, the same reload's `EAI_AGAIN db` is recorded.
- [ ] The compose file's `:z` and the key's bind: the lifecycle passes on Debian 13 and Ubuntu 24.04, where SELinux is off, and on both engines. On a Fedora 45 VM with SELinux enforcing (this machine has `/dev/kvm`; qemu is a new package, so with the owner's go-ahead), an install answers, the lifecycle passes, `rotate-key` included, the computer's podman runs with its storage labelled, the app reaches the computer's socket (the plugin says it's ready), and `ausearch -m avc` shows nothing of fxbot's. Without the VM, the human's Fedora check stands in.
- [ ] With ufw active and denying incoming, an install on podman answers, and `ufw status` shows the rule marked `fxbot`. After `fxbot down` and `up`, it still answers. With web pairing's UDP range published by an override, a UDP packet from another machine on the network reaches the app's container, on podman's nftables driver and on Docker; if it doesn't, the forward-a-port page gets ufw's line.
- [ ] With `/opt/fxbot` removed by hand, `setup.sh` comes back on the same bots and chats, and a provider's key still opens.
- [ ] `/etc/fxbot/packages` names the package manager and lists exactly what it installed, on Debian 13, Ubuntu 22.04 (with Docker's repository's two files), Fedora 45, Tumbleweed, and Arch.
- [ ] An install that apt would answer by removing a package stops before it, and changes nothing. A held package that conflicts stands in for one.
- [ ] The script cut off halfway, piped to bash, does nothing.
- [ ] Run again, it leaves a working install alone, and installs no package twice. The lifecycle passes on Debian 13, Ubuntu 24.04, Ubuntu 22.04, Debian 12, Fedora 45, Alma 9, Tumbleweed, and Arch.

**M3. The `fxbot` command**
- [ ] `fxbot backup` writes a folder with `database.dump` and `data.tar.gz`, and the app answers again after. On a fresh machine, `setup.sh`, the key, and `fxbot restore` of that folder bring back the same bots, chats, and library, and a provider's key opens.
- [ ] `fxbot status` says whether fxbot answers, both ways.
- [ ] `fxbot logs | head` exits, and `fxbot logs` in a terminal follows.
- [ ] After an update from the last release, only the new release's images of fxbot's three are left. After a failed update, the old ones are still there. After `fxbot embedder gpu` on a machine with no GPU, the CUDA image is gone.
- [ ] With web pairing's keys in the database, a restore on another machine listens at the relay under the same address, and the move's page says to stop the old one first: two listeners on one address are seen to replace each other at a local relay (`npm run dev --prefix packages/web-app`).

**M4. Uninstall**
- [ ] `fxbot uninstall` shows what it removes and keeps, and **N**, or no answer, changes nothing.
- [ ] **y**, on an install updated once and with a failed GPU trial, leaves no container, volume, image, unit, or ufw rule of fxbot's, no `/opt/fxbot`, and no `fxbot` command. `/var/lib/fxbot`, `/etc/fxbot`, and the user stay, with the new backup.
- [ ] Another compose project's containers, volumes, and images on the same engine are all still there.
- [ ] `setup.sh`, then `fxbot restore` of the uninstall's backup, brings back the same bots, chats, and providers.
- [ ] `--purge` leaves nothing of fxbot's: the paths in [What setup.sh creates](https://fxbot.sh/docs/reference/install-layout/), the user, the volumes, the images, the units, the rules, and the computer's user and firewall table.
- [ ] With the computer set up, its user, computers, firewall, and units are gone, with the network off.
- [ ] With no terminal, it stops without `--yes`, and runs with it.
- [ ] A second run after one stopped partway finishes.
- [ ] `fxbot-control.path` stops before the backup, read in the diff, and a request dropped into `control/requests/` during an uninstall is never carried out.
- [ ] The packages it lists are those in `/etc/fxbot/packages`, and the Tailscale line shows only when `tailscale serve` serves 8787.

**M5. On a Mac** (here, as far as Linux reaches; then on a Mac, from [the handoff](#the-mac-handoff))
- [ ] The Mac's part of `setup.sh` and `deploy/fxbot-mac` parse under bash 3.2: `bash -n` in Docker Hub's `bash:3.2` image, pinned by its digest, run rootless as the `agent` user.
- [ ] In that image, with stubs first on `PATH` for `uname` (`Darwin`, with `arm64` and `x86_64`), `sw_vers`, `df`, `limactl`, `curl`, `shasum`, and `open`: each check stops as its table says, and changes nothing; **n** changes nothing; no terminal takes yes; the stubbed `limactl` gets exactly the arguments above; a changed SHA-256 stops before anything's unpacked; a second run reuses the VM; and under a stubbed root with `SUDO_USER`, every `limactl` runs through `sudo -u`.
- [ ] The system check is the script's first command, so a Mac never parses the Linux part: under bash 3.2, with something only bash 4 has put in the Linux part on purpose, the Mac's part still runs. With `MINGW64_NT-10.0` from the stub, the Windows line.
- [ ] **Run fxbot on a Mac**, `agent-setup.txt`'s Mac steps, the tutorial's link, and the home page's lines are written, and `npm run build-site` checks their links.
- [ ] The handoff below names what's built and how to check it, and the owner has pushed the branch.
- [ ] On the owner's Mac, the handoff's checks, run by Claude Code there, with what it found and fixed committed on the release branch.

**M6. Docs and checks**
- [ ] The three new pages, the changed ones, `agent-setup.txt`, the README, the sidebar, and `CHANGELOG.md`, as above.
- [ ] `npm run typecheck`, `npm run build-site`, `bash -n setup.sh deploy/fxbot plugins/computer/host/setup.sh`, and `git diff --check` pass. New files are checked for whitespace too.
- [ ] The shell's lines are within the bound.
- [ ] This doc's Status says built, with what the build changed. It moves to `docs/_completed/phases/`, and `AGENTS.md` and the README list it.
- [ ] The work is committed on the open release branch, the computer's fix, the scripts, and the docs in separate commits, and not pushed.

**The human runs these:**
- **A fresh VPS on Ubuntu 24.04 with `docker.io`:** install, **Essentials** with the computer, a bot's computer, then `fxbot uninstall`.
- **A fresh VPS on Ubuntu 22.04,** the same, on the `docker-ce` it gets.
- **An Arch machine, and a Fedora machine with SELinux enforcing and firewalld on:** install, **Essentials** with the computer, a bot's computer, an update from Settings, and a reboot.
- **The owner's machine with ufw:** the update that brings ufw's rule, with nothing done by hand.
- **Web pairing from an install `setup.sh` made:** **Essentials**, then a phone paired on the machine's own Wi-Fi, and the same phone on cellular with Wi-Fi off, with what **Reachability** says in the container. This settles [open question 15](#5-open-questions): the owner's own checks ran on a checkout, outside any container.
- **Move to a new machine** with a paired phone: backup, the old one stopped, restore on the new one, and the phone reaches it with nothing done on the phone.
- **On a Mac:** the handoff's logout and login, and its sleep. An Intel Mac, if the owner has one. And the first minute as a newcomer sees it: the one line, the question, the waits, and the app in the browser.
- **The words:** do the stops and the uninstall's question tell a newcomer what to do?

### The Mac handoff

For a Claude Code session on the owner's Mac, once M1 to M4 pass, M5's checks here pass, and the owner has pushed the release branch. The owner clones the repository on the Mac, opens Claude Code in it, and says: "Pick up the Mac handoff in docs/phases/operations.md."

**Read first:** `AGENTS.md` and `CONVENTIONS.md`, this plan's [On a Mac](#on-a-mac), and the Mac's code: `setup.sh`'s part before `main`, and `deploy/fxbot-mac`. The repository's rules hold there too: commit on the release branch, by topic, and push only when the owner says; nothing private in what's committed (no hostnames, home paths, or personal details); and report only what ran.

**Keep the owner's Mac as it was:**
- Run every check as `FXBOT_VM=fxbot-check`, never as `fxbot`, which may be the owner's own install, with `LIMA_HOME` and `ZDOTDIR` set to folders of the check's own under `$TMPDIR`, so neither the owner's VMs nor their `.zprofile` change. Whether `start-at-login`'s launchd agent carries `LIMA_HOME` is itself a check, below.
- Leave alone the owner's own Lima, VMs, Homebrew, shell files, and anything in `~/Library` that isn't the check's. If a check would change one of them, ask the owner first.
- When done, `fxbot uninstall --purge --yes` for the check's VM, then show that nothing's left: `limactl list`, `launchctl list | grep fxbot-check`, the check's folders, and Lima's cache only if the check made it.

**0.8.0 before it's released.** The checks here run the branch's files and an image built from it, through `FXBOT_FILES`, `FXBOT_IMAGE`, and `FXBOT_RELEASES_URL`. On the Mac:
- **The files:** `git archive HEAD` unpacked into a folder `v0.8.0/`, under a folder served with `python3 -m http.server` on a free port, beside a `latest` file that names `v0.8.0`, in the shape of GitHub's releases answer. The Mac runs `setup.sh` from there, and the VM reaches the same folder at `http://host.lima.internal:<port>`.
- **The image:** built in the check's VM from the same files, `podman build -t localhost/fxbot:0.8.0 .`, with `FXBOT_IMAGE=localhost/fxbot`; the pull skips an image that's there. Or, if the owner has pushed an image for the branch, that one.
- **A model:** a small OpenAI-compatible mock of its own on the Mac, reached from the VM at `host.lima.internal`, added as a provider in the app's first run. No real keys.

**The checks,** each with its setup printed and exact fields matched, as here:
1. **The one line,** fresh, with no `limactl` on `PATH`: the question, **Enter** for yes, Lima downloaded and checked (and with one byte of the archive changed, a stop before anything's unpacked), the VM made with no mounts (`limactl list --json`, and nothing of the Mac's in the VM), `setup.sh` run inside, the browser open, and `curl -fsS http://127.0.0.1:<port>/api/health` answering on the Mac.
2. **The static rule:** the Mac's port answers; then, once, with the rule taken out, whether Lima's own forwarding finds podman's port, recorded either way.
3. **The question:** **n** changes nothing. With no terminal (`</dev/null`, and run from a non-interactive shell), it takes yes and says so. Under `sudo`, every Lima step runs as the owner: `ps -o user=` on `limactl`, and the check's Lima folders owned by them.
4. **The stops:** a `sw_vers` stub first on `PATH` for macOS 13.4, and for 15.4 on an Intel answer from a `uname -m` stub; a `df` stub for a full disk; and the port held by `nc -l`. Each stops with its words and changes nothing.
5. **An existing Lima:** with the owner's own `limactl` 2.2 or newer on `PATH`, it's used, and nothing of fxbot's Lima is unpacked; with one older, fxbot's own is.
6. **The Mac's `fxbot`:** `status`, `logs | head` exits, `stop` then `start`, `open`, and `backup`: a folder on the Mac with `database.dump`, `data.tar.gz`, and `secret.key` at mode 600. Then `restore` of it into a second check VM (`FXBOT_VM=fxbot-check2`) brings back the same bots and chats, and a provider's key opens.
7. **Running for real:** the app's first run through **Essentials**, with the computer, against the mock. A bot's computer starts, runs a command, reaches the internet, and is refused the Mac, at `192.168.5.2`.
8. **With the Mac:** `limactl stop`, then the launchd agent started as at login (`launchctl kickstart gui/$(id -u)/<its label>`), and fxbot answers again with nothing else done. A real logout and login, once, by the owner.
9. **Sleep:** the owner puts the Mac to sleep for 10 minutes. After it wakes, fxbot answers, and the VM's clock is within 2 seconds of the Mac's (`date +%s` on both).
10. **Run again:** the line on a working install reuses the VM and changes nothing. On a VM whose `setup.sh` was killed partway, it finishes.
11. **Update:** a check VM installed from 0.7.0, the published release, then **Update** in Settings to the branch's 0.8.0, through `FXBOT_RELEASES_URL`.
12. **Uninstall:** **N** changes nothing. **y** leaves the backup on the Mac and nothing else: no VM, no launchd agent, no fxbot folder, and no `PATH` line. `--purge` leaves no backup either. The owner's own Lima, when it ran the check, stays.
13. **Web pairing in the VM:** what **Reachability** says there, recorded for [open question 15](#5-open-questions), and a phone on the Mac's Wi-Fi and on cellular if the owner pairs one.
14. **An agent:** a fresh Claude Code session, given only `https://fxbot.sh/agent-setup.txt` (served from the branch's copy) and "set up fxbot on this Mac", installs it with the person's one yes, as `FXBOT_VM=fxbot-check`.
15. **Intel:** if the owner has an Intel Mac, 1, 7, and 12 there. If not, it stays a human check.

**Report back** in the session, and in this checklist: each check passed, failed (with its output), or not run (with why). Fixes are committed on the release branch, the Mac's code apart from the docs, and the plan's **What the build changed** says what the Mac taught. The owner pushes.

## 5. Open questions

Each has a default the build follows unless the owner changes it.

1. **The computer's engine.** *Default:* rootless podman where the distro has 4.9 or newer, beside whichever engine fxbot runs on, and the installed Docker, run rootless, where podman is older (Debian 12 and Ubuntu 22.04). On 2026-11-03 the owner made it the machine's own engine, podman or docker; that is what fails on Ubuntu 24.04's and 22.04's `docker.io`. The other way keeps it: the machine's own Docker first, rootless, wherever its packages can (`docker-ce`, Debian's `docker.io`, Fedora's `moby-engine`, openSUSE's `docker`), and podman only where they can't (Ubuntu's `docker.io`, Arch's, Amazon Linux's). Rootless Docker's daemon holds 183 MB all the time.
2. **The computer's Docker branch.** *Default:* it stays. It runs the computer on Debian 12 and Ubuntu 22.04, where podman is too old, and for a user already set up on it. Removing it saves about 45 lines, leaves those two distros without a computer, and moves a user on it to podman, with their computers made again and their homes lost.
3. **No systemd.** *Default:* `setup.sh` stops, since such an install never starts at boot or updates from Settings. The other way keeps today's install, and says what doesn't work.
4. **ufw's rule.** *Default:* `fxbot up` adds it on podman, marked `fxbot`, and uninstall takes it away. Offered for 0.7.0 on 2026-11-07, not yet agreed, and 0.7.0 shipped without it. The other way: a check that prints the command.
5. **What uninstall keeps.** *Default:* a backup, the key, and the user, as apt's `remove` keeps settings, with `--purge` for everything. The other way removes everything unless told `--keep`.
6. **Packages.** *Default:* listed, with the command, never removed. podman or Docker may now run other things.
7. **A running Docker wins.** *Default:* on a machine with a running Docker and an installed podman, a new install uses docker. Installs already made keep their engine.
8. **A Mac in one command.** *Decided* by the owner on 2026-11-09: the one line does the whole install on a Mac, asking `[Y/n]` once, and a session on the owner's Mac checks it from [the handoff](#the-mac-handoff). It was: print Lima's commands and stop.
9. **Which VM on a Mac.** *Default:* Lima with Debian 13, free for any use, a whole VM, and the distro fxbot and its computer were checked on. OrbStack is quicker and lighter, and the page names it for owners who have it, but it's paid for work, and its machines share one kernel, where the computer is unchecked.
10. **`docker-ce` on Debian 12 and Ubuntu 22.04.** *Default:* a fresh install there, with no engine, gets Docker's own `docker-ce` from Docker's repository, so the computer runs too. The other way keeps today's: podman 4.3 on Debian 12, `docker.io` on Ubuntu 22.04, and the computer stopping on both with the fix.
11. **pacman's package lists.** *Default:* `setup.sh` never refreshes them, and an old one stops with `sudo pacman -Syu` to run first. The other way runs `pacman -Syu --needed` itself, as Coolify does for Docker, which upgrades the owner's whole system.
12. **Which distros the docs name.** *Default:* those whose install and lifecycle pass in the checklist, by name, with "and the distros built on them". The rest of [Other distros](#other-distros) stay out of the docs until checked.
13. **SELinux.** *Default:* `:z` in the compose file, and the key as a bind that can take it. The other way: `setup.sh` labels `/var/lib/fxbot` and the key with `semanage fcontext` and `restorecon`, falling back to `chcon`, and the compose file keeps `secrets:`.
14. **firewalld.** *Default:* `fxbot up` turns on `netavark-firewalld-reload.service` on podman with firewalld running, and uninstall leaves it on. The other way: a check that prints the command, as open question 4's other way does for ufw.
15. **Web pairing from the release's containers.** *Default:* the human's check above comes first. If a phone on the machine's own Wi-Fi connects, nothing changes, and the end of `setup.sh` names web pairing. If it doesn't, the compose file publishes 8790–8799/udp, and `fxbot up` passes the machine's addresses (its LAN's and its tailnet's, from `ip -o addr`) to the app in one variable, which the plugin gives werift as `iceAdditionalHostAddresses`. That's about 8 lines across the compose file, `deploy/fxbot`, and the plugin, and it opens those UDP ports on every interface. The other way: leave it to the forward-a-port override, as built, and the end names Tailscale only.
16. **The computer's own compose file.** *Default:* the computer writes `compose.computer.yaml`, and `compose.override.yaml` is the owner's alone, in about 5 lines. Today the owner's web pairing ports go in the computer's file, which `fxbot computer off` deletes. The other way: one file, and the forward-a-port page's caveat stays.
17. **Two fxbots on the same keys.** *Default:* the move's page says to stop the old one first. The other way adds a fix to web pairing, recorded in its build notes: a listener the relay replaced (code 4000) stops listening, and its tab says another fxbot holds this address, with **Remote access** off and on to take it back, in about 4 lines. Only a live listener hears that code, since one the plugin gave up on is closed already, so the newer fxbot keeps the devices.
