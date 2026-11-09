---
title: "Uninstall fxbot"
description: "One command takes fxbot off a machine that setup.sh installed it on. It keeps a backup and the key, so you can install again later, unless you tell it --purge."
---

One command takes fxbot off a machine that `setup.sh` installed it on. It keeps a backup and the key, so you can install again later, unless you tell it `--purge`.

## Uninstall

```sh
sudo fxbot uninstall
```

It says what it removes and what it keeps, then asks once, `[y/N]`. Anything but **y** changes nothing. It removes:
- fxbot's containers, its database and model volumes, and its images, at every version it pulled
- the computer, when it's set up: the user `fxbot-computer`, every computer and its home, its firewall, and its units
- `fxbot.service`, `fxbot-control.path` and `fxbot-control.service`, the `fxbot` command, and `/opt/fxbot`
- the rules it added to ufw, marked `fxbot`

It keeps:
- **a backup** it takes first, of the database and the plugins' files, in `/var/lib/fxbot/backups/<date>-uninstall`
- **the key**, `/etc/fxbot/secret.key`, which opens the keys and tokens the backup holds
- **the user `fxbot`**, which owns them
- **podman or Docker**, and their other containers, volumes, and images: it touches only fxbot's own, by name

Last, it says what's left: the packages `setup.sh` installed, with the command that removes them if nothing else uses them, and Docker's repository when `setup.sh` added it. It also names images from older releases' databases and embedders, which another project may use, and `sudo tailscale serve reset` when Tailscale still serves fxbot's port.

## Remove everything

```sh
sudo fxbot uninstall --purge
```

The same, with no backup, and it also removes `/var/lib/fxbot`, every backup in it, `/etc/fxbot`, the key and the app's settings, and the user `fxbot`. What fxbot stored can't be opened again after this.

## Without a question

With no terminal, as when an agent or a script runs it, it stops and asks for `--yes`:

```sh
sudo fxbot uninstall --yes
```

## Install again on the backup

```sh
curl -fsSL https://fxbot.sh/setup.sh | sudo bash
sudo fxbot restore /var/lib/fxbot/backups/<date>-uninstall
sudo fxbot up
```

`setup.sh` uses the key it finds in `/etc/fxbot`, so the restored keys and tokens open. The last lines of the uninstall name the backup's folder.

## On your devices

The installed app goes from a phone's home screen, or a computer's apps, like any other. Keys you made for fxbot at a provider stay good until you revoke them there.

A device paired at web.fxbot.sh reaches fxbot again after an install on the backup, since its keys come back with it. After `--purge`, open web.fxbot.sh on each device and choose **Forget on this device** under its devices. A passkey you made for fxbot stays in the device's passwords until you delete it there.

## By hand

When the `fxbot` command is gone, or you'd rather do each step yourself. First take a backup, as [Back up fxbot](/docs/how-to/back-up/) says, if you want to keep anything. With docker, use `docker` where these say `podman`.

```sh
sudo bash /opt/fxbot/computer-setup.sh --remove       # when the computer is set up
sudo systemctl disable --now fxbot fxbot-control.path
cd /opt/fxbot && sudo podman compose down --volumes --rmi all
sudo rm /etc/systemd/system/fxbot.service /etc/systemd/system/fxbot-control.path /etc/systemd/system/fxbot-control.service
sudo systemctl daemon-reload
sudo rm -rf /opt/fxbot /usr/local/bin/fxbot
```

To remove everything, then also:

```sh
sudo rm -rf /var/lib/fxbot /etc/fxbot
sudo userdel fxbot
```

`/etc/fxbot/packages` lists the packages and files `setup.sh` installed, one a line, after the name of the package manager.
