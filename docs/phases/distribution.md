# Distribution

fxbot as one download per OS that brings everything it needs. The owner doesn't install Docker, podman, Postgres, or Node first:
- **One download for each OS and CPU:** Linux, macOS, and Windows, on x64 and arm64. Each holds Node, fxbot, Postgres 17 with pgvector, and llama.cpp's embedder, in one folder. It runs as the owner, from the owner's own folders, with no admin rights.
- **A small `fxbot` command starts and stops the parts.** It also carries out what the app asks of the machine, as `deploy/fxbot` does for a release install today: updates with a backup and a way back, the embedder, and the computer. It speaks the same control folder, so the app hardly changes.
- **Plugins run as they do today,** inside fxbot's own process, from their folders. Nothing about them changes. Bots never act on the machine itself: their files and commands are the computer's, and the machine's own folders only the [local access](plugin-local-access.md) plugin's, off by default ([Bots and the owner's machine](../../CONVENTIONS.md#bots-and-the-owners-machine)).
- **The computer brings its own Linux machine:**
  - On a Mac, a VM that the app starts, with no admin prompt.
  - On Windows, a WSL2 distro of its own, with one admin prompt and a restart, only when WSL is off.
  - On Linux, today's rootless engine and firewall, with root once.
- **Electron wraps the same folder later:** a window, a tray icon, start at login, signed installers, and updates.
- **Two installs, each for its own use:**
  - **The app is the install the site offers first,** for fxbot on the owner's own computer. The desktop app takes its place once it's built.
  - **The container release is for hosting:** an fxbot that's always on, reached from the owner's other devices, and not tied to a laptop or a desktop.

Status: planned on 2026-11-08, for a release after 0.8.0, not built. It builds on 0.8.0's [operations](../_completed/phases/operations.md): the computer on every engine, `fxbot backup`, and `fxbot uninstall`. The owner's decisions on the plan are under **What the owner asked**. Its Mac part comes first, as [Mac support](mac-support.md) (2026-11-09), which pins Lima 2.2.1 and finds the Intel Mac's floor, below. Researched the same day:
- against the research directive's references
- against desktop apps that bring their own database, embedder, or VM: OpenBot's desktop app, Jan, Open WebUI Desktop, Docker Desktop, Podman Desktop, Rancher Desktop, and Claude Desktop
- against the docs, releases, and source of PGlite, embedded-postgres, the theseus-rs Postgres builds, Node's single executables, Bun, Electron, Lima, vfkit, libkrun, WSL, and llama.cpp

Checked on this machine (Debian 13, x64) in throwaway containers:
- **fxbot 0.6.0's server on portable Postgres 17.11.** pgvector 0.8.7 was compiled against it, all 13 migrations and world-postgres's bootstrap ran, and `pg_dump` worked.
- **PGlite 0.5.15**, behind pglite-socket, under fxbot's migrations and its pools: it broke plugin schemas, live chat streaming, graphile-worker, and overlapping transactions.
- **libfx on WebAssembly** under Node 24 and 26.
- **A Bun-compiled and a Node single-file fxbot server.**

Nothing was run on a Mac or on Windows. Where this plan says *likely*, it wasn't checked.

## What the owner asked

"I want you to look into not relying on docker or postgres to be installed."

"Instead dig into a native binary that bakes in postgres and docker functionality into it and works across unix and mac and windows. With eventual wrapping into an electron app."

"Where we don't manage dependencies and the app image itself brings all the necessary bits to work and plugins run inside the native binary etc..."

"So folks don't require to have system level docker/postgres/podman etc on their machines..."

After reading the plan:
- "the app is main install people see when they come to site, and in future the desktop app becomes it."
- "the container install comes when people want to host a version and access it from other devices and have it long living not tied to their desktop/laptop etc..."
- "I'll hold signing for electron etc..."

So:
- **The app is the main install.** It's the one line the site and the README lead with, and the desktop app (M5) replaces it there once it's built.
- **The container release is for hosting,** and the docs send anyone who wants an always-on fxbot, reached from other devices, there.
- **Signing waits for Electron.** Until then, the one-line install keeps macOS and SmartScreen from asking (see The download).

## 0. Core or plugin

**Core: what fxbot needs to run** ([Core or plugin](../../CONVENTIONS.md#core-or-plugin)). This is install and updates, in a second shape beside the container release, and the one the site offers first. Almost all of it is packaging:
- the `fxbot` command, in `deploy/app/`, beside the release's `deploy/fxbot`
- the release workflow's builds
- later, an Electron shell in `deploy/desktop/`

The server and SDK change by a few lines. Neither is a new package, so fxbot stays four.

**The plugin API gains one optional field:** `MachineJob.socket`, the engine's socket, so the computer plugin finds its engine wherever the machine put it. That is the smallest hook it needs, and it's additive: a plugin that never reads it is unaffected, and no `plugin-breaks.json` line is needed. The computer's machine, a VM on a Mac or a WSL2 distro on Windows, is the install's job, as its setup is today (`deploy/fxbot:297`). The app downloads none of it until the owner adds the computer.

## 1. Research

### fxbot today: what it asks of the machine

A release install is three containers from one compose file, under the machine's podman or docker. Systemd units and a host `fxbot` command run around them (`setup.sh`, `deploy/`). Each thing the app needs, and where it comes from:

| Need | Today | Code |
| --- | --- | --- |
| Node 22.18 or newer, running `.ts` by type stripping | `node:22-trixie-slim`, in fxbot's image | `Dockerfile`, `packages/server/src/index.ts` |
| Postgres 17 with pgvector 0.8 | the `pgvector/pgvector:0.8.7-pg17-trixie` container, on a volume | `deploy/compose.yaml`, `migrations/0005_memories.sql` |
| About 30 connections at once | postgres.js's pool (its default, 10); 2 for each plugin, in a schema of its own; world-postgres's pool of 6, with graphile-worker's LISTEN | `store.ts:30`, `plugins.ts:603`, `sessions.ts:24-32` |
| `pg_dump` 17 and `tar` | `postgresql-client-17` in fxbot's image | `migrate.ts:56-57` |
| A second Node process, for world-postgres's bootstrap | `process.execPath` | `sessions.ts:62` |
| The local embedder | llama.cpp's `llama-server` container, OpenAI's `/v1/embeddings` at `FXBOT_EMBED_URL` | `deploy/compose.yaml`, `embeddings.ts` |
| The secret key | `/etc/fxbot/secret.key`, a compose secret | `index.ts:23` |
| Updates, the embedder switch, and the computer's setup | a request file in `FXBOT_CONTROL`, which the host `fxbot` command carries out as root | `packages/server/src/control.ts`, `deploy/fxbot` |
| The computer's machines | a second, rootless podman or docker for the `fxbot-computer` user, an nftables table matched by its uid, and the Docker API on one socket | `plugins/computer/host/setup.sh`, `plugins/computer/fxbot/server.ts:52-53` |
| Running at boot, and restarts | `fxbot.service`, and the engine's restart policy | `setup.sh` |
| libfx's native addon | `@libfx/libfx-{linux-x64-gnu,linux-arm64-gnu,darwin-x64,darwin-arm64}`, about 9 MB; elsewhere, WebAssembly with JSPI | libfx's README, Runtimes |

What already doesn't depend on the machine:
- **Plugins run inside fxbot's own process.** A plugin's server code is a `.ts` file in its folder, imported when it loads (`plugins.ts:610`). Every plugin in `plugins/` imports only Node's own modules, its own files, and fxbot's types. Its page is a prebuilt `page.js`, and its tables are in Postgres. A plugin needs no npm, no container, and no process of its own.
- **MCP servers are remote only,** over HTTP. Nothing runs `npx` or `uvx`.
- **The page is static files** (`packages/ui/dist`, 1.5 MB) that the server serves.
- **The install-specific code is one file,** `packages/server/src/control.ts` (84 lines). It holds the version, updates, the embedder switch, and `machine`, the one job a plugin can ask of the machine (`computer`).
- **The computer plugin needs only a socket that answers the Docker API** (`server.ts:152`), or the path in its `engine` setting. It reaches everything through that socket: exec, files as tar, images, volumes, and the desktop. Node's `http.request({ socketPath })` takes a Windows named pipe as well as a Unix socket.

### What "baked into one binary" can mean

**One file.** Two runtimes can make a single executable of a Node app, and both were tried on fxbot's server:
- **Bun's `bun build --compile`.** Bun 1.4.4 cross-compiled six targets from Linux: 89–115 MB each, 44–59 MB gzipped.
  - **What works inside the binary:** `import()` of a `.ts` file on disk, as plugins are loaded; an HTTP server with `upgrade` and `ws`; streamed `fetch`; `child_process`; and postgres.js.
  - **fxbot's server compiled (924 modules, 113 MB), then stopped at start:** `Cannot find module '@workflow/world-postgres' from '/$bunfs/root/...'`. That comes from `import.meta.resolve` in `sessions.ts`. The migrations, `ui/dist`, the registry files, and `package.json` are read from disk beside the code, so each would need embedding too.
  - **libfx loads in it only when handed its addon or its `.wasm` by hand** (`nativeAddon`, `wasm`).
  - **Bun is a second runtime.** fxbot is checked only on Node.
- **Node's single executable (SEA).**
  - Node 26.13's `node --build-sea`, with `useVfs`, made one 178 MB file: fxbot's server, its 110 MB of packages, and the page, as a 27 MB zip inside. It booted to its database connection. Inside it, libfx loaded its native addon from the virtual files.
  - It needed a shim: Node won't strip types under `node_modules`, and the zip has no workspace links.
  - SEAs have no macOS x64 support in Node's own tests. The virtual file system is "early development" (Stability 1.0, from v26.9.0). `process.execPath`, which `sessions.ts:62` runs, is the app itself there.
  - Sources: [SEA docs](https://nodejs.org/docs/latest-v26.x/api/single-executable-applications.html), [VFS docs](https://nodejs.org/api/vfs.html), [ESM in SEAs](https://github.com/nodejs/node/pull/61813).

**Neither holds Postgres, the embedder, or a VM.** Postgres is a server of several processes; `llama-server` is its own program; a VM is a hypervisor and a disk. Each stays a file beside the app, in every shape. So one file only moves fxbot's own code into the executable, and costs a second runtime, or Node's early VFS, for it. One folder holds the same parts with none of that.

**Docker functionality can't be baked in.** Containers are a Linux kernel feature. Docker Desktop, Podman Desktop, OrbStack, and Rancher Desktop all run a Linux VM on a Mac or Windows. On Linux, a rootless engine runs without a VM, but it can't keep its containers off the owner's LAN without root: pasta and slirp4netns have no firewall for where a container may connect, and nftables needs root. That's why the computer's setup runs as root once today. So "docker in the app" means one of two things, by OS:
- On a Mac or Windows, the app starts a small Linux VM with an engine inside.
- On Linux, root sets up the engine once.

Emulated Linux in WebAssembly is no shortcut:
- CheerpX/WebVM is 32-bit x86 only, and typically 2–10× slower than native.
- v86 is about 10× slower, and 32-bit too.
- container2wasm interprets with Bochs.
- Chromium for Linux is 64-bit only.

### The database

**Real Postgres, carried in the download.** [theseus-rs/postgresql-binaries](https://github.com/theseus-rs/postgresql-binaries) publishes relocatable builds of every Postgres 14–18 release for Linux (glibc and musl), macOS, and Windows, each on x64 and arm64 (Windows arm64 from 16). It's MIT and Apache-2.0, and Postgres is under its own permissive license. Release 17.11.1, published 2026-10-18:

| Target | Archive |
| --- | --- |
| Linux x64 / arm64 (glibc) | 39.8 / 39.2 MB |
| macOS x64 / arm64 | 93.0 / 89.7 MB (17.1.1's sizes) |
| Windows x64 / arm64 | 49.1 / 47.9 MB (17.1.1's sizes) |

Each archive has all of `bin/`: `postgres`, `initdb`, `pg_ctl`, `pg_dump`, `pg_restore`, `psql`, `pg_upgrade`, and the rest. It also has `include/` and `pg_config`, which an extension builds against.

**Checked here, in a throwaway Debian 13 container with Node 22:**
- **pgvector 0.8.7 compiled against the archive's `pg_config` in 3 s,** with `make` and `make install`, into the archive's own `lib/` and `share/extension/`.
- **Postgres, run as a normal user:** `initdb` took 252 ms, and `pg_ctl start` 110 ms. The new data folder was 39 MB.
- **fxbot's server ran against it:**
  - It migrated all 13 files and set up world-postgres's tables (`workflow`, `graphile_worker`).
  - `/api/health` answered after about 2 s.
  - `create extension vector` worked (0.8.7), and `'[1,2,3]'::vector <=> '[1,2,4]'::vector` answered.
  - The archive's `pg_dump --format=custom` backed it up.
- **At idle, with fxbot connected:** Postgres was 10 processes using 38 MB (PSS), and fxbot's server used 146 MB (RSS).
- **What the archive is made of:** `bin/` is 18 MB, `lib/` 85 MB, `share/` 4 MB, and `include/` 8 MB.
  - `lib/` holds ICU (34 MB, which `postgres` links), Python 3.11 (7.5 MB, only for PL/Python), OpenSSL, Kerberos, libxml2, and the contrib modules.
  - Leaving out PL/Python, Perl, Tcl, `include/`, and the binaries fxbot never runs saves about 20 MB unpacked.
- **Its Linux build is Debian 12's.**
  - `postgres`, `initdb`, and `pg_dump` need glibc 2.34.
  - The `libstdc++` it carries for ICU needs glibc 2.36.
  - So it should load on Debian 12 and 13, Ubuntu 24.04 and newer, and Fedora 37 and newer, but not on Ubuntu 22.04 (glibc 2.35). This comes from the symbol versions; it wasn't run on 22.04.
  - libfx's addon needs glibc 2.34 itself.

**[embedded-postgres](https://github.com/leinelissen/embedded-postgres) (npm)** installs the zonky builds as one package per platform. Paperclip uses it. It ships only `initdb`, `pg_ctl`, and `postgres`, with no `pg_dump`. It has no pgvector and no Windows arm64. Its unpacked sizes are 59 MB (linux-x64), 109 MB (windows-x64), and 337 MB (darwin-arm64: npm can't hold links, so ICU's data is there three times). Its Linux build carries OpenSSL 1.1.1, out of support since 2023. Tried here on Linux, it ran Postgres 18.6. With PGDG's pgvector files copied into it, it passed every test in the table below, which is more evidence that real Postgres needs nothing of fxbot's to change.

**pgvector has no binaries of its own.** Its README builds it with `make`, or `nmake /F Makefile.win` on Windows. Builds from others:
- **conda-forge:** pins Windows to Postgres older than 17.
- **Homebrew:** has no Intel Mac build.
- **[pgembed](https://pypi.org/project/pgembed/) 0.2.0:** ships Postgres 17.9 with pgvector 0.8.2 for Windows, built with MinGW, so a Windows build against 17 is known to work.
- **[pg0](https://github.com/vectorize-io/pg0):** ships Postgres 18 with pgvector, Windows included.

fxbot builds its own on each runner, which is the one way to match the Postgres it carries.

**PGlite** ([electric-sql/pglite](https://github.com/electric-sql/pglite)) is Postgres compiled to WebAssembly, in fxbot's own process. It's 27 MB, the same file on every OS, and needs nothing but npm. openmuse uses it, and so does Prisma's `prisma dev`, which "accepts one connection at a time. Additional connection attempts queue until the active connection closes" ([Prisma](https://www.prisma.io/docs/local-development/postgres)). PGlite runs Postgres in single-user mode, and v0.4's multiplexer sends every client to that one backend. Real connections are a maintainer's draft of about 49,000 lines, unmerged ([#1054](https://github.com/electric-sql/pglite/pull/1054)).

**Tried here with fxbot's own code.** PGlite 0.5.15 (Postgres 18.6) and pglite-pgvector (vector 0.8.7) were served on disk by pglite-socket, with fxbot's pool layout: postgres.js with 10, two plugin pools of 2, and world-postgres's 6. A bundled real Postgres ran the same scripts as the control:

| | PGlite through the socket | Real Postgres |
| --- | --- | --- |
| fxbot's 13 migrations, and world-postgres's bootstrap | pass | pass |
| A plugin's migrations, in its own `search_path` | **fail**: the connection's `search_path` is ignored, so chat-rooms' tables land in `public` (`relation "messages" already exists`) | pass |
| Sessions | **one**: every connection has `pg_backend_pid()` 42, and a `SET`, an advisory lock, or a temp table on one is seen by all | separate |
| LISTEN on one connection, NOTIFY on another | **nothing arrives**, and world-postgres sends a reply's live text only by `pg_notify` | arrives |
| graphile-worker, 20 jobs | **0 of 20**: `prepared statement … already exists`. With prepared statements off and a 500 ms poll, 20 of 20 at 248 ms each, by polling alone | 20 of 20 at 2 ms, woken by NOTIFY |
| 24 overlapping transactions | serialized, 2.4 s, and **one failed in each of 5 runs** (`portal "" does not exist`); the open fix is [#977](https://github.com/electric-sql/pglite/pull/977) | 0.4 s, all rows |
| A transaction that waits on a query from another pool | **deadlock**, as `migrate.ts` would while it runs `pg_dump` | returns |
| Memory | 330–630 MB RSS | 92–97 MB RSS over its 10 processes |
| 10,000 768-dimension vectors: insert, a search, an HNSW build | 5.3 s, 44 ms, 13.2 s | 1.4 s, 28 ms, 4.2 s |
| A crash | data intact after `kill -9`, but it runs with `fsync=off`, and NODEFS can't fsync, so a power cut isn't safe ([#1107](https://github.com/electric-sql/pglite/issues/1107)). Nothing locks the folder against a second process ([#1106](https://github.com/electric-sql/pglite/issues/1106)) | WAL and fsync |
| A backup | pglite-tools' `pgDump` writes plain SQL with `--inserts`, and breaks the shared session's prepared statements while it runs | `pg_dump --format=custom` |

Moving between PGlite's 0.x versions also means a dump and a restore ([upgrade](https://pglite.dev/docs/upgrade)), and its CI runs only on Ubuntu. To work at all, fxbot would need one connection for everything, plugin migrations that set their own `search_path`, and something other than world-postgres's notifications for live chats.

**SQLite would mean rewriting the store.** Every query in the SDK and in each plugin, `tsvector` search, and pgvector would all change. Workflow's Postgres World uses graphile-worker, so chats would need a World of another kind, and there's no SQLite one. CONVENTIONS says to stay on Postgres "until a real limit says otherwise". Carrying Postgres in the download removes the limit.

### Node, and libfx on Windows

**Node's own builds** are 27–41 MB per OS as archives (v24.22.2: linux-x64 32 MB, darwin-arm64 27 MB, win-x64 37 MB), and 122 MB unpacked. fxbot's production packages (`npm ci --omit=dev -w @fxbot/server`) are 136 packages: 110 MB unpacked, or 21 MB as a `.tar.gz`. The biggest are `@workflow` (32 MB), `drizzle-orm` (17 MB), and libfx (10 MB, plus its 9 MB addon). Besides libfx's addon, the only native code is the optional `cbor-extract`.

**libfx has no Windows build.** libfx 0.0.16 publishes addons for Linux (glibc) and macOS, on x64 and arm64. fx's Windows port is open work by people outside the project ([#254](https://github.com/vercel-labs/fx/issues/254), [#412](https://github.com/vercel-labs/fx/pull/412)), with no maintainer reply in #254. libfx's README: "Node.js elsewhere: WebAssembly with JSPI. Some Node versions need `--experimental-wasm-jspi`." The WebAssembly backend runs one tool call at a time, where the native one runs up to 16 at once.

**JSPI, tried against Node's release binaries, one by one:**

| Node | `WebAssembly.Suspending` |
| --- | --- |
| 22.23.4 (V8 12.4) | missing, even with `--experimental-wasm-jspi` |
| 24.0.0–24.19.0 | only with the flag |
| 24.20.0 (2026-08-26, "wasm: enable JSPI", [#59941](https://nodejs.org/en/blog/release/v24.20.0)) and newer | on |
| 25.0.0 | on |
| 26.0.0 and 26.13.0 (LTS) | on, and the flag is refused: "bad option", and Node doesn't start |

Under Node 24.22.2 and 26.13.0 on Linux, libfx's `getBackendInfo()` reported `auto` choosing the native addon. `backend: "wasm"` reported `wasm-jspi` and compiled `fx-core.wasm`. So Windows runs libfx with Node 24.20 or newer and no flag. fxbot must never pass `--experimental-wasm-jspi`, though libfx's own error text suggests it. A full agent on Windows wasn't run.

### The embedder

llama.cpp's releases carry `llama-server` for every target fxbot needs. In b12211 (2026-11-08):

| Archive | Size |
| --- | --- |
| macos-arm64 (Metal) | 16.7 MB |
| macos-x64 | 12.5 MB |
| ubuntu-x64 / ubuntu-arm64 (CPU) | 23.1 / 18.8 MB |
| win-cpu-x64 / win-cpu-arm64 | 24.9 / 13.2 MB |
| ubuntu-vulkan, win-vulkan (x64) | 35.9, 37.8 MB |
| win-cuda-13.5-x64 | 170.9 MB, plus 426 MB of CUDA runtime |

- **It speaks the same OpenAI API** that `FXBOT_EMBED_URL` reaches today. So the embedder needs no code change, only a process.
- **The Linux build needs `libgomp.so.1`,** which its archive doesn't carry, so it didn't start here. The download carries that library itself.
- **The model downloads separately.** fxbot's model, EmbeddingGemma 2 at Q8_0, is 309.9 MB, and `-hf` downloads it on the first start, as the compose file does now.
- **Pin a mirror, not the release.** The release for compose's pinned b12033 answers 404, though its tag exists, so the build fxbot pins goes on fxbot's own release.
- **Rejected:**
  - `node-llama-cpp` 3.22.3 is in-process, but 41 MB plus a package per platform, and a crash would take fxbot's process with it.
  - `onnxruntime-node` is 308 MB, and its EmbeddingGemma is a different model, so every stored vector would need making again.

### The computer without Docker

**macOS, Intel and Apple silicon:**

| Option | Admin? | Size | Intel? | Notes |
| --- | --- | --- | --- | --- |
| **Lima** 2.3.0, `vz` driver | no | 38–50 MB, plus about 39 MB of guest agents | yes, macOS 13.5+ | CNCF, Apache-2.0. Rancher Desktop ships `limactl` inside its app. It forwards a guest's Unix socket to a host path (`portForwards: guestSocket/hostSocket`). |
| vfkit 0.6.4 | no | 66 MB universal | yes | Apache-2.0. podman uses it. A guest vsock port becomes a host Unix socket. Needs its own disk image and init. |
| libkrun / krunkit 1.3.2 | no | about 6 MB, plus libkrunfw 9–25 MB | **no** | Gives freed memory back. podman 6's default on a Mac. |
| Apple's `container` 1.7.1 | its `.pkg` needs admin | — | **no**, macOS 26 only | One VM per container. No Docker API. |
| podman machine 6.1 | its `.pkg` needs admin | 76 MB, plus a 937 MB disk | **no**: podman 6 dropped Intel Macs | OpenBot's choice. |
| OrbStack | — | — | yes | Proprietary, paid for work. Its redistribution terms weren't found. |

- **Admin rights:** Virtualization.framework needs the `com.apple.security.virtualization` entitlement on a signed app, and no admin rights. Community reports say the entitlement isn't restricted; Apple's page didn't load.
- **Memory:** the framework doesn't give memory freed inside the guest back to macOS. A VM stays at its peak until it stops.
- **Precedent:** community analyses of Claude Desktop's Cowork say it runs its Linux VM on Virtualization.framework, through a helper of its own.

**Windows 10 2004+ and 11, Home or Pro:**
- **WSL2 runs on Home,** through the Virtual Machine Platform; Hyper-V doesn't.
- **The admin step comes once per machine:** turning WSL on is an elevated `wsl --install` and a restart. Importing a distro is per-user, and Docker Desktop, Rancher Desktop, and podman all do it without elevation. Microsoft doesn't say so in writing.
- **OpenBot does exactly this.** Its desktop app (Tauri) sets up WSL as a state machine that crosses the restart (`desktop/src-tauri/src/windows.rs`):
  1. as the person, decide what is missing
  2. elevated, once, enable the features
  3. restart
  4. as the person again, create and start the machine

  It's split because "WSL refuses to run as LocalSystem (`Wsl/WSL_E_LOCAL_SYSTEM_NOT_SUPPORTED`)". It also found that "the inbox `wsl.exe` rejects `--no-distribution`", so it installs the current WSL itself.
- **Reaching the engine from Windows:** WSL2 doesn't share Unix sockets with Windows. podman machine forwards its socket to `\\.\pipe\podman-machine-default` through `win-sshproxy` (5.7 MB, from gvisor-tap-vsock, Apache-2.0).
- **WSL Containers (WSLC),** generally available since 2026-09-29, has no Docker API yet ([microsoft/WSL#40976](https://github.com/microsoft/WSL/issues/40976)).

**Linux:**
- **Today's setup:** rootless podman for a user of its own, and an nftables table matched by its uid. Root runs it once, and nothing else keeps containers off the LAN.
- **Ubuntu 24.04's AppArmor rule blocks a bundled engine.** It denies user namespaces to unconfined programs, and its allow profiles name `/usr/bin/podman`, `/usr/bin/crun`, and `/usr/sbin/runc`, so a copy carried in the download fails there.
- **A KVM VM would avoid root** (libkrun, with gvproxy). A desktop user can open `/dev/kvm` on Debian, Ubuntu, Fedora, and Arch, through systemd's `uaccess` rule or mode 0666. SSH and headless sessions can't without the `kvm` group. This is a second path to build and check, for a machine where the owner has root anyway.

**The firewall carries over.** The computer's nftables table blocks the private, CGNAT, link-local, loopback, multicast, ULA, and local addresses for the engine's user, and allows DNS. Every way a VM reaches its host is in those ranges:
- Lima's `host.lima.internal`, 192.168.5.2
- VZNAT's host, 192.168.64.1
- gvproxy's host, 192.168.127.254
- WSL's NAT gateway, in 172.16/12
- WSL's mirrored loopback, in 127/8

So the same `setup.sh`, run inside the VM, keeps bots off the Mac's or the PC's own services and the LAN. One caution: all WSL distros share one VM and, by most accounts, one network stack. So the engine's user needs a uid no distro of the owner's uses.

**One VM for all bots, not one per bot.** In one VM:
- the plugin's Docker API stays as it is
- the 1.18 GB computer image is stored once
- the firewall is in one place that bots can't reach

A VM per bot (microsandbox, Docker's `sbx`, Apple's `container`) would add a kernel per bot. None of them speaks the Docker API. And the bot would be root in the VM that holds its firewall.

**The computer's image,** as built here: 1.18 GB unpacked, which compresses to 375–445 MB. It's built inside the machine on first use, as today.

### The directive's references

- **[eve](https://eve.dev):** an npm package (`npx eve@latest init`, Node 24+). It keeps state in a Workflow World: files for one process, or Postgres. Sandboxes come from Vercel Sandbox, Docker when it answers, or just-bash, a JavaScript shell with no isolation. It ships no binaries.
- **[fx](https://fx.sh):** one Zig binary of 4–6 MB, from `curl … | bash` into `~/.local/bin`, that updates itself. It's built for Linux and macOS only.
- **libfx:** see above. Its addons come as one npm package per platform.
- **[Pi](https://github.com/earendil-works/pi):**
  - **Install:** `curl … | sh`, or `irm … | iex` on Windows, which installs from npm with a pinned lock. It can install Node 22.19 itself, and updates with `pi update`.
  - **Standalone binaries:** releases also carry Bun-compiled binaries for six targets, Windows included, 48–62 MB each.
  - **Sandbox:** Pi's own [Gondolin](https://github.com/earendil-works/gondolin) runs libkrun micro-VMs on Apple silicon and Linux KVM, with QEMU to fall back on. Guest images of 200 MB or more download on first use. It has no Windows support.
- **[Grok bot](https://docs.x.ai/grok-bot/overview):** hosted, with "dedicated and hardware-isolated" cloud computers. Its desktop apps for macOS, Windows, and Linux update themselves.
- **[OpenBot](https://github.com/CopilotKit/OpenBot):** the closest model. It's a Tauri 2 app (83 MB dmg, 48.6 MB Windows setup), with `tauri-plugin-updater`, that brings Postgres with pgvector and a Linux computer for each bot.
  - **Its engine:** it uses a Docker that answers, or else installs podman 6.1.1 and Compose 5.5.1 itself, each pinned to a checksum: "Installing an engine, instead of telling somebody to go and get one." "The person this app is for does not have a package manager, has never heard of Podman, and is not going to read a release page." (`install.rs`).
  - **By OS:** a podman machine on a Mac (applehv, admin once for podman's package), a podman machine on WSL2 on Windows, and podman from the distro on Linux, through pkexec.
  - **Still a container stack.** Its database is a container, so it carries an engine in place of a database.
- **[OpenDuet](https://github.com/CopilotKit/OpenDuet), [OpenDots](https://github.com/CopilotKit/OpenDots):** run from a checkout, with Docker for their computers.
- **[openmuse](https://github.com/CopilotKit/openmuse):** keeps its records in PGlite by default (`.openmuse/`), or Postgres from `DATABASE_URL`. Its docs say "PGlite cannot be opened by separate processes", and that it runs out of memory at 512 MB "because PGlite loads an embedded Postgres build". Its computer is Docker, with a Colima recipe for a Mac, or E2B in the cloud.
- **[agent-desktop](https://github.com/vercel-labs/agent-desktop) and [agent-browser](https://github.com/vercel-labs/agent-browser):** Rust binaries for every OS. Each puts all of its platforms in one npm package (30.7 MB and 121 MB unpacked), with a postinstall that repoints the command at the native binary. agent-browser downloads Chrome for Testing on `install`.
- **[fx0](https://github.com/vercel-labs/fx0) and [durable-harness](https://github.com/vercel-labs/durable-harness):** run on Vercel, or as a library on a Workflow World. There's nothing to install.

### Desktop apps that bring their own parts

| App | Shell | What it brings | Size | Updates |
| --- | --- | --- | --- | --- |
| Open WebUI Desktop | Electron 45 | downloads Python (python-build-standalone, pinned) on first run; runs llama.cpp or Ollama | 107–147 MB | electron-updater |
| Jan | Tauri 2 | bun and uv as sidecars; downloads llama.cpp builds into its data folder | 116 MB dmg | Tauri's updater |
| Docker Desktop | Electron | its own VM | 491–629 MB | Sparkle on macOS |
| Podman Desktop | Electron 45 | sets up podman machine | 156–427 MB | electron-updater |
| Rancher Desktop | Electron | `limactl` inside the app on a Mac, WSL on Windows | — | its own |
| Claude Desktop | Electron | Cowork's Linux VM, by community analyses: Virtualization.framework on a Mac; on Windows, an MSIX with a service and Virtual Machine Platform | MSIX 296 MB; VM rootfs 2.3 GB compressed | Squirrel |
| Khoj | Electron 39 client | `pip install 'khoj[local]'` with `pgserver`, Postgres in a pip package | — | on restart |
| Ollama | Go | llama.cpp compiled in | 230 MB dmg | its own |
| opencode desktop | Electron 44 | a Bun-compiled server as `extraResources` | 152 MB dmg | electron-updater |

**What recurs:**
- **A big runtime downloads on first use,** pinned to a checksum: Open WebUI's Python, Jan's llama.cpp, Gondolin's VM images, OpenBot's podman.
- **The server runs as a child process beside the shell, not inside it.** opencode and Jan do this, and so does OpenBot's engine.
- **Electron apps update with electron-updater,** and Tauri apps with Tauri's updater.

### Electron

- **Versions:** Electron 45.2.3 (2026-11-04) carries Node 24.22.2, V8 15.6, and Chromium 156. Electron 40–44 carry Node 24.15–24.22 ([releases.json](https://releases.electronjs.org/releases.json)).
- **Running the server:** `utilityProcess.fork()` is Electron's way to run Node code apart from the window. `child_process.fork` and `ELECTRON_RUN_AS_NODE` stop working when the `runAsNode` fuse is off, which hardening guides turn off ([fuses](https://www.electronjs.org/docs/latest/tutorial/fuses)). Spawning the download's own Node, as opencode spawns its server, needs neither.
- **Packaging:** native files, and anything fxbot runs as a process, must be outside the `asar` archive.
- **Updates:** electron-builder with electron-updater updates a dmg or zip, an NSIS installer, an AppImage, a deb, or an rpm. `update.electronjs.org` is for macOS and Windows only.
- **Signing:**
  - **Apple:** the Developer Program is $99 a year, with a D-U-N-S number for an organization. Notarizing needs the hardened runtime, and every Mach-O in the app signed: `node`, `postgres`, `pg_dump`, `llama-server`, `libfx.node`, and `limactl`.
  - **Windows:** Azure Artifact Signing (formerly Trusted Signing) is generally available since January 2026, at $9.99 a month. Individuals qualify only in the US and Canada. An EV certificate no longer brings SmartScreen reputation by itself.
  - **Linux:** needs no signing.
- **Tauri** would save about 100 MB. But fxbot's page would run in WebKitGTK on Linux and WebView2 on Windows, which are untried, and the server would still be a Node process beside it.
- **Not run here:** Electron 45's Linux build didn't start on this machine (`libatk-1.0.so.0` is missing). So JSPI and type stripping inside Electron's own Node are unchecked. The plan doesn't depend on them.

## 2. Key takeaways

1. **One download, not one file.** Postgres, `llama-server`, and a VM are programs of their own on every OS. A single executable would only fold fxbot's own code into Node or Bun, at the cost of a second runtime or Node's early VFS. A folder holding Node, fxbot, Postgres, and the embedder runs fxbot's code exactly as the container does, by Node with type stripping.
2. **Real Postgres, carried in the download.** fxbot's own migrations, world-postgres, `pg_dump`, and pgvector ran on the theseus-rs build here. Its idle cost is 38 MB, and it started in 110 ms. pgvector is one small library (188 KB on Linux) that the release workflow compiles for each target. PGlite, the database in fxbot's own process, broke plugin schemas, live chats, graphile-worker, and overlapping transactions, and used 4–6 times the memory. Revisit it if real connections ([#1054](https://github.com/electric-sql/pglite/pull/1054)) ship.
3. **Node 24.20 or newer, so Windows works.** JSPI is on from 24.20, so libfx runs on WebAssembly on Windows with no flag. Node 24 is also Electron 45's Node. Never pass `--experimental-wasm-jspi`: Node 26 refuses to start with it.
4. **The embedder is `llama-server` beside fxbot,** at the same OpenAI API. Only who starts it changes.
5. **The control folder is the seam.** The app already asks the machine for updates, the embedder, and the computer by writing a file (`control.ts`). In the download, a small `fxbot` command written in TypeScript answers those files, as `deploy/fxbot` does in bash. The server hardly changes.
6. **Plugins don't change.** They're files in a folder, which Node imports, as now.
7. **The computer needs a Linux kernel.**
   - **A Mac:** a VM. Lima is the one option with Intel support, no admin rights, socket forwarding built in, and a cloud image ready.
   - **Windows:** a WSL2 distro, as Docker Desktop, Rancher Desktop, podman, and OpenBot do.
   - **Linux:** today's setup, root once, since only root keeps containers off the LAN.
   - **Everywhere:** the computer's own `setup.sh` runs inside the machine unchanged, and the plugin keeps speaking the Docker API to one socket.
8. **Nothing downloads before it's needed.** The base download is 110–150 MB per OS, before trimming Postgres. The embedder's model downloads on the first start, and the computer's machine when the computer is added. A plugin that isn't added costs nothing.
9. **Electron is a shell around the same folder.** It spawns the folder's own `fxbot`, and opens `http://127.0.0.1:8787` in a window. Updates move to electron-updater, and signing costs $99 a year for Apple and about $10 a month for Windows.
10. **The app is the main install, and the container release is for hosting.** The site leads with the app, and later with the desktop app. The container release is for an fxbot that's always on and reached from other devices, on a server, Ubuntu 22.04 included. Data moves between the two with `pg_dump`, since both run Postgres 17.

## 3. Implementation

### The download

One archive per target, attached to each GitHub release with a `SHA256SUMS`: `fxbot-<version>-<os>-<arch>.tar.gz` for `linux-x64`, `linux-arm64`, `darwin-x64`, and `darwin-arm64`, and `.zip` for `win32-x64` and `win32-arm64`. Unpacked, it's one folder:

```
fxbot/
  fxbot, fxbot.cmd        the command: a few lines that run node on fxbot.ts, from versions/<current>
  current                 the version that runs, such as 0.8.0
  versions/0.8.0/
    node/                 Node 24.22's own build for the target
    app/                  packages/server and packages/sdk as source, packages/ui/dist, production node_modules,
                          package.json, and deploy/app/fxbot.ts
    postgres/             Postgres 17.11 from theseus-rs, trimmed, with pgvector built against it
    llama/                llama-server and its libraries (libgomp on Linux), CPU on Linux and Windows, Metal on Apple silicon
```

- **Size:** about 110 MB (Linux x64) to 150 MB (macOS arm64) compressed, and 350–450 MB unpacked.
- **Getting it is one line,** as fx and Pi do it:
  - `curl -fsSL https://fxbot.sh/app.sh | sh` on Linux and macOS
  - `irm https://fxbot.sh/app.ps1 | iex` on Windows

  Each script, about 30 lines (`deploy/app/install.sh` and `install.ps1`, served by the site), runs these steps:
  1. Finds the archive for the OS and CPU.
  2. Checks it against `SHA256SUMS`.
  3. Unpacks it into the folder below.
  4. Puts `fxbot` on the PATH.
  5. Runs `fxbot`.

  A download by `curl` carries no quarantine mark, so macOS doesn't stop each unsigned program in it. Neither does one by PowerShell, *likely*, so SmartScreen doesn't either. Until Electron's signed installers, this is the way in, and the archive on the release page is for anyone who'd rather unpack it themselves.
- **On Windows, `node` is `node.exe`,** and `fxbot.cmd` runs it. Windows 10 1803 and newer carry `tar.exe`, which the backup already runs (`migrate.ts:57`).
- **Linux needs glibc 2.36 or newer,** the theseus build's floor. Ubuntu 22.04 keeps the container release.
- **What gets trimmed from Postgres:** PL/Python, PL/Perl, PL/Tcl, `include/`, and the programs fxbot never runs. It keeps `postgres`, `initdb`, `pg_ctl`, `pg_dump`, `pg_restore`, and `psql`.

### Where things live

| | Linux | macOS | Windows |
| --- | --- | --- | --- |
| The folder | `~/.local/lib/fxbot` | `~/Applications/fxbot` | `%LOCALAPPDATA%\Programs\fxbot` |
| Data | `$XDG_DATA_HOME/fxbot`, or `~/.local/share/fxbot` | `~/Library/Application Support/fxbot` | `%LOCALAPPDATA%\fxbot` |

The data folder holds:
- `db/`, Postgres's data folder
- `data/`, which is `FXBOT_DATA`
- `backups/`, which is `FXBOT_BACKUPS`
- `control/`, which is `FXBOT_CONTROL`
- `models/`, llama.cpp's cache
- `computer/`, the VM, when the computer is added
- `logs/`
- `secret.key` and `db.password`

`FXBOT_HOME` puts the data elsewhere, for checks. The folder and the data are apart, so an update replaces one and never touches the other. Both files are made on the first start, mode 0600, with 32 random bytes and a random password, as `setup.sh` makes them now. The key stays a file, as `FXBOT_SECRET_KEY_FILE` reads it today.

### The `fxbot` command (`deploy/app/fxbot.ts`)

One TypeScript file, run by the folder's own Node. It supervises three processes and answers the control folder. Its commands:

| Command | What it does |
| --- | --- |
| `fxbot` | Starts fxbot if it isn't running, through the autostart service when there is one, or in this terminal when there isn't. Opens `http://127.0.0.1:8787` once it answers. |
| `fxbot stop`, `fxbot status`, `fxbot logs` | Stops the parts, says what's running and whether fxbot answers, and shows the log. |
| `fxbot autostart on\|off` | Starts at login: a systemd user unit (`~/.config/systemd/user/fxbot.service`) on Linux, or a LaunchAgent (`~/Library/LaunchAgents/sh.fxbot.plist`, `KeepAlive`) on a Mac. Windows waits for the Electron shell. |
| `fxbot backup [<folder>]`, `fxbot restore <folder>` | The same backup the migrations take (`pg_dump` and a tarball of `data/`), and today's restore, run against the folder's own Postgres. |
| `fxbot uninstall [--purge]` | Removes the autostart service and the computer's machine, and keeps the data folder unless `--purge`, as the operations phase plans for a release install. |

**First start:**
1. Make the data folder, the key, and the password.
2. Run `initdb -D db -U fxbot --auth=scram-sha-256 --pwfile=…`, with `-E UTF8 --locale=C`. Nothing in fxbot depends on the locale, and `C` means no collation from the OS.

**Each start:**
1. **Postgres.** Pick a free port on 127.0.0.1 and start Postgres with `pg_ctl start -w -o "-p <port> -c listen_addresses=127.0.0.1 -c unix_socket_directories=''"`. On Windows, `pg_ctl` runs `postgres` itself with administrator rights dropped, so an admin account works too. When a `postmaster.pid` is left from a crash and its server still answers, stop that server first with `pg_ctl stop -m fast`.
2. **The embedder,** unless it's off. Start `llama-server` with the compose file's arguments, on another free loopback port, with `LLAMA_CACHE=models`, at lower priority (`os.setPriority`, as `cpu_shares: 256` does today). fxbot doesn't wait for it, as now.
3. **fxbot's server.** Start `node app/packages/server/src/index.ts` with these variables:
   - `FXBOT_DATABASE_URL` and `FXBOT_SECRET_KEY_FILE`
   - `FXBOT_DATA`, `FXBOT_BACKUPS`, and `FXBOT_CONTROL`
   - `FXBOT_EMBED_URL`
   - `PATH`, with `postgres/bin` first, so `pg_dump` is the folder's own
   - an IPC channel, for stopping it

   Wait for `/api/health`.
4. **Restarts.** A server that ends unasked starts again after 2 s, then 4 s, then up to 60 s apart. A start that answers resets the wait.

**Stopping:**
1. Send the server `stop` over IPC, and give it 90 s, as `stop_grace_period` does now.
2. Stop `llama-server`.
3. Run `pg_ctl stop -m fast`.

The IPC message is for Windows, where a signal to a child is `TerminateProcess`, so the server's own shutdown wouldn't run.

**The control folder,** watched for requests as `fxbot-control.path` watches it now, with each step written to the same status files:
- **`update.json`:** see Updates.
- **`embedder.json`:** `cpu` and `off` start or stop `llama-server`. `gpu` fails with "This install runs the embedder on the CPU", or on Apple silicon, "on the GPU already".
- **`computer.json`:** see The computer.

### The server and SDK

The whole change:
- **`packages/server/src/index.ts`:** `process.on("message", (m) => m === "stop" && void shutdown())`, beside the two signal handlers (`index.ts:403-404`).
- **`packages/sdk/src/sessions.ts:62`:** pass `SystemRoot` to world-postgres's bootstrap as well as `PATH` and `HOME`. A child Node on Windows *likely* needs it.
- **`packages/sdk/src/plugin-api.ts:74`:** `MachineJob` gains `socket?: string`, "The engine's socket or named pipe, once the job is done. Since <the release it ships in>." `control.ts` passes it on from `computer-status.json`.
- **`plugins/computer/fxbot/server.ts:152`:** the socket is `fx.settings.engine || fx.machine?.status("computer")?.socket ||` the known paths. An older fxbot returns no `socket`, so `minFxbot` stays where it is.

Nothing else changes:
- `process.execPath` is the folder's Node.
- Plugins import from the data folder, outside `node_modules`, so Node strips their types.
- `localUrl` is the loopback, as now.
- `canUpdate` is true because `FXBOT_CONTROL` is set.

### Updates

The launcher does what `deploy/fxbot`'s `update` does (`deploy/fxbot:161-217`), with folders where it has images:
1. **Read the version to update to,** and check it's newer.
2. **Download the archive** for this OS and CPU from the release, and check it against the release's `SHA256SUMS`.
3. **Unpack it** to `versions/<to>.partial`, then rename it to `versions/<to>`.
4. **Stop the server and Postgres.** Start Postgres, then the server, from `versions/<to>`, and wait up to 10 minutes for `/api/health`, since migrations may run.
5. **If it answers,** write `<to>` to `current`. The next start runs the new `fxbot.ts` too.
6. **If it doesn't,** go back to the old version:
   1. Stop the new version.
   2. If the migration count changed, restore the newest backup taken since the update began, as `deploy/fxbot` does.
   3. Start the old version again, and write `back` with the server's last lines.

After an update:
- **Old versions:** the newest two stay. Older ones are removed when `fxbot` next starts; on Windows, a running `node.exe` locks its folder until then.
- **Postgres's major version stays 17.** A release that moves to 18 says so, and its update runs `pg_upgrade` from the new folder. That's not in this phase.

### The computer

The launcher answers `computer.json` by OS. Each way ends with the same three things:
- the computer's `host/setup.sh` run inside a Linux it controls
- its socket reached from the host
- `computer-status.json` saying `done`, with `socket`

It downloads the computer's script from the release, as `deploy/fxbot:302` does now.

**A Mac: a Lima VM.**
1. **Download `limactl`,** for the Mac's CPU (Lima 2.2.1's release, pinned to a checksum, 38–50 MB), into `computer/lima/`. Its main archive carries the guest agent for a VM of the Mac's own CPU, so the separate guest agents aren't needed ([Mac support](mac-support.md)). `LIMA_HOME` keeps Lima's state there too.
2. **Start a VM named `fxbot`:**
   ```yaml
   vmType: vz
   images:                      # Debian 13's cloud image, pinned to its digest
     - location: https://cloud.debian.org/images/cloud/trixie/<date>/debian-13-genericcloud-arm64-<date>.qcow2
       arch: aarch64
       digest: sha512:…
     - location: …amd64…
       arch: x86_64
       digest: sha512:…
   # cpus and memory: Lima's defaults, 4 CPUs at most and min(4 GiB, half the Mac's)
   disk: 40GiB
   mounts: []                   # nothing of the Mac's is shared
   containerd: { system: false, user: false }
   provision:
     - mode: system
       script: |                # the launcher writes in the computer's setup.sh, its options set first
         #!/bin/bash
         set -- --user <the Mac's user name, which Lima's guest user has too>
         …
   portForwards:
     - guestSocket: /var/lib/fxbot-computer/run/engine.sock
       hostSocket: "{{.Dir}}/sock/engine.sock"
   ```
3. **The socket is `computer/lima/fxbot/sock/engine.sock`.** The VM starts and stops with fxbot.
4. **This needs no admin prompt.**
   - **Code signing:** an unsigned `limactl` from a download *likely* starts the VM, since Lima's own release isn't notarized. The Electron shell signs it with the virtualization entitlement.
   - **An Intel Mac needs macOS 15.5** for Debian 13's kernel on Apple's framework (Lima's `pkg/driver/vz/vz_driver_darwin.go:271-275` @v2.2.1). Below that, fxbot runs, and the computer's section says why it can't.
   - **Memory:** the VM stays at its peak until it stops. The computer already stops idle computers, so the launcher stops the VM after 30 minutes with none running, and starts it again on the next call.

**Windows: a WSL2 distro.**
1. **If `wsl --status` fails, stop with one step for the owner.** Settings shows it:
   - Run `wsl --install --no-distribution` as administrator. Where Windows' inbox WSL refuses `--no-distribution`, as OpenBot found on Windows Server 2022, install WSL's current release from its release page instead.
   - Restart, then press **Try again**.

   The owner does it, not the launcher, since WSL refuses to run as LocalSystem, and the restart is the owner's to make.
2. **Make the distro** with Microsoft's documented `wsl --import`:
   ```
   wsl --import fxbot-computer %LOCALAPPDATA%\fxbot\computer <debian-13.tar> --version 2
   ```
   - `--import` names the distro, so it never takes the place of a Debian the owner has.
   - The tarball is `debian:trixie-slim`'s files, which the release workflow exports from a container and attaches to the release, as Microsoft's guide to importing a distro does with `docker export`. It's about 30 MB.
   - Inside, install `systemd`, `systemd-sysv`, and `dbus`, then write `[boot] systemd=true` to `/etc/wsl.conf`, and run `wsl --terminate fxbot-computer`.
3. **Run the setup inside:**
   ```
   wsl -d fxbot-computer -u root -- bash <script> --user fxbot --name fxbot-computer
   ```
   - **Users first.** The launcher makes the `fxbot` user, for the forwarding, and `fxbot-computer`, with `useradd --system --uid 2741`, as the script would; the script keeps a user that exists (`setup.sh:111`).
   - **Why the uid:** WSL's distros share one network stack, by most accounts, so the firewall matches the uid in every distro. A uid of its own keeps a user in the owner's Ubuntu from falling under it.
4. **Forward the socket.** `win-sshproxy` (5.7 MB, pinned) forwards `\\.\pipe\fxbot-computer-<user>` to the engine's socket, over SSH into the distro with a key only the launcher holds, as podman machine does. *Likely*; this is the least proven step, and the Windows check covers it.

**Linux: today's setup, root once.**
- **On a desktop:** the launcher runs `pkexec bash <script> --user $USER`, which shows the system's password dialog.
- **Without one:** Settings shows the `sudo` command, as the computer's section does now (`server.ts:997`).
- **The socket** is where the script puts it, `/var/lib/fxbot-computer/run/engine.sock`, which the plugin already looks for. The operations phase's engine fix lets this work wherever podman comes from apt.

### Hosting is the container release's

An fxbot that's always on, reached from the owner's other devices, and not tied to a laptop or a desktop is the container release's job. The operations phase improves that install.

The app doesn't take this on. It runs while its owner is logged in, at the computer's own loopback, and gets no headless mode: no lingering user unit, and no service for a machine nobody logs in to. An owner who outgrows it moves to the container release with `fxbot backup` and `fxbot restore`.

### Building it

The release workflow (`.github/workflows/release.yml`) gains a job with one runner per target, on its own CPU and OS:
- `ubuntu-24.04` and `ubuntu-24.04-arm`
- `macos-15` (Apple silicon) and `macos-15-intel`
- `windows-2025` and `windows-11-arm`

Each one:
1. Downloads Node 24.22, theseus-rs Postgres 17.11.1, and llama.cpp's pinned build, each checked against a hash in the workflow.
2. Compiles pgvector 0.8.7 against that Postgres: `make`, or `nmake /F Makefile.win` on Windows, which pgvector documents. On Windows, it also copies the Visual C++ runtime's DLLs beside `postgres.exe`, which Microsoft allows. An MSVC build of Postgres *likely* needs them, and a PC without them can't start it.
3. Installs production packages for the target (`npm ci --omit=dev -w @fxbot/server`), then adds the built page.
4. Starts the result once: `fxbot`, `/api/health`, and `create extension vector`.
5. Uploads the archive.

The publish job adds the archives and `SHA256SUMS` to the release. llama.cpp's build is attached to fxbot's own release too, since llama.cpp's releases for a tag can go missing.

### Electron (a later release)

A shell in `deploy/desktop/`, about 200 lines, outside the workspaces as plugins are. It carries the download's folder as `extraResources`.
- **Main process:**
  - Runs the folder's `fxbot run` as a child, not in Electron's own Node. That leaves out Electron's `runAsNode` fuse, its `process.execPath`, and its JSPI and type stripping.
  - Waits for `/api/health`, and opens a window on `http://127.0.0.1:8787`. A link that opens a new window, such as an MCP sign-in, goes to the system browser.
- **A tray icon** with Open, the status, and Quit. Closing the window leaves fxbot running.
- **Start at login:** `app.setLoginItemSettings` on a Mac and Windows, and an XDG autostart file on Linux. This is Windows' start at login.
- **Updates:** electron-builder with electron-updater (dmg and zip, NSIS, AppImage and deb). The launcher's own updater turns off under the shell (`FXBOT_UPDATES=shell`), and Settings' **Update** asks the shell instead.
- **Signing:**
  - **Apple:** Developer ID and notarization, with every Mach-O signed. Lima's `limactl` gets `com.apple.security.virtualization`.
  - **Windows:** Azure Artifact Signing.

### The docs

- **The tutorial, "Your first fxbot"** (`tutorials/first-fxbot.md`), starts from the app: the one line, `fxbot`, a provider, and a first chat.
- **New how-to pages:**
  - **Host fxbot on a server:** today's `setup.sh` steps, for an fxbot that's always on and reached from other devices, with **Reach it** (`how-to/reach-it.md`) after them.
  - **Move between the app and a hosted fxbot:** `fxbot backup` on one side, and `fxbot restore` on the other, both ways.
- **Changed:**
  - **The computer's page:** the machine by OS, and Windows' one admin step.
  - **The README:** an Install section that leads with the app, then **Host it** with the container release.
  - **The home page:** its first step, "Install it" (`src/home.tsx:77`), is the app's one line, by OS. The container release's `curl` line moves under **Host it**, for an fxbot that's always on.
  - **"What setup.sh creates"** stays, under the hosting pages.
  - **`CHANGELOG.md`:** under `## Unreleased`.

### Cost

**For the owner:**

| | Container release | The app |
| --- | --- | --- |
| Before installing | podman or docker, and root | nothing |
| Download | three images (fxbot's alone is 340 MB unpacked), plus the model | 110–150 MB, plus the 310 MB model |
| Idle memory | about the same | Postgres 38 MB and fxbot 146 MB, measured here, plus `llama-server` |
| The computer | root once | a Mac: a VM of 4 GiB at most, plus about 0.4 GB of Debian. Windows: one admin step if WSL is off. Linux: root once. |

**For each release:** six more runners, about 10 minutes each, and 0.7–0.9 GB more on the release.

**For the page:** nothing. It's the same page, from the same server.

### Not in this phase

- **One executable file:** Bun's compile or Node's SEA, for the reasons in the research. Revisit if Node's VFS leaves early development and fxbot's own code ever needs hiding, which it doesn't.
- **PGlite,** for the reasons in the research.
- **A GPU embedder in the app** on Linux and Windows (Vulkan or CUDA). Apple silicon's Metal is in, by default.
- **A VM without root on Linux** (libkrun on `/dev/kvm`).
- **Ubuntu 22.04 and older glibc:** these would need a Postgres build of fxbot's own on an older base.
- **FreeBSD and other Unixes:** there are no libfx or Postgres builds for them.
- **Postgres 18.**
- **A headless app.** Hosting is the container release's.
- **The operations phase's Mac page,** which puts all of fxbot in a Lima VM. The app replaces it once it ships, and until then it stays the Mac route.

### What changes

| Where | Change |
| --- | --- |
| `deploy/app/fxbot.ts`, `deploy/app/fxbot`, `deploy/app/fxbot.cmd` | New: the launcher and its two starters |
| `deploy/app/install.sh`, `deploy/app/install.ps1` | New: the one-line installs, served by the site |
| `.github/workflows/release.yml` | A build job for six targets, and the archives and `SHA256SUMS` on the release |
| `packages/server/src/index.ts` | Stop on an IPC message |
| `packages/sdk/src/sessions.ts` | `SystemRoot` for the bootstrap on Windows |
| `packages/sdk/src/plugin-api.ts`, `packages/server/src/control.ts` | `MachineJob.socket` |
| `plugins/computer/fxbot/server.ts` | Reads the machine's socket |
| `packages/website/…` | Two new pages, and changes to three |
| `README.md`, `CHANGELOG.md` | The app as a second way to install |
| `deploy/desktop/` | Later: the Electron shell |

**Size:**

| Part | Lines |
| --- | --- |
| The launcher (start, stop, control requests, update with a way back, backup, restore, autostart, uninstall) | about 300 |
| The two install scripts | about 60 |
| The computer: a Mac, Windows, and Linux | about 150 |
| The server, the SDK, and the plugin | about 10 |
| The workflow | about 120 |
| Docs | about 250 |
| Electron, later | about 200 |

## 4. Checklist

Each milestone ships on its own. Check on this machine where it can be, and on a Mac and Windows where it can't.

**M1. The download runs**
- [ ] `deploy/app/fxbot.ts` runs the first start, and starts and stops Postgres, `llama-server`, and the server, as above. `fxbot`, `stop`, `status`, and `logs` work.
- [ ] The server stops on the IPC message, and `sessions.ts` passes `SystemRoot`.
- [ ] The release workflow builds the six archives, each started once on its own runner, with `/api/health` and `create extension vector` passing.
- [ ] On this machine, from the `linux-x64` archive, with `FXBOT_HOME` in a scratch folder and `FXBOT_PORT` off 8787:
  - the first start makes the key, the password, and `db/`
  - fxbot answers, and a bot replies with the mock model
  - a memory is found by meaning once `llama-server` has its model
  - `fxbot stop` leaves no process behind
- [ ] Kill the server's process, and it starts again. Kill everything, and the next `fxbot` starts Postgres over its `postmaster.pid`.
- [ ] `bash -n deploy/app/fxbot`, `sh -n deploy/app/install.sh`, `npm run typecheck`, and `git diff --check` pass, and the new files have no trailing whitespace.

**M2. It keeps running, and updates**
- [ ] `fxbot autostart on|off`, with a systemd user unit and a LaunchAgent.
- [ ] `install.sh` and `install.ps1` from a local file server: the right archive, a bad checksum refused, and `fxbot` on the PATH.
- [ ] Settings' **Update** goes to a newer test release: download, checksum, a new folder, and a start. A test release that fails to start comes back to the old one, and its database is restored from the backup when it migrated. Use a local `FXBOT_RELEASES_URL` and file server for both.
- [ ] `fxbot backup` and `restore`. A backup from the container release restores into the app, and one from the app into the container release.
- [ ] `fxbot uninstall` keeps the data folder, and `--purge` removes it.

**M3. The computer everywhere**
- [ ] `MachineJob.socket`, passed on by `control.ts`, and read by the computer plugin. An older fxbot still finds its socket.
- [ ] Linux: with `pkexec` and with `sudo`. Bob's computer runs a command and opens Chromium, and `curl` from it to the host's address and to a LAN address fails.
- [ ] A Mac: the Lima VM, the socket, the same three checks, and the VM stopping after 30 idle minutes.
- [ ] Windows: the WSL step, the distro, the setup, `win-sshproxy`'s pipe, and the same three checks.

**M4. Docs**
- [ ] The tutorial from the app, the two new pages, the changed ones (the home page leads with the app, and the container release's line is under **Host it**), `npm run build-site`, and `CHANGELOG.md`.

**Human checks**
- [ ] A Mac on Apple silicon and an Intel Mac: unpack, `fxbot`, a chat, a memory search, the computer, an update, and `uninstall --purge`.
- [ ] Windows 11 Home and Windows 11 on Arm: the same, with libfx on WebAssembly, and WSL off at the start.
- [ ] Ubuntu 24.04 and Fedora desktops: the same, with `pkexec` for the computer.

**M5. Electron (a later release)**
- [ ] The shell in `deploy/desktop/`: the window, the tray, start at login, and an MCP sign-in in the system browser.
- [ ] electron-builder's installers for the three OSes, electron-updater from one test release to the next, and Settings' **Update** through the shell.
- [ ] Signed and notarized on a Mac, signed on Windows, and the computer's VM starting from the signed app. Signing waits for this milestone, by the owner's decision.
- [ ] The site and the README lead with the desktop app in place of the one-line install.

## 5. Open questions

Decided by the owner on 2026-11-08 (see What the owner asked): the app is the main install, the container release is for hosting, and signing waits for Electron.

1. **Postgres 17 or 18 in the app?** The default is 17, the container release's, so a backup restores in either direction, and an owner can move between them both ways. 18 is the newest, and what pglite and embedded-postgres carry. Moving both to 18 later means `pg_upgrade`, or a dump and a restore, as its own change.
2. **Node 24 or 26?** The default is Node 24.22, Electron 45's own: JSPI is on, and it's supported to April 2028. Node 26 is the current LTS and refuses the old JSPI flag, which fxbot never passes. Either works.
3. **Lima on a Mac, or vfkit?** The default is Lima: socket forwarding, cloud images, and Intel support, ready-made, for 38–50 MB. vfkit is one program, but fxbot would build its own disk image and vsock relay.
4. **`win-sshproxy` on Windows, or a relay of fxbot's own?** The default is `win-sshproxy`, podman's own, proven way. A small relay over `wsl.exe` would need no SSH, and is untried.
5. **Should the app ask before downloading the 310 MB model on the first start?** The default is no: it downloads in the background, as the compose file does now, and Settings shows memory search as waiting. An owner who wants it off turns it off in Settings.
6. **The secret key in the app:** a file with mode 0600 in the data folder, as today, or the OS's keychain once Electron's `safeStorage` is there? The default is the file, with the keychain as a question for M5.
