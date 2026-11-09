#!/usr/bin/env bash
# Installs fxbot as containers, from a release tag: the newest, or the one named. It runs on Debian, Ubuntu, Fedora,
# RHEL and its rebuilds, openSUSE, Arch, and the distros built on them, through apt, dnf, zypper, or pacman.
#
#   curl -fsSL https://fxbot.sh/setup.sh | sudo bash
#   curl -fsSL https://fxbot.sh/setup.sh | sudo bash -s -- v0.3.0
#   curl -fsSL https://fxbot.sh/setup.sh | sudo FXBOT_PORT=8780 bash
#
# It checks the machine before it changes anything. Then it takes the engine that's here: a Docker that's running, a
# podman 4 or newer, or a Docker that's installed. With none, podman from the distribution when it's 4.9 or newer, or
# else Docker's own docker-ce, which also runs rootless for the computer, as Ubuntu's docker.io can't. Then a Compose
# new enough, the fxbot user with its key, /opt/fxbot (the release's compose.yaml, an .env, and the fxbot command), and
# the systemd units. Each package it installs is listed in /etc/fxbot/packages, which uninstall names. An install of
# 0.2, which ran on the machine's own Postgres, moves into the database container. Running it again finishes an
# install that stopped, and leaves a working one alone. FXBOT_ENGINE (podman or docker) and FXBOT_PORT are for a new
# install; FXBOT_FILES, FXBOT_IMAGE, FXBOT_RELEASES_URL, FXBOT_COMPOSE_FILES, and FXBOT_DOCKER_FILES point it at a
# mirror.

# fxbot runs on Linux. This comes first, and in what any bash has: bash runs each command as it reads it, so a Mac's
# bash 3.2 reads only this, and stops.
case $(uname -s) in
  Linux) ;;
  Darwin) printf '\nfxbot setup stopped: fxbot runs on Linux, and this is macOS. Run this on a Linux machine, or in a Linux VM on this Mac.\n' >&2 && exit 1 ;;
  MINGW* | MSYS* | CYGWIN*) printf "\nfxbot setup stopped: fxbot runs on Linux. On Windows, run this in WSL 2's Ubuntu, with systemd on.\n" >&2 && exit 1 ;;
  *) printf '\nfxbot setup stopped: fxbot runs on Linux, and this is %s.\n' "$(uname -s)" >&2 && exit 1 ;;
esac

