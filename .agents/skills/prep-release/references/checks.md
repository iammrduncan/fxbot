# Release checks

There's no test suite or CI before a release. The release workflow typechecks, builds, checks migrations, and builds the image, but only after `main` moves. That's too late to catch a problem quietly. These checks run the same things and more, beforehand, on committed work only.

Record each one as **passed**, **failed** (with the output that shows it), or **not run** (with the reason). Run them in this order: a later check needs what an earlier one built.

## Set up

```sh
V=<version>; P=<previous tag>                   # such as 0.8.0 and v0.7.0
T=<a new empty folder>                          # the session's scratchpad if it has one, else mktemp -d
R=$(git rev-parse --show-toplevel)
git clone -q --branch "release/$V" "$R" "$T/new"     # the branch as committed: nothing uncommitted comes along
git clone -q --branch "$P" "$R" "$T/old"             # the last release
```

Pick ports nothing listens on (`ss -ltn`), and keep them in variables: one for a database, and one each for the old and new servers. Use podman if the machine has it, else docker, and keep it rootless.

**Never run a check's server from the main tree.** `npm run server` reads the `.env` there, which points at the owner's own database. Run it from `$T/new` or `$T/old`, which have no `.env`, and pass every variable in the environment.

## 1. It builds, from a clean clone

In `$T/new`:

```sh
npm ci && npm run typecheck && npm run build && npm run build-site
bash -n setup.sh deploy/fxbot
git diff --check "$P"..HEAD                 # whitespace in everything since the last release, new files included
```

`npm ci` proves the lockfile matches. `typecheck` includes `scripts/check-plugins.mjs`, which checks each plugin's `minFxbot` against this release, and `plugin-breaks.json`. `build-site` needs Node 22.22 or newer, and checks every link on the site.

## 2. Generated files are current

In `$T/new`, after step 1:

- `node scripts/blob-data.mjs`, then `git status --porcelain` shows nothing.
- For each plugin with a `fxbot/page.jsx`, run `npm ci` in its folder if it has a `package-lock.json`. Then run the rolldown command from its README. `git status --porcelain` should show nothing. If it shows a change, compare `git diff --stat`: a `page.js` thousands of lines shorter means the build missed the plugin's packages.

## 3. Shipped migrations didn't change

```sh
git diff --name-status "$P"..HEAD -- packages/sdk/src/migrations/ ':(glob)plugins/*/fxbot/migrations/**' | grep -v '^A' || echo none
```

Anything listed is a blocker.

## 4. The database: a fresh install, and an update from the last release

This one matters most. An owner's update runs this release's migrations on the database the last release left.

1. **Start a database.** Use a disposable Postgres with pgvector, the image `deploy/compose.yaml` names, with its data on a tmpfs:

   ```sh
   podman run -d --name fxbot-prep-db -p 127.0.0.1:$DBPORT:5432 --tmpfs /var/lib/postgresql/data \
     -e POSTGRES_USER=fxbot -e POSTGRES_PASSWORD=prep -e POSTGRES_DB=fxbot <pgvector image from deploy/compose.yaml>
   openssl rand -base64 32 > "$T/key" && chmod 400 "$T/key"
   ```

   Every server below gets:

   ```sh
   FXBOT_DATABASE_URL=postgres://fxbot:prep@127.0.0.1:$DBPORT/fxbot FXBOT_SECRET_KEY_FILE=$T/key \
   FXBOT_DATA=$T/<old|new>-data FXBOT_BACKUPS=$T/backups FXBOT_PORT=<its port> FXBOT_UPDATE_CHECK=off
   ```

   Make the data and backup folders first.
2. **Run the last release.** In `$T/old`, run `npm ci && npm run build`. Start the server in the background, and save the PID of `node` itself, not of a shell around it: `cd "$T/old"; <variables> nohup node packages/server/src/index.ts > old.log 2>&1 & echo $! > old.pid`. In `( cd X && nohup node … & )`, `$!` is the subshell's, and a stop by it misses the server. Refuse to start on a port something already holds. Wait for the API to answer.

   Give it the plugins whose tables this release's plugin migrations change, from `$T/old/plugins/`, each copied into a folder of its own under `$T/live/<name>` that stays the same in step 5. fxbot knows a local plugin by its folder, so the old and new copies in two folders look like two plugins, and no plugin migration runs.
