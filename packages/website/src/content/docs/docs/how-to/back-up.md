---
title: "Back up fxbot"
description: "fxbot backs itself up before a release's migrations run, into /var/lib/fxbot/backups, and keeps the last five. To keep a copy of your own, off the machine, back up with sudo fxbot backup, and keep the key apart."
---

fxbot backs itself up before a release's migrations run, into `/var/lib/fxbot/backups`, and keeps the last five. To keep a copy of your own, off the machine, back up three things: the database, which holds the chats, the data folder, and the key.

These steps are for an install made by `setup.sh`. Keep the backup in a folder only you can read, since the database holds every chat.

## Back up

```sh
sudo fxbot backup ~/fxbot-backup
```

It stops the app, so the database and the data folder match, writes the database as `database.dump`, in pg_dump's custom format, and the data folder as `data.tar.gz` into the folder, and starts the app again. The folder is yours, as the user who ran `sudo`, and only you can read it. These are the names fxbot gives its own backups, so `fxbot restore` takes the folder as it is.

With no folder, it writes into `/var/lib/fxbot/backups/<date>-by-hand`. fxbot keeps only the five newest folders there, so copy one you want to keep somewhere else.

Then copy the key, and store it apart from the backup:

```sh
sudo install -m 400 -o "$USER" /etc/fxbot/secret.key ~/fxbot-secret.key
```

The database holds keys and tokens sealed with it, so they can't be opened without it. Anyone with both can open them.

## Restore

On a new machine, first install the same release with `setup.sh`, then put the key back:

```sh
sudo install -o fxbot -g fxbot -m 400 fxbot-secret.key /etc/fxbot/secret.key
```

Then restore the database and the data folder from the backup's folder, and start fxbot on them:

```sh
sudo fxbot restore ~/fxbot-backup
sudo fxbot up
```

`fxbot restore` stops the app, makes the database again from `database.dump`, and unpacks `data.tar.gz` into `/var/lib/fxbot/data`.

## Move to a new machine

1. **On the old machine,** back up, and take the key and the app's settings along with it:

   ```sh
   sudo fxbot backup ~/fxbot-move
   sudo install -m 400 -o "$USER" /etc/fxbot/secret.key /etc/fxbot/fxbot.env ~/fxbot-move/
   ```

   If you wrote `/opt/fxbot/compose.override.yaml`, such as for web pairing's ports, take it too.
2. **Stop the old one,** with `sudo fxbot down`, or [uninstall it](/docs/how-to/uninstall/). Devices paired at web.fxbot.sh find fxbot by its keys, which move with the backup, so two fxbots running on the same keys take them from each other.
3. **On the new machine,** install the same release with `setup.sh`. Give it the port the old one had, if you changed it, such as `curl -fsSL https://fxbot.sh/setup.sh | sudo FXBOT_PORT=8780 bash`.
4. **Put the key and the settings in place, then restore:**

   ```sh
   sudo install -o fxbot -g fxbot -m 400 ~/fxbot-move/secret.key /etc/fxbot/secret.key
   sudo cp ~/fxbot-move/fxbot.env /etc/fxbot/fxbot.env
   sudo fxbot restore ~/fxbot-move
   sudo fxbot up
   ```

   Put `compose.override.yaml` back in `/opt/fxbot`, if you had one, before `fxbot up`. If the old machine ran the local embedder on a GPU, run `sudo fxbot embedder gpu` too.

Bots, chats, the library, providers, and plugins come back as they were, and so do the devices paired at web.fxbot.sh, with nothing done on them. A tailnet gives the new machine a name of its own, so reach it there, or move the old name in Tailscale's admin console.