set -euo pipefail
files=${FXBOT_FILES:-https://raw.githubusercontent.com/iammrduncan/fxbot}
releases=${FXBOT_RELEASES_URL:-https://api.github.com/repos/iammrduncan/fxbot/releases/latest}
docker_files=${FXBOT_DOCKER_FILES:-https://download.docker.com}
# The SHA-256 of Docker's signing key, one file for its Debian and Ubuntu repositories.
docker_key=1500c1f56fa9e26b9b8f42452a553675796ade0807cdce11975eb98170b3a570
install=/opt/fxbot
etc=/etc/fxbot
var=/var/lib/fxbot
fix=https://fxbot.sh/docs/how-to/fix-an-install

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
die() {
  printf '\nfxbot setup stopped: %s\n' "$*" >&2
  exit 1
}
at_least() { [ "$(printf '%s\n%s\n' "$1" "$2" | sort -V | head -n 1)" = "$1" ]; }

# The package manager's own: whether a package is installed, the version it offers, and installing what's missing.
there() {
  case $pm in
    apt) [ "$(dpkg-query -W -f='${Status}' "$1" 2>/dev/null)" = "install ok installed" ] ;;
    pacman) pacman -Q "$1" >/dev/null 2>&1 ;;
    *) rpm -q "$1" >/dev/null 2>&1 ;;
  esac
}
version() { sed -n 's/^Version *: *\([0-9]*:\)\{0,1\}\([0-9][0-9.]*\).*/\2/p' | head -n 1; }
offered() {
  case $pm in
    apt) apt-cache policy "$1" 2>/dev/null | sed -n 's/^ *Candidate: \([0-9]*:\)\{0,1\}\([0-9][0-9.]*\).*/\2/p' || true ;;
    dnf) dnf repoquery -q --latest-limit 1 --qf '%{version}\n' "$1" 2>/dev/null | grep -m 1 . || true ;;
    zypper) zypper --non-interactive info "$1" 2>/dev/null | version || true ;;
    pacman) pacman -Si "$1" 2>/dev/null | version || true ;;
  esac
}
# What's installed for fxbot, for uninstall to name: the package manager on the first line, then a package or a file on
# each one.
record() {
  install -d -m 755 "$etc"
  [ -s "$etc/packages" ] || echo "$pm" >"$etc/packages"
  local line
  for line in "$@"; do grep -qxF "$line" "$etc/packages" || echo "$line" >>"$etc/packages"; done
}
# apt alone removes a package to install another without asking, so its plan is read first.
install_packages() {
  local want=() p removes
  for p in "$@"; do there "$p" || want+=("$p"); done
  [ ${#want[@]} -gt 0 ] || return 0
  case $pm in
    apt)
      removes=$(apt-get install -s --no-install-recommends "${want[@]}" 2>/dev/null | sed -n 's/^Remv \([^ ]*\).*/\1/p' | paste -sd' ' -) || true
      [ -z "$removes" ] || die "installing ${want[*]} would remove $removes, so nothing was installed."
      apt-get install -y -qq --no-install-recommends "${want[@]}" >/dev/null ;;
    dnf) dnf install -y -q --setopt=install_weak_deps=False "${want[@]}" >/dev/null ;;
    zypper) zypper --non-interactive --quiet install --no-recommends "${want[@]}" >/dev/null ;;
    pacman) pacman -S --needed --noconfirm "${want[@]}" >/dev/null ||
      die "pacman couldn't install ${want[*]}. If its package lists are old, update the system first (sudo pacman -Syu), then run this again: $fix/#old-package-lists-on-arch" ;;
  esac || die "$pm couldn't install ${want[*]}"
  for p in "${want[@]}"; do if there "$p"; then record "$p"; fi; done
}