3. **Seed what this release's migrations touch,** through the HTTP API in `packages/website/src/content/docs/sdk/reference/http-api.md`. Use what that release has: settings, a provider pointed at an address that isn't real, a few bots, and anything else the new migrations alter, such as a pinned bot or a room. Note what you created.
4. **Stop the old server** by its PID, and make sure it exited.
5. **Start this release** from `$T/new` on the same database, after replacing each folder under `$T/live/` with the plugin's files from `$T/new/plugins/`, as an update would. Save its PID. Then check:
   - The server's log shows the backup, then each new migration, core and plugin. It shows no errors.
   - `podman exec fxbot-prep-db psql -U fxbot -d fxbot -c 'select id from fxbot_migrations order by id'` lists them all.
   - Everything you seeded comes back from the API, with sensible values in the new fields.
   - What **Before upgrading** promises is true. For example, an install with a bot doesn't get first-run setup.
6. **Run a fresh install:** a second database, or the same one dropped and created again, with this release's server alone. It migrates from nothing, and the page loads.

## 5. fxbot's own plugins, on this release and on the last one

Changed plugins reach owners still on the last release as soon as `main` moves. So run them on both releases.

- **Leave out `computer` when the server runs as root.** With no engine set, `computer` runs its own engine-setup script, which changes the machine. Report them as not run, with that reason.
- On the new server, set `FXBOT_PLUGIN_DIRS` to the rest of `$T/new/plugins/*`, joined with `:`, on a fresh database. Run `npm ci` first in each one that has a lockfile and imports a package in its `server.ts`.
  - Every plugin starts, with no **Unsupported**.
  - Each plugin's tab in Settings loads without a page error.
- On the old server, with the same folders:
  - Each plugin whose `minFxbot` is at or below `$P` starts there too.
  - Each one above it shows that it needs a newer fxbot, and doesn't crash anything.

  This catches a plugin that uses something new in this release while saying it runs on the last.

## 6. The features, in a browser

If Playwright and Chromium are on the machine (`npx playwright --version`), drive the new server's page headless. Otherwise check the API with `curl`, and list the browser checks as not run.

- **A model.** Give the server a provider pointed at a small OpenAI-compatible stub that you write. It answers with a fixed reply, or a fixed tool call when a check needs one. Never use the owner's providers or keys.
- **Each feature in this release:** walk its phase doc's checklist that can run without a person. Check light and dark, a desktop width and a phone width (390 px), and WebKit as well if Playwright has it.
- **Save screenshots** of each headline feature in the temp folder, and look at them. A check that only counts elements misses a broken layout.
- **List what needs a person:** real models, a real iPhone or Android phone, real accounts, and a real install's update button.

## 7. The image, and the release compose file

- **The image:** in `$T/new`, run `podman build -t localhost/fxbot-prep:$V .`. This builds only the machine's own architecture. The workflow builds amd64 and arm64.
- **The compose file,** if there's time and an engine with compose:
  - Read `deploy/compose.yaml`'s header for what it needs.
  - Make a root under `$T/root`, with `etc/fxbot/fxbot.env`, a secret key, and `var/lib/fxbot/{data,backups,control}`.
  - Run it with `COMPOSE_PROJECT_NAME=fxbot-prep FXBOT_ROOT=$T/root FXBOT_PORT=<free> FXBOT_IMAGE=localhost/fxbot-prep FXBOT_VERSION=$V`, plus the UID, GID, and database password it asks for, with the embedder off.
  - The page and `/api/profiles` should answer on that port.
  - Then run `down -v`.

  These names stay clear of a real install on the same machine (`fxbot`, `/etc/fxbot`, port 8787). Never use them.

## 8. Clean up

- Stop each server by its saved PID, and each container by its `fxbot-prep-*` name.
- Remove the `localhost/fxbot-prep` image and the temp folders.
- Check that the ports are free again.
- Leave alone anything you didn't start, above all the owner's `npm run dev`.

## Results

Report a table in the hand-off:

| Check | Result | Detail |
| --- | --- | --- |
| Builds from a clean clone | passed | typecheck, build, site (N pages, N links) |
| Update from `<P>` | failed | `0014_x` fails on a bot with no provider: `<error line>` |
| Image | not run | no container engine |
