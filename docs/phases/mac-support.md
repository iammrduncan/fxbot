# Mac support

fxbot on a Mac from one line, then the owner's agent in the browser, and kept running:
- **One line, then the app.** The line the site shows, `curl -fsSL https://fxbot.sh/setup.sh | sudo bash`, or the same without `sudo`, installs fxbot on a Mac and opens it at `http://127.0.0.1:8787`, on the app's own first run: **Essentials**, a provider, and a first bot.
- **fxbot runs on the Mac itself,** from [Distribution](distribution.md)'s macOS download: Node, fxbot, Postgres 17 with pgvector, and llama.cpp's embedder on Metal, in the owner's own folders, with no admin rights and no VM.
- **Only the computer runs in a VM:** Lima with Debian 13, made when the computer is added or, with a yes, at install, with nothing of the Mac's shared, and the same rootless engine and firewall as on Linux. The computer plugin reaches it through one socket.
- **It keeps running:** it starts at login, updates from Settings, and has `fxbot backup` and `fxbot uninstall`.
- **Checked on a real Mac,** by a Claude Code session there, from [a handoff](#the-mac-handoff).

Status: planned on 2026-11-09, not built. Split from [operations](../_completed/phases/operations.md) that day. There, the Mac's install had grown to fxbot inside a Lima VM, until the owner asked whether only the computer needs one. It does, and [Distribution](distribution.md), planned on 2026-11-08 for after 0.8.0, already plans fxbot on the Mac itself, with a VM for the computer alone. So this phase is Distribution's Mac part, built first, with what was found since. fxbot in a VM stays as [the other way](#the-other-way-fxbot-in-a-vm), planned in full. Researched against Lima's release and source at `v2.2.1`, the computer plugin's code, and Distribution's own research. Nothing was run on a Mac. Where this plan says *likely*, it wasn't checked.

## What the owner asked

For operations, on 2026-11-07: "also what if user is on macos?"

On 2026-11-09, on `setup.sh` printing a Mac's steps rather than running them: "yeah lets do that, but default to [Y/n] on use lima .. But I really want a fully baked mac install... tons of mac users in ths persona ... they need one line install and then access their agent. That sets up the application and the get robust going. When we are ready for mac section I can clone repo to my mac and open claude there and have it pick up a handoff from you so it can do automated testing etc..."

Then: "Is it possible to only use lima vm for the "computer" portion of fxbot and just have normal fxbot installed natively on the mac? why do we need fxbot inside a lima vm itself? We just need that for the computer part yeah? Ok this feels bigger. I want you to cut this scope from this phase and move it to a phases/mac-support.md"

## 0. Core or plugin

**Core: what fxbot needs to run** ([Core or plugin](../../CONVENTIONS.md#core-or-plugin)), as in Distribution: the download, the Mac's `fxbot` command, `app.sh`, and `setup.sh`'s first command. The computer's VM is the install's job, as the computer's setup is on Linux (`deploy/fxbot:297`), and what runs inside the VM is the computer plugin's own `host/setup.sh`. The plugin API gains Distribution's one optional field, `MachineJob.socket`, so the computer plugin finds the VM's socket; it's additive, and needs no `plugin-breaks.json` line.

## 1. Research

### fxbot on a Mac today

`curl -fsSL https://fxbot.sh/setup.sh | sudo bash` runs in macOS's own bash 3.2 and stops at line 29, changing nothing: "this script is for Debian and Ubuntu. Elsewhere, follow the README's steps." Without `sudo`, it first says to run it as root. Neither says what a Mac owner can do. Once [operations](../_completed/phases/operations.md) is built, it stops with a clearer line: "fxbot runs on Linux, and this is macOS. Run this on a Linux machine, or in a Linux VM on this Mac." [Your first fxbot](https://fxbot.sh/docs/tutorials/first-fxbot/) and the home page ask for "a Debian or Ubuntu machine", and `agent-setup.txt` says fxbot "doesn't run on macOS or Windows", and has the agent ask which Linux machine to use.

A release install can't run on macOS itself:
- `setup.sh` and the `fxbot` command need apt and systemd: `fxbot.service` starts it at boot, and `fxbot-control.path` carries out Settings' updates.
- Compose bind-mounts `/var/lib/fxbot` and `/etc/fxbot/secret.key`, owned by a system user, `fxbot`, whose ids the app runs as.
- The computer needs a Linux kernel: a rootless engine for a user of its own, with cpu, memory, and pids delegated by systemd, and an nftables firewall that matches that user's uid.

Docker Desktop, OrbStack's Docker, and Podman Desktop run their containers in a Linux VM of their own already, but none is a Linux machine where `setup.sh` runs: podman's machine is Fedora CoreOS, with no apt, and Docker Desktop's VM has no shell for the owner. A checkout may run on the Mac itself, since libfx publishes `darwin-arm64` and `darwin-x64` builds (`package-lock.json`), with the database from `deploy/compose.dev.yaml` in any of those engines: unchecked, and for contributors, not owners.

So a Mac runs fxbot in a Linux VM. fxbot's images are for arm64 and amd64, so a VM on Apple silicon or on an Intel Mac runs them natively. Its catch is the Mac's own sleep: while the Mac sleeps, so does fxbot, so a routine waits, and a phone can't reach it. A Mac that stays on, such as a Mac mini, is a fine home for it.

### Only the computer needs Linux

Read from the code on 2026-11-09:
- **What ties the release to Linux is its packaging,** not fxbot: an image, systemd's units, apt, and a system user, above. fxbot's server is Node. libfx publishes `darwin-arm64` and `darwin-x64` builds (`package-lock.json:3679-3697`, 0.0.16). Postgres with pgvector and llama.cpp build for macOS, and Distribution found relocatable Postgres builds for it, and llama.cpp's Metal build at 16.7 MB ([The database](distribution.md#the-database), [The embedder](distribution.md#the-embedder)).
- **The computer needs a Linux kernel:** a rootless engine for a user of its own, with cpu, memory, and pids delegated by systemd, and an nftables table matched by its uid.
- **The computer plugin reaches its engine only through a socket that answers the Docker API.** Commands, the terminal, and the desktop all go through `exec` on it (`plugins/computer/fxbot/server.ts:224-243`, `:888-891`), at its `engine` setting or the paths it looks in (`:53`, `:152`). Nothing reaches a container by its address. So an engine in a VM serves an fxbot on the Mac as an engine on the same machine does, once its socket is on the Mac.
- **Lima forwards a socket:** a guest's Unix socket to a path on the Mac (`portForwards: guestSocket/hostSocket`), as Distribution's VM uses.
- **What fxbot on the Mac saves:** with no computer, there's no VM at all, and the app, its database, and its embedder hold about 500 MB. With fxbot in a VM, the VM runs whenever fxbot does, at up to 4 GiB, and macOS doesn't get back the memory a VM frees until it stops (Distribution). Memory search runs on Metal on Apple silicon, and web pairing sees the Mac's own network, as it does on a checkout.
- **What it costs:** a second kind of release, the one Distribution plans, with an archive for each CPU, a launcher, a LaunchAgent, and updates of its own. fxbot in a VM is the Linux release as it is.
- **Bots never act on the Mac itself.** By design ([Bots and the owner's machine](../../CONVENTIONS.md#bots-and-the-owners-machine)), a bot's tools work on fxbot's own data, and files and commands happen on the computer, in the VM. The Mac's own folders are a bot's only through the [local access](plugin-local-access.md) plugin, which the owner adds and turns on. Read from the code on 2026-11-09, this holds already: libfx turns on none of fx's own shell or file tools (its README's security notes); core's tools work on the library, memories, history, and skills in fxbot's database; MCP servers are reached over HTTP, and this machine's and private addresses are refused unless the owner allows them (`packages/sdk/src/mcp.ts:79-105`); and fxbot's own plugins read no file and run no command for a bot. A plugin's own code runs in fxbot's process: on a Mac, as the owner's account; on Linux, in the app's container.

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

### What Distribution plans for a Mac

From [Distribution](distribution.md), planned on 2026-11-08:
- **The download:** `fxbot-<version>-darwin-arm64.tar.gz` and `-x64`, about 150 MB, from `curl -fsSL https://fxbot.sh/app.sh | sh`, unpacked into `~/Applications/fxbot`, with its data in `~/Library/Application Support/fxbot` ([The download](distribution.md#the-download), [Where things live](distribution.md#where-things-live)).
- **The `fxbot` command** runs Postgres, `llama-server`, and the server, answers the control folder, and with `fxbot autostart on` writes a LaunchAgent, `~/Library/LaunchAgents/sh.fxbot.plist`, with `KeepAlive`.
- **Updates** unpack the next archive into a folder of its own, and go back when it doesn't start ([Updates](distribution.md#updates)).
- **The computer:** `limactl` into `computer/lima/`, with `LIMA_HOME` there; a VM named `fxbot` on Apple's framework, with Debian 13 pinned by digest, `mounts: []`, and the computer's `host/setup.sh --user <the Mac's user>` as its provisioning; its socket forwarded to `computer/lima/fxbot/sock/engine.sock`; and the VM stopped after 30 minutes with no computer running ([The computer](distribution.md#the-computer)).
- **Signing waits for Electron.** A download by curl carries no quarantine mark.

What this phase found that Distribution's Mac part needs:
- **Lima 2.3.0 is too new** for the two weeks fxbot waits (2026-11-06). 2.2.1 has everything the VM uses.
- **The main archive is enough.** It carries the guest agent for a VM of the Mac's own CPU, all fxbot runs, so the separate guest agents (39 MB) aren't needed.
- **Lima's own `limactl` carries the virtualization entitlement,** so it *likely* starts a VM as it's downloaded, as Distribution guessed.
- **An Intel Mac needs macOS 15.5** for Debian 13's kernel on Apple's framework. Distribution's Intel check would meet it.
- **`limactl` refuses root,** so under `sudo` everything runs as `$SUDO_USER`.
- **Lima mounts the Mac's home folder by default,** which Distribution's `mounts: []` turns off.
- **Two lines:** Distribution's `app.sh` sits beside `setup.sh`. On a Mac, `setup.sh`'s first command can hand over to `app.sh`, so the site's one line works there too.

## 2. Key takeaways

1. **Only the computer needs Linux.** fxbot runs on macOS, and what ties the release to Linux is its packaging.
2. **One socket is all the computer's VM shares with the Mac,** so an fxbot on the Mac uses it as one on Linux uses a rootless engine.
3. **So fxbot runs on the Mac, and the VM is the computer's alone:** nothing to run until the computer is added, memory search on Metal, web pairing on the Mac's own network, and the plan Distribution made for every OS. It's the owner's own reading too. And since bots never act on the machine, a bot reaches nothing of the Mac's but through the computer's VM, or the local access plugin, when the owner turns it on.
4. **Building fxbot-in-a-VM first would build the Mac twice:** a VM install now, Distribution's later, and a move between them. It stays [the other way](#the-other-way-fxbot-in-a-vm), for a Mac sooner, with no new release to build.
5. **The Mac first:** the `darwin` archives, the launcher's Mac parts, and the computer's VM, ahead of Linux's and Windows' archives, as a release of their own.
6. **Lima 2.2.1, from its own archive, as the owner, with nothing of the Mac's mounted.**
7. **One line everywhere:** on macOS, `setup.sh` hands over to `app.sh`.
8. **Ask once, yes by default,** as the owner asked for Lima: here, whether to make the computer's VM now, so **Essentials**' computer is ready on the first run.

## 3. Implementation

### The way: Distribution's Mac download, first

Build Distribution's M1 to M3 for `darwin-arm64` and `darwin-x64` alone, as a release of their own, with these changes to its plan:
- **One line.** `setup.sh`'s first command, on macOS, runs `curl -fsSL https://fxbot.sh/app.sh | sh` and exits, in what bash 3.2 has, so the line the site shows works on a Mac. Linux keeps the container release's `setup.sh` until Distribution's Linux archives.
- **The question,** in `app.sh`, once the archive is unpacked and before `fxbot` first runs, with yes as the default, read from `/dev/tty`, since the script comes in on standard input:

  ```
  fxbot's computer, where bots run commands and a browser, needs a Linux VM.
  Set it up now? It downloads Lima 2.2.1 (50 MB) and Debian 13 (about 400 MB), and the VM
  uses up to 4 CPUs and 4 GB of memory while computers run. [Y/n]
  ```

  Yes starts the computer's setup in the background, as `computer.json` would, so it's ready when **Essentials** adds the computer. No leaves it for then, with the wait there. With no terminal, as an agent runs it, yes, said so: the agent asked the person first, as `agent-setup.txt` will say.
- **Lima 2.2.1,** pinned by SHA-256 for each CPU, the main archive alone, in place of 2.3.0 and its guest agents.
- **macOS:** the app runs from the oldest macOS Node 24's own build runs on. The computer needs macOS 13.5, and 15.5 on an Intel Mac. Below those, fxbot runs, and the computer's section in Settings says why it can't.
- **As the owner:** `app.sh` and the launcher run as the owner. Under `sudo`, they run as `$SUDO_USER`, since `limactl` refuses root and the folders are the owner's.
- **The end** opens `http://127.0.0.1:8787`, as Distribution's `fxbot` does once fxbot answers.
- **The rest is Distribution's:** the folders, the launcher, the LaunchAgent, updates, backup, uninstall, and the VM's settings.

### The other way: fxbot in a VM

Planned in [operations](../_completed/phases/operations.md) on 2026-11-09, before the split, and kept as it was. It needs no new release, since the Linux release runs in the VM as it is. In its place, fxbot always runs in the VM, at up to 4 GiB, and a later move to Distribution's app would mean a backup and a restore. Its research is [Linux on a Mac](#linux-on-a-mac), above. It takes one input of its own, `FXBOT_VM`, the VM's name, `fxbot` by default. fxbot's folder on the Mac takes the same name, so a check's VM, `fxbot-check`, keeps clear of an owner's own, and with Lima's own `LIMA_HOME` and zsh's `ZDOTDIR`, a check changes nothing in the owner's home.

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

**From a phone:** Tailscale in the VM, `limactl shell fxbot`, then Tailscale's Linux install and `sudo tailscale serve --bg 8787`, so the VM has a tailnet name of its own. Web pairing from the VM goes through two NATs, the containers' and Lima's own network, and is unchecked: the Mac's checks read **Reachability** there. [Operations' open question 15](../_completed/phases/operations.md#5-open-questions) gives a phone the machine's addresses, which here would be Lima's, not the Mac's, so on a Mac it wouldn't help. Not while the Mac sleeps: a Mac that stays on, such as a Mac mini, keeps fxbot reachable and its routines on time.

**`agent-setup.txt`:** on a Mac, the agent no longer stops at step 1. It asks whether to set fxbot up in a VM on this Mac, says what that downloads and the memory it takes, and with a yes runs the one line itself, without `sudo`: nothing on a Mac asks a password. Asking which Linux machine to use stays as the other choice.

**Its checks on a Mac,** in place of the handoff's, if the owner picks this way:
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
13. **Web pairing in the VM:** what **Reachability** says there, recorded for [operations' open question 15](../_completed/phases/operations.md#5-open-questions), and a phone on the Mac's Wi-Fi and on cellular if the owner pairs one.
14. **An agent:** a fresh Claude Code session, given only `https://fxbot.sh/agent-setup.txt` (served from the branch's copy) and "set up fxbot on this Mac", installs it with the person's one yes, as `FXBOT_VM=fxbot-check`.
15. **Intel:** if the owner has an Intel Mac, 1, 7, and 12 there. If not, it stays a human check.

## 4. Checklist

**The bound:**
- **Size:** about 30 lines past Distribution's own Mac parts, in `setup.sh`'s first command, `app.sh`'s question, and the launcher's Lima steps.
- **Out of scope:** Distribution's Linux and Windows archives, Electron, and signing.

**M1. The Mac download** (Distribution's M1 and M2, for `darwin-arm64` and `darwin-x64`)
- [ ] The release workflow builds both archives, each started once on a macOS runner, with `/api/health` and `create extension vector` passing.
- [ ] The launcher's first start, `stop`, `status`, `logs`, `autostart on|off`, updates, backup, and uninstall, as Distribution's checklist has them, on a Mac, from [the handoff](#the-mac-handoff).

**M2. One line and the question** (here, as far as Linux reaches)
- [ ] `setup.sh`'s first command, under bash 3.2 in Docker Hub's `bash:3.2` image, pinned by its digest, run rootless as the `agent` user, with a `Darwin` stub for `uname`, runs `app.sh` and nothing else, and never parses the Linux part.
- [ ] `app.sh` under `sh`, with stubs for `uname`, `sw_vers`, `curl`, `shasum`, `tar`, and `limactl`: the question, **n**, no terminal, a changed SHA-256 refused before anything's unpacked, and under a stubbed root with `SUDO_USER`, every step as that user.

**M3. The computer's VM** (Distribution's M3, for a Mac)
- [ ] `MachineJob.socket`, passed on by `control.ts`, and read by the computer plugin. An older fxbot still finds its socket.
- [ ] Lima 2.2.1's archive, checked, and the VM's settings, as Distribution has them, read in the diff, then run on a Mac from the handoff.

**M4. On the Mac**
- [ ] The handoff's checks, run by Claude Code on the owner's Mac, with what it found and fixed committed on the release branch.

**M5. Docs**
- [ ] **Run fxbot on a Mac**, a how-to: the one line, what it asks and downloads, the computer's VM, from a phone, sleep, backup, and uninstall. The tutorial's **You need**, the home page's install step and **Machine** line, the README, `agent-setup.txt`'s Mac steps, and `CHANGELOG.md`. `npm run build-site` checks their links.

**The human runs these:**
- A real logout and login, and the Mac asleep for 10 minutes or more.
- An Intel Mac, if the owner has one.
- The first minute as a newcomer sees it: the one line, the question, the waits, and the app in the browser.

### The Mac handoff

For a Claude Code session on the owner's Mac, once M2 and M3's checks here pass and the owner has pushed the branch. The owner clones the repository on the Mac, opens Claude Code in it, and says: "Pick up the Mac handoff in docs/phases/mac-support.md."

**Read first:** `AGENTS.md` and `CONVENTIONS.md`, this plan, [Distribution](distribution.md)'s macOS parts, and the code they name: `deploy/app/`, `setup.sh`'s first command, and the computer's `host/setup.sh`. The repository's rules hold there too: commit on the release branch, by topic, and push only when the owner says; nothing private in what's committed (no hostnames, home paths, or personal details); and report only what ran.

**Keep the owner's Mac as it was:**
- Run every check with `FXBOT_HOME`, the install folder, and `LIMA_HOME` in folders of the check's own under `$TMPDIR`, a port off 8787, and a LaunchAgent label of the check's own, so it never replaces the owner's `sh.fxbot`. If `app.sh` or the launcher has no input for one of those, adding it is the first fix.
- Leave alone the owner's own fxbot, Lima, VMs, Homebrew, shell files, and anything in `~/Library` that isn't the check's. If a check would change one of them, ask the owner first.
- When done, `fxbot uninstall --purge` for the check, then show that nothing's left: `limactl list` under the check's `LIMA_HOME`, `launchctl list` for the check's label, and the check's folders.

**Before it's released:** the archive, built on the Mac from the branch by the release workflow's own steps, served from a local folder with its `SHA256SUMS`, and found through `FXBOT_RELEASES_URL`. A model: a small OpenAI-compatible mock of its own, added as a provider in the app's first run. No real keys.

**The checks,** each with its setup printed and exact fields matched:
1. **The one line,** fresh: the question, **Enter** for yes, the archive checked (and with one byte changed, a stop before anything's unpacked), `fxbot` on `PATH`, the app answering at `http://127.0.0.1:<port>`, and the browser open on its first run.
2. **The question:** **n** sets no VM up. With no terminal, it takes yes and says so. Under `sudo`, every step runs as the owner (`ps -o user=`, and the check's folders owned by them).
3. **Running:** a chat with the mock, and a memory found by meaning, with `llama-server` on Metal on Apple silicon.
4. **The computer:** the VM made with Lima 2.2.1 and no mounts, its socket on the Mac, and the computer's section saying it's ready. A bot's computer runs a command, opens Chromium, reaches the internet, and is refused the Mac, at `192.168.5.2`, and a LAN address. The VM stops after its idle time, set short for the check, and starts again on the next call.
5. **With the Mac:** `fxbot autostart on`, the LaunchAgent started as at login (`launchctl kickstart`), and fxbot answering with nothing else done.
6. **Sleep:** after the owner's sleep of 10 minutes, fxbot answers, and the VM's clock is within 2 seconds of the Mac's (`date +%s` on both).
7. **Updates:** a test release to the next, through Settings' **Update**, and back to the old one when the new one fails to start.
8. **Backup and restore:** `fxbot backup`, `restore` into a second check, and a backup from the container release restored into the Mac's app.
9. **Run again:** the line on a working install changes nothing.
10. **Uninstall:** it keeps the data folder; `--purge` leaves nothing of the check's, VM and LaunchAgent included.
11. **Web pairing:** what **Reachability** says on the Mac itself, and a phone on the Mac's Wi-Fi and on cellular if the owner pairs one.
12. **An agent:** a fresh Claude Code session, given only `agent-setup.txt` (the branch's copy) and "set up fxbot on this Mac", installs it with the person's one yes, into the check's folders.
13. **The floors:** a `sw_vers` stub for a macOS below the computer's floor, and for 15.4 on an Intel answer from `uname -m`: fxbot runs, and the computer's section says why it can't.
14. **Intel:** if the owner has an Intel Mac, 1, 4, and 10 there. If not, it stays a human check.

**Report back** in the session, and in this checklist: each check passed, failed (with its output), or not run (with why). Fixes are committed on the release branch, the code apart from the docs, and this plan's **What the build changed** says what the Mac taught. The owner pushes.

## 5. Open questions

Each has a default the build follows unless the owner changes it.

1. **fxbot on the Mac, or in a VM?** *Default:* on the Mac, from Distribution's download, with only the computer in a VM, as the owner's question had it. The other way, [fxbot in a VM](#the-other-way-fxbot-in-a-vm): sooner, since it's the Linux release as it is, but always running a VM of up to 4 GiB, and a move to the app later.
2. **The Mac before Linux and Windows?** *Default:* yes: the Mac's archives, the launcher's Mac parts, and the computer's VM, as a release of their own, and the rest of Distribution after. The other way: all of Distribution at once.
3. **Ask about the computer's VM at install?** *Default:* yes, `[Y/n]`, as the owner asked for Lima, so **Essentials**' computer is ready on the first run. The other way: no question, and the VM comes when the computer is added, with its download there.
4. **Which VM.** *Default:* Lima with Debian 13: free for any use, a whole VM, with socket forwarding, cloud images, and Intel Macs, and the distro fxbot and its computer were checked on. OrbStack is quicker and lighter, but paid for work, and its machines share one kernel, where the computer is unchecked. Distribution's question 3 weighs vfkit too.
5. **An Intel Mac before macOS 15.5.** *Default:* fxbot runs, and the computer says why it can't. The other way: Lima's qemu, which isn't in its archive, and would be a download of its own.
