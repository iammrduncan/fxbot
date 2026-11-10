---
name: prep-release
description: Get fxbot's open release branch ready to cut. Reviews everything since the last tag for gaps, risks, and issues (a report, informational only), brings the docs, guides, changelog, and release notes up to date by Diátaxis, and runs the release-level checks from a clean clone (build, site, migrations from the last release, the image, plugins on the old and new fxbot). Use when the owner runs /prep-release, says a version is nearly done, asks what's left before a release, or wants the branch reviewed, documented, and tested before it ships, even without naming the skill.
---

# Prep a release

Get `release/<version>` ready for the owner to cut, in three passes and a hand-off:

1. **Review:** what this release could break, leave out, or get wrong for owners and plugin authors. Report it, and fix nothing.
2. **Docs:** every change is findable on the right kind of page, and the release notes are drafted.
3. **Checks:** the branch builds, upgrades from the last release, and runs, proven from a clean clone.

The owner cuts the release afterwards, from [Cut a release](../../../packages/website/src/content/docs/docs/how-to/cut-a-release.md). This skill doesn't bump the version, rename the changelog's section, merge, push, or tag.

## Ground rules

Each of these protects something the owner relies on:

- **Stay on the release branch in the main tree.** The owner's `npm run dev` runs from it. Vite picks up whatever files are there, so checking out another commit, even for a moment, can leave the owner's app on the wrong code. Put older commits in a clone or `git worktree add` under a temp folder.
- **Keep every check disposable and your own.** Give each one its own database container, data folder, secret key file, and ports. Name containers `fxbot-prep-*`. Never point a check at the owner's dev server, its database, or a real install. Run servers from a clone, never from the main tree, whose `.env` the server would read. When you finish, stop only what you started, by its saved PID or name, and remove what you made.
- **Don't publish.** No push, merge, tag, or release. A push to `main` publishes the site, and the release follows. The owner runs those, from commands you give them.
- **Don't change the machine.** No new users, firewall rules, system services, or rootful daemons. If a check needs one, skip it and say so.
- **Report only what ran.** Each check passed, failed (with its output), or didn't run (with the reason). A lead isn't a finding until you've read the code.
- **Remember this is a public repo.** Write no private hostnames, machine names, home paths, personal emails, or secrets. Security findings go in the chat report only. The site, README, and notes describe features, not security guarantees.
- **Write in plain words.** The owner reads everything you write. Use short sentences, say what happens to whom, and define any term you can't avoid.

## 0. Scope

- **The version** comes from the argument, or from the branch name `release/<version>`. The previous release is the latest `v*` tag, from `git describe --tags --abbrev=0 --match 'v*'`.
- **Run the scope script** from the repository root: `node .agents/skills/prep-release/scripts/scope.mjs [version] [previous tag]`. It changes nothing. It prints:
  - commits and changed areas
  - migrations, core and plugins
  - each plugin's version, `minFxbot`, and changes
  - plugin API lines removed or changed
  - dependency changes and new `FXBOT_` variables
  - docs pages and their sidebar listing
  - the phase docs this release touched
  - whether the notes file is written
  - added lines worth a look: TODOs, home paths, hostnames, secrets

  Its `check:` lines are leads to look at, not verdicts.
- **Read** `## Unreleased` in `CHANGELOG.md`, the README's Phases entries marked with this version, and `git log --format='%h %s' <previous>..HEAD`. Read each phase doc this release built, in `docs/_completed/phases/`, closely. Its checklist, open questions, and "What the build changed" say what was promised, what was decided, and what wasn't checked.

Then tell the owner in two or three lines what the release holds, and go on.

## 1. Review: gaps, risks, and issues

Read [references/review.md](references/review.md). It has the lenses, the severity scale, and the report template. Go through each lens against the diff and the phase docs.

- **Verify each finding** by reading the code it's about. You'll find a lot, and a finding that turns out false costs the owner time and trust.
- **For a big release** (more than about 60 changed files), split the reading by area across subagents: sdk and server, ui, plugins, then the site and docs. Give each the lenses and ask for `file:line` evidence. Then check what comes back yourself before reporting it.
- **Report in the chat** with the template. Fix nothing in this pass, not even one line. The owner decides what to fix and when, and a quiet fix can't be reviewed.
- **Don't wait for an answer.** Go on to the docs.

## 2. Docs

Read [references/docs.md](references/docs.md). It covers Diátaxis, where each kind of change goes in this repo, the house style, and the release notes format. Then:

1. **Match the changelog and the commits both ways.** A user-visible change with no bullet gets one. A bullet with nothing behind it goes in the report.
2. **Give each change a home.** Find the page that owns it in the map in docs.md, and edit it in place. Write a new page only when nothing owns the change, in exactly one Diátaxis kind, and list it in `packages/website/src/sidebar.ts`.
3. **Check the reference pages against the code:** the plugin API, HTTP API, client, server API, configuration, and commands. A reference page that's wrong is worse than none.
4. **Bring the rest up to date** with what was built:
   - the README's Phases list and Status
   - `AGENTS.md` ("Where things are" and "What this repo is"), only when the repo's shape changed
   - each changed plugin's README and description, in `plugin.json` and in `plugins-registry.json`
   - the "What the build changed" notes in each phase doc
   - the home page's features, only if a headline feature changed what fxbot is
5. **Refresh the screenshots.** Run `npm run build && npm run shots`. It starts a throwaway fxbot with the made-up bots in `scripts/screenshots/world.mjs`, and rewrites each shot in `packages/website/public/shots/` that looks different. Look at every one it rewrote. Don't commit a shot with a broken layout, an error, or anything from a real install. A screen this release added or changed that a guide or the home page should show gets a shot of its own: a scene in `shoot.mjs`, what the bots say in `world.mjs`, and a light and dark `<img class="shot">` pair in its guide. Commit the shots on their own.
6. **Draft `docs/releases/<version>.md`** in the format in docs.md. Leave it uncommitted. It goes in the release commit, which runs `git add docs/releases`.
7. **Check the site and whitespace:**
   - Run `npm run build-site`. It needs Node 22.22 or newer, and it checks links.
   - Run `git diff --check`.
   - Look over new files yourself, since that diff doesn't cover them.
8. **Commit the docs on the release branch,** by topic. Say in each message what changed, and end it with the session's co-author line.

Fix wrong or missing docs here. A product bug you find while writing them goes in the report, not in a fix.

## 3. Checks

Read [references/checks.md](references/checks.md) and run every check it lists, from a clean clone of the branch. Keep a row for each one: passed, failed, or not run.

## 4. Hand-off

End with one short message the owner can act on:

- **The verdict:** ready, or not ready because of what. Count blockers from the review and failed checks.
- **The docs commits,** one line each.
- **The checks,** in a table: check, result, one line of detail.
- **What only a person can check,** taken from the phase docs: real models, real phones, real accounts.
- **The release notes' text,** for the owner to read before cutting.
- **What happens next.** When the owner says to cut it, make the release commit locally: `npm version <version> --no-git-tag-version`, then rename `## Unreleased` to `## <version> (<date>)`, then `git add docs/releases && git commit -am "Release <version>"`. Run the clean-clone checks again on that commit. Then give the owner this block. It never switches the main tree to another branch:

  ```sh
  git push origin release/<version> release/<version>:main
  git fetch origin main:main
  git switch -c release/<next> && git push -u origin release/<next>
  ```

  Ask which version comes next. The default is the next minor.