# Each stop it can see coming, before anything changes.
checks() {
  [ "$(id -u)" -eq 0 ] || die "run it as root, such as with: curl -fsSL https://fxbot.sh/setup.sh | sudo bash"
  case "$want" in "" | v[0-9]*.[0-9]*.[0-9]*) ;; *) die "name a release such as v0.3.0, not $want" ;; esac
  pm=""
  for p in apt-get zypper dnf pacman; do if command -v "$p" >/dev/null; then pm=${p%-get} && break; fi; done
  [ -n "$pm" ] || die "setup.sh installs through apt, dnf, zypper, or pacman: on Debian, Ubuntu, Fedora, RHEL and its rebuilds, openSUSE, Arch, and the distros built on them. This is ${PRETTY_NAME:-an unknown Linux}. See: https://fxbot.sh/docs/reference/commands/"
  if [ -e /run/ostree-booted ] || command -v transactional-update >/dev/null; then
    die "this system installs software as a whole image (Fedora Silverblue or CoreOS, openSUSE MicroOS), so setup.sh can't add packages to it."
  fi
  if [ ! -d /run/systemd/system ]; then
    grep -qi microsoft /proc/version 2>/dev/null &&
      die "fxbot needs systemd, to start at boot and to update from Settings. In WSL, add [boot] systemd=true to /etc/wsl.conf, run wsl --shutdown in Windows, then run this again."
    die "fxbot needs systemd, to start at boot and to update from Settings, and this machine runs without it."
  fi
  case $(uname -m) in x86_64 | aarch64) ;; *) die "fxbot's images are for x86_64 and arm64, and this machine is $(uname -m)." ;; esac
  # An install keeps its port, and installs before 0.8.0 have none written: theirs is 8787.
  if [ -f "$install/.env" ]; then port=$(sed -n 's/^FXBOT_PORT=//p' "$install/.env"); else port=${FXBOT_PORT:-}; fi
  port=${port:-8787}
  [[ $port =~ ^[0-9]{1,5}$ ]] && [ "$port" -ge 1 ] && [ "$port" -le 65535 ] || die "FXBOT_PORT must be a port, such as 8780, not $port"
  if ! systemctl is-active --quiet fxbot && (exec 3<>"/dev/tcp/127.0.0.1/$port") 2>/dev/null; then
    die "another program listens on port $port. Run this again with FXBOT_PORT set to a free one, such as: curl -fsSL https://fxbot.sh/setup.sh | sudo FXBOT_PORT=$([ "$port" != 8780 ] && echo 8780 || echo 8781) bash"
  fi
  local had
  had=$(sed -n 's/^FXBOT_ENGINE=//p' "$install/.env" 2>/dev/null) || true
  if [ "${had:-${FXBOT_ENGINE:-}}" != podman ] && command -v docker >/dev/null && [[ $(readlink -f "$(command -v docker)") == /snap/* ]]; then
    die "Docker here is a snap, which can't reach fxbot's folders. Remove it (sudo snap remove docker) and run this again, or run it with FXBOT_ENGINE=podman: $fix/#docker-from-snap"
  fi
  if [ ! -f "$install/.env" ]; then
    local free
    # In what every system has: a minimal openSUSE has no awk.
    free=$(df -Pk /var/lib | sed -n '2s/^[^ ]* *[0-9]* *[0-9]* *\([0-9]*\).*/\1/p')
    [ "${free:-0}" -ge $((3 * 1024 * 1024)) ] || die "fxbot's images need 3 GB free in /var/lib, and it has $((${free:-0} / 1048576)).$((${free:-0} % 1048576 * 10 / 1048576)) GB."
  fi
  local memory
  memory=$(sed -n 's/^MemAvailable: *\([0-9]*\).*/\1/p' /proc/meminfo)
  [ "${memory:-0}" -ge $((1024 * 1024)) ] ||
    echo "This machine has $((${memory:-0} / 1024)) MB of memory free. fxbot, its database, and its embedder hold about 500 MB, and each computer about 120 MB more."
  [ "$pm" != pacman ] || ls /var/lib/pacman/sync/*.db >/dev/null 2>&1 ||
    die "pacman has no package lists. Update the system first (sudo pacman -Syu), then run this again: $fix/#old-package-lists-on-arch"
}

# Docker's own repository for docker-ce, as Docker's docs add it, unless the machine has it already.
docker_repo() {
  local distro codename sources=/etc/apt/sources.list.d/docker.sources key=/etc/apt/keyrings/docker.asc
  if [ -n "${UBUNTU_CODENAME:-}" ]; then distro=ubuntu codename=$UBUNTU_CODENAME; else distro=debian codename=${VERSION_CODENAME:-}; fi
  [ -n "$codename" ] || return 1
  say "Docker's own docker-ce"
  if ! grep -rqs "download.docker.com\|$docker_files" /etc/apt/sources.list /etc/apt/sources.list.d; then
    install -d -m 755 /etc/apt/keyrings
    curl -fsSL "$docker_files/linux/$distro/gpg" -o "$key.new" || die "couldn't download Docker's signing key from $docker_files"
    if ! printf '%s  %s\n' "$docker_key" "$key.new" | sha256sum -c --status; then
      rm -f "$key.new"
      die "Docker's signing key from $docker_files isn't the one it should be, so nothing was installed."
    fi
    mv "$key.new" "$key" && chmod a+r "$key"
    printf 'Types: deb\nURIs: %s\nSuites: %s\nComponents: stable\nArchitectures: %s\nSigned-By: %s\n' \
      "$docker_files/linux/$distro" "$codename" "$(dpkg --print-architecture)" "$key" >"$sources"
    record "$sources" "$key"
    apt-get update -qq || die "Docker's repository has nothing for $distro $codename. Install podman or Docker, then run this again."
  fi
  # Ubuntu's docker-compose-v2 holds the same file as Docker's plugin, and does the same.
  local plugin=docker-compose-plugin
  if there docker-compose-v2; then plugin=""; fi
  install_packages docker-ce docker-ce-cli containerd.io $plugin
  # A Docker removed just before, as Ubuntu's docker.io, can leave its daemons running from the old files.
  systemctl stop docker docker.socket >/dev/null 2>&1 || true
  systemctl restart containerd >/dev/null 2>&1 || true
  systemctl start docker.socket docker >/dev/null 2>&1 || true
}

# An install keeps its engine. Otherwise the owner's, then a Docker that's running, then a podman 4 or newer that's
# installed: before 4, podman has no netavark, and Compose can't find the images it pulls. Then a Docker that's
# installed, then the distribution's podman when it's 4.9 or newer, so the computer can run rootless on it too, then
# Docker's own docker-ce.
choose_engine() {
  engine=$(sed -n 's/^FXBOT_ENGINE=//p' "$install/.env" 2>/dev/null) || true
  [ -z "$engine" ] || return 0
  engine=${FXBOT_ENGINE:-}
  case $engine in "" | podman | docker) ;; *) die "FXBOT_ENGINE must be podman or docker, not $engine" ;; esac
  [ -z "$engine" ] || return 0
  local podman docker=""
  podman=$(podman --version 2>/dev/null | sed -n 's/.* \([0-9][0-9.]*\).*/\1/p') || true
  # podman-docker's docker is podman.
  if command -v docker >/dev/null && ! docker --version 2>/dev/null | grep -qi podman; then docker=1; fi
  if [ -n "$docker" ] && docker info >/dev/null 2>&1; then engine=docker
  elif [ -n "$podman" ] && at_least 4 "$podman"; then engine=podman
  elif [ -n "$docker" ]; then engine=docker
  elif at_least 4.9 "$(offered podman)"; then engine=podman
  elif [ "$pm" = apt ] && docker_repo; then engine=docker
  else die "this system's packages have no podman 4.9 or newer, and Docker publishes no docker-ce for it. Install podman or Docker, then run this again."
  fi
}

# Compose $compose_min or newer. `podman compose` and `docker compose` may not run one: Ubuntu's docker-compose package is
# v1, which podman prefers to a newer plugin beside it, podman before 4.7 has no compose command, and podman-compose
# can't wait for health. So when they can't, fxbot names a binary itself, in FXBOT_COMPOSE: one that's here already, a
# package when the distro's is new enough, or else Compose's own release, checked against its hash.
compose_min=2.26
compose_release=2.40.3
compose_files=${FXBOT_COMPOSE_FILES:-https://github.com/docker/compose/releases/download}
enough() { at_least "$compose_min" "$1"; }
version_of() { PODMAN_COMPOSE_WARNING_LOGS=false "$@" version --short 2>/dev/null | tail -n 1 | sed -n 's/^v\{0,1\}\([0-9][0-9.]*\).*/\1/p'; }
find_compose() {
  enough "$(version_of "$engine" compose)" && return
  local binary
  for binary in "$install/docker-compose" /usr/libexec/docker/cli-plugins/docker-compose /usr/lib/docker/cli-plugins/docker-compose \
    /usr/local/lib/docker/cli-plugins/docker-compose /usr/local/bin/docker-compose /usr/bin/docker-compose; do
    if [ -x "$binary" ] && enough "$(version_of "$binary")"; then
      compose=$binary
      return
    fi
  done
  return 1
}
compose_package() {
  local package
  # Docker's own first, on a machine with its repository: Ubuntu's clashes with it.
  for package in $([ "$pm" = apt ] && echo docker-compose-plugin docker-compose-v2) docker-compose; do
    if enough "$(offered "$package")"; then (install_packages "$package") 2>/dev/null && return; fi
  done
  return 1
}
compose_download() {
  local arch sum
  case $(uname -m) in
    x86_64) arch=x86_64 sum=dba9d98e1ba5bfe11d88c99b9bd32fc4a0624a30fafe68eea34d61a3e42fd372 ;;
    aarch64) arch=aarch64 sum=d26373b19e89160546d15407516cc59f453030d9bc5b43ba7faf16f7b4980137 ;;
  esac
  curl -fsSL "$compose_files/v$compose_release/docker-compose-linux-$arch" -o "$install/docker-compose.new" || die "couldn't download Compose $compose_release from $compose_files"
  printf '%s  %s\n' "$sum" "$install/docker-compose.new" | sha256sum -c --status || die "the Compose $compose_release download isn't the file it should be"
  chmod 755 "$install/docker-compose.new"
  mv "$install/docker-compose.new" "$install/docker-compose"
}

main() {
  want=${1:-}
  [ ! -f /etc/os-release ] || . /etc/os-release
  checks
  cd /
  export DEBIAN_FRONTEND=noninteractive

  say "The container engine"
  [ "$pm" != apt ] || apt-get update -qq
  # RHEL 9's curl is the package curl-minimal, which a package named curl would clash with.
  install_packages ca-certificates
  command -v curl >/dev/null || install_packages curl
  choose_engine
  # Docker, named or kept, and not installed, as after Ubuntu's docker.io is removed: Docker's own, on apt.
  if [ "$engine" = docker ] && ! command -v docker >/dev/null; then
    [ "$pm" = apt ] && docker_repo || die "this machine has no Docker. Install it, then run this again, or run it with FXBOT_ENGINE=podman."
  fi
  if [ "$engine" = podman ]; then
    install_packages podman
    # Containers find each other by name through netavark and aardvark-dns, which podman only recommends. Debian 13's
    # netavark needs nft.
    (install_packages netavark aardvark-dns nftables) || echo "Couldn't install podman's network parts, so fxbot may not reach its database."
    # A podman that has run on CNI, as Debian 12's does out of the box, stays on it, and needs this plugin for names.
    if [ "$pm" = apt ] && [ "$(podman info --format '{{.Host.NetworkBackend}}' 2>/dev/null)" = cni ]; then
      (install_packages golang-github-containernetworking-plugin-dnsname) || echo "Couldn't install CNI's dnsname plugin, so fxbot may not reach its database."
    fi
    # Compose reaches podman through its socket.
    systemctl enable --now podman.socket >/dev/null 2>&1
  else
    systemctl enable --now docker >/dev/null 2>&1 || true
    for _ in $(seq 30); do docker info >/dev/null 2>&1 && break || sleep 1; done
    docker info >/dev/null 2>&1 || die "docker doesn't answer. Start it, then run this again."
  fi
  echo "$engine"

  say "Compose"
  install -d -m 755 "$install"
  compose=""
  find_compose || { compose_package && find_compose; } || { compose_download && find_compose; } ||
    die "Compose $compose_release doesn't run here. See: $install/docker-compose version"
  echo "${compose:-$engine compose} $(version_of ${compose:-$engine compose})"

  say "The fxbot user, its folders, and its key"
  id fxbot >/dev/null 2>&1 || useradd --system --home-dir "$var" --create-home --shell /usr/sbin/nologin fxbot
  install -d -o fxbot -g fxbot -m 700 "$var" "$var/data" "$var/backups"
  install -d -o fxbot -g fxbot -m 755 "$var/control" "$var/control/requests"
  install -d -m 755 "$etc"
  if [ ! -f "$etc/secret.key" ]; then
    (umask 377 && head -c 32 /dev/urandom | base64 >"$etc/secret.key")
    chown fxbot:fxbot "$etc/secret.key"
  fi
  [ -f "$etc/fxbot.env" ] || printf '# Settings for the app, such as FXBOT_LISTS_URL. None is a secret: the key is a file only fxbot reads.\n' >"$etc/fxbot.env"

  # An install that never reached its first start has nothing to keep, so it starts over from the newest release: one
  # that stopped on an older Compose has a fxbot command that can't use another. Its settings stay beside it.
  if [ -f "$install/.env" ] && ! "$engine" volume inspect fxbot_pgdata >/dev/null 2>&1; then
    mv "$install/.env" "$install/.env.stopped"
  fi

  # A 0.2 install ran from /opt/fxbot/current on the machine's Postgres, under its own fxbot.service.
  moving=no
  if [ -L "$install/current" ] && [ ! -f "$install/.env" ]; then moving=yes; fi

  fresh=no
  local password=""
  if [ -f "$install/.env" ]; then
    tag=v$(sed -n 's/^FXBOT_VERSION=//p' "$install/.env")
    say "fxbot ${tag#v} is installed already"
    sed -i '/^FXBOT_COMPOSE=/d' "$install/.env"
    [ -z "$compose" ] || echo "FXBOT_COMPOSE=$compose" >>"$install/.env"
  else
    fresh=yes
    tag=${want:-v$(curl -fsSL "$releases" | sed -n 's/.*"tag_name": *"v\{0,1\}\([^"]*\)".*/\1/p' | head -n 1)}
    [ "$tag" != v ] || die "couldn't find the newest release at $releases"
    say "fxbot ${tag#v}"
    curl -fsSL "$files/$tag/deploy/compose.yaml" -o "$install/compose.yaml" || die "couldn't download $tag's compose.yaml from $files"
    curl -fsSL "$files/$tag/deploy/fxbot" -o "$install/fxbot" || die "couldn't download $tag's fxbot command from $files"
    curl -fsSL "$files/$tag/deploy/compose.gpu.$engine.yaml" -o "$install/compose.gpu.$engine.yaml" || die "couldn't download $tag's GPU file from $files"
    # Releases before 0.5.0 have no such file.
    [ "$engine" != docker ] || curl -fsSL "$files/$tag/deploy/compose.docker.yaml" -o "$install/compose.docker.yaml" || true
    chmod 755 "$install/fxbot"
    password=$(head -c 24 /dev/urandom | base64 | tr -d '/+=')
    (
      umask 077
      cat >"$install/.env.new" <<EOF
# fxbot's install: setup.sh wrote this, and \`fxbot update\` changes the version.
FXBOT_VERSION=${tag#v}
FXBOT_UID=$(id -u fxbot)
FXBOT_GID=$(id -g fxbot)
FXBOT_ENGINE=$engine
FXBOT_EMBEDDER=cpu
FXBOT_PORT=$port
FXBOT_DB_PASSWORD=$password
EOF
      for name in FXBOT_IMAGE FXBOT_FILES FXBOT_RELEASES_URL; do [ -z "${!name:-}" ] || echo "$name=${!name}" >>"$install/.env.new"; done
      [ -z "$compose" ] || echo "FXBOT_COMPOSE=$compose" >>"$install/.env.new"
    )
  fi
  ln -sfn "$install/fxbot" /usr/local/bin/fxbot

  if [ "$moving" = yes ]; then
    say "Moving the 0.2 install into containers"
    systemctl disable --now fxbot >/dev/null 2>&1 || true
    [ ! -f /etc/systemd/system/fxbot.service ] || cp /etc/systemd/system/fxbot.service "$install/fxbot-0.2.service"
    folder="$var/backups/$(date -u +%Y-%m-%dT%H-%M-%SZ)-move-to-containers"
    install -d -o fxbot -g fxbot -m 700 "$folder"
    runuser -u postgres -- pg_dump --format=custom fxbot >"$folder/database.dump" || die "couldn't dump the 0.2 database"
    chown fxbot:fxbot "$folder/database.dump"
    mv "$install/.env.new" "$install/.env"
    (cd "$install" && ./fxbot restore "$folder") || die "the 0.2 database didn't restore into the container. The 0.2 install is untouched: see $install/fxbot-0.2.service"
    # The app's database, key, and folders now come from compose. 0.2's settings are kept, for going back.
    cp -p "$etc/fxbot.env" "$install/fxbot-0.2.env"
    sed -i '/^FXBOT_DATABASE_URL=\|^PGHOST=\|^PGPORT=\|^FXBOT_SECRET_KEY_FILE=\|^FXBOT_DATA=\|^FXBOT_BACKUPS=/d' "$etc/fxbot.env"
  fi
  [ ! -f "$install/.env.new" ] || mv "$install/.env.new" "$install/.env"

  # A database whose .env went, with /opt/fxbot removed by hand: Postgres keeps the password it was made with, so the
  # new one is set over its local socket, which it trusts.
  if [ "$fresh" = yes ] && [ "$moving" = no ] && "$engine" volume inspect fxbot_pgdata >/dev/null 2>&1; then
    say "The database from before"
    "$install/fxbot" compose up -d db >/dev/null 2>&1 || die "the database didn't start. See: sudo fxbot logs db"
    for _ in $(seq 60); do "$install/fxbot" compose exec -T db pg_isready -q -U fxbot </dev/null 2>/dev/null && break || sleep 1; done
    "$install/fxbot" compose exec -T db psql -U fxbot -d postgres -qc "alter role fxbot password '$password'" </dev/null ||
      die "the database from before didn't take the new password. See: sudo fxbot logs db"
    echo "Its bots, chats, and providers stay, opened by the key in $etc."
  fi

  say "The images"
  "$install/fxbot" compose pull --policy missing || die "couldn't download fxbot's images. See the lines above."

  say "The services"
  if [ "$engine" = podman ]; then needs=podman.socket; else needs=docker.service; fi
  cat >/etc/systemd/system/fxbot.service <<EOF
[Unit]
Description=fxbot
Wants=network-online.target
After=network-online.target $needs
Requires=$needs

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=$install/fxbot up
ExecStop=$install/fxbot down
TimeoutStartSec=10min

[Install]
WantedBy=multi-user.target
EOF
  # The app asks for an update by writing a request; this hands it to the fxbot command.
  cat >/etc/systemd/system/fxbot-control.path <<EOF
[Unit]
Description=fxbot's requests

[Path]
DirectoryNotEmpty=$var/control/requests

[Install]
WantedBy=multi-user.target
EOF
  cat >/etc/systemd/system/fxbot-control.service <<EOF
[Unit]
Description=fxbot's requests

[Service]
Type=oneshot
ExecStart=$install/fxbot apply
EOF
  systemctl daemon-reload
  systemctl enable --now fxbot-control.path >/dev/null 2>&1
  systemctl enable fxbot >/dev/null 2>&1
  systemctl start fxbot || die "fxbot did not start. See: sudo fxbot logs"
  answers() { for _ in $(seq 60); do curl -fs "http://127.0.0.1:$port/api/health" >/dev/null && return 0; sleep 1; done; return 1; }
  # A unit still marked running over containers that went, as after /opt/fxbot was removed by hand, starts again.
  answers || { systemctl restart fxbot && answers; } || die "fxbot did not answer. See: sudo fxbot logs"

  # A machine with an NVIDIA GPU runs the local embedder there, if a trial run reaches it.
  if [ "$fresh" = yes ] && command -v nvidia-smi >/dev/null && nvidia-smi -L >/dev/null 2>&1; then
    say "The local embedder, on the GPU"
    fxbot embedder gpu || echo "No GPU answered a trial run, so the local embedder stays on the CPU."
  fi

  say "fxbot ${tag#v} runs on http://127.0.0.1:$port"
  echo "Open it there, or reach it:"
  echo "  from your computer, over SSH:  ssh -N -L $port:127.0.0.1:$port <you>@<this machine>"
  if command -v tailscale >/dev/null; then
    echo "  from your phone, with Tailscale:  sudo tailscale serve --bg $port"
  else
    echo "  from your phone, with Tailscale (https://tailscale.com/download/linux):  sudo tailscale serve --bg $port"
  fi
  echo "Settings shows each new release, with an Update button. To uninstall: sudo fxbot uninstall"
  if [ "$moving" = yes ]; then
    echo
    echo "The 0.2 install moved into containers. Its own files and database are still here, untouched; see: sudo fxbot status"
  fi
}

# Last, so a download cut off midway runs nothing.
main "$@"
