# Docs: Diátaxis, where things go, and how they read

## Diátaxis

fxbot's site sorts every page into one of Diátaxis's four kinds. Its own pages are in [diataxis/](diataxis/README.md), copied into this skill so it works offline. They're by Daniele Procida, under CC BY-SA 4.0. The summary below quotes them. When a page is hard to place, use the compass ([compass.rst](diataxis/compass.rst)):

| If the content… | …and serves the user's… | …then it must belong to… |
| --- | --- | --- |
| informs action | acquisition of skill | a tutorial |
| informs action | application of skill | a how-to guide |
| informs cognition | application of skill | reference |
| informs cognition | acquisition of skill | explanation |

You can ask the compass's two questions of a single sentence as well as of a whole page. A paragraph that answers them differently from the rest of its page belongs on another page, with a link to it.

Read the whole page for a kind before you write a new page of it. For a page that sits between two kinds, read [tutorials-how-to.rst](diataxis/tutorials-how-to.rst) or [reference-explanation.rst](diataxis/reference-explanation.rst). [how-to-use-diataxis.rst](diataxis/how-to-use-diataxis.rst) explains how to improve docs one small step at a time, which suits a release's sweep.

### Tutorials

"A tutorial is an experience that takes place under the guidance of a tutor. A tutorial is always learning-oriented." ([tutorials.rst](diataxis/tutorials.rst))

- Show the learner where they'll be going.
- Deliver visible results early and often.
- Keep telling them what they should see.
- Ruthlessly minimise explanation, and focus on the concrete.
- Ignore options and alternatives.
- Aspire to perfect reliability: it works for every reader, with no one there to help.

### How-to guides

"How-to guides are directions that guide the reader through a problem or towards a result. How-to guides are goal-oriented." ([how-to-guides.rst](diataxis/how-to-guides.rst))

- Address real-world complexity, and omit the unnecessary.
- Give a set of instructions, in a logical sequence that flows the way people work.
- Pay attention to naming: the title says exactly what the guide does, such as "Give a bot a routine".

### Reference

"Reference guides are technical descriptions of the machinery and how to operate it. Reference material is information-oriented." ([reference.rst](diataxis/reference.rst))

- Describe, and only describe. Link to steps and reasons instead of including them.
- Adopt standard patterns, so readers find things where they expect them.
- Respect the structure of the machinery: the page mirrors the code's own shape.
- Provide examples.

### Explanation

"Explanation is a discursive treatment of a subject, that permits reflection. Explanation is understanding-oriented." ([explanation.rst](diataxis/explanation.rst))

- Make connections, and provide context: why it's built this way, the history, the constraints.
- Admit opinion and perspective, and weigh alternatives.
- Keep it closely bounded: no steps, and no reference tables.

## Where things go in this repo

The site has two sets of pages. The docs are for running fxbot, and the SDK pages are for building on `@fxbot/sdk` and writing plugins. Each set has the four kinds, at `packages/website/src/content/docs/<docs|sdk>/<tutorials|how-to|reference|explanation>/<slug>.md`. Each page has a `title` and a `description` in its frontmatter, and a line in `packages/website/src/sidebar.ts`. A page that isn't listed there doesn't appear in the sidebar.

| A change that… | Goes in |
| --- | --- |
| lets an owner do something new | a how-to in `docs/how-to/`, titled with the task. A new plugin usually gets one. |
| changes a first run (install, setup, first bot) | `docs/tutorials/first-fxbot.md`, and `set-up-with-an-agent.md` with `packages/website/public/agent-setup.txt` |
| adds or changes a setting, variable, command, limit, or file | reference. Variables are in the README's table, which the site's configuration page is built from. Also `reference/commands.md` (the machine's `fxbot` command), `computer.md`, `install-layout.md`, and `providers.md`. |
| adds or changes plugin API, HTTP API, client, or server API | `sdk/reference/plugin-api.md`, `http-api.md`, `client.md`, and `server-api.md`, checked against the code |
| changes how something works, or why | explanation: `bots-and-chats.md`, `core-and-plugins.md`, `architecture.md`, `releases.md`, `security.md`, and `sdk/explanation/how-it-works.md` |
| breaks or removes plugin API | `packages/sdk/src/plugin-breaks.json`, a note under `## Unreleased`, and `plugin-api.md` |
| adds or changes a screen | its screenshot, from `npm run shots` (scripts/screenshots). A new screen worth showing gets a scene there, and a light and dark `<img class="shot">` pair in its guide. A headline one goes in the home page's gallery, in `src/home.tsx`. |
| comes from one of fxbot's plugins | that plugin's `README.md` and its `description` in `plugin.json` and `packages/sdk/src/plugins-registry.json`. The site's plugin directory shows these. |

Docs that live outside the site:

- **`CHANGELOG.md` `## Unreleased`:** the full record. The site's changelog page is built from it.
- **`README.md`:**
  - **Phases:** each built phase gets `[x]` and its release, as in `(plugin; 0.7.0)`.
  - **Status:** a few lines. The Phases list carries the features, so Status doesn't list them again.
  - **Install, Update, and Run from a checkout.**
  - **The variables table.**
- **`AGENTS.md`:** "Where things are" and "What this repo is", only when the repo's shape changes: a new package, a plugin in `plugins/`, or a new kind of doc. It doesn't list each built phase: `docs/_completed/phases/` holds them, and the README's Phases list links them.
- **`docs/_completed/phases/<phase>.md`:** a phase moves here from `docs/phases/` once it's built. Fix every link to it. Its "What the build changed" section records what came out differently from the plan.
- **`packages/website/src/home.tsx`:** the home page's features. Change it only when a headline feature changes what fxbot is.

These are generated, so edit their sources instead: the changelog page, the configuration variables, `llms-full.txt`, and the copies of the registry files in `packages/website/public/`.

## House style

The docs already have a voice. Keep it, and match the pages around yours.

- Plain words and short sentences, in the present tense, with "you" for the owner. The owner finds terse jargon hard, so say what happens to whom, and define a term you can't avoid.
- UI names in bold, and paths with ›: **Settings** › **General**, **Plugins**, **Add**.
- One kind per page. Link to another page rather than repeating it.
- Describe features. Never promise security: no "safe", "secure", "can't be bypassed", or "private".
- No private hostnames, machine names, home paths, personal subscriptions, or private project names. Write "Hackers in the Loop" in full if it's needed.
- Edit an existing page in place before you add a new one. The smallest change that makes the docs true is the right one.

### Changelog bullets

Each bullet opens with a bold sentence that says what the owner gets, then follows with what they see and do. Developers get bullets of their own, opening "**For plugins:**" or "**For the SDK:**". Name plugin versions and where to update them, as in "Chat rooms 0.3.1 … Update them from **Plugins**". **Before upgrading** opens the section when there are migrations, a libfx bump, or a step by hand. It names each migration and what it does to an existing install.

## Release notes

`docs/releases/<version>.md` is a short post. The owner pastes it into Discord and elsewhere. GitHub Releases shows it, and so does Settings, in a small box above **Update**. Copy the shape of the last file in `docs/releases/`:

```md
fxbot v<version> is out!
fxbot: AI assistants that do real work, built your way.

https://fxbot.sh/docs/reference/changelog/

Before upgrading: <what an owner must know or do first: the database changes, plugins to update from Plugins>

Changes:

- New Plugin: <Name> => <what it gives you>
- <one plain line for each thing worth telling>
- Bug fix: <what stopped going wrong>
```

- The first line must be exactly `fxbot v<version> is out!`, or the release workflow refuses to publish.
- The second line says what fxbot is, in the home page's own headline, so a post shared on its own makes sense to someone who's never heard of it. When the headline changes, so does this line.
- Include **Before upgrading** only when the changelog has one, and keep it above **Changes**. Settings' box is small, and a warning at the bottom goes unseen.
- Write one line for each thing an owner would notice, newest headline first. Leave out developer-only bullets, unless a plugin author must act.
- Use plain Markdown that reads the same on GitHub and in Discord. Write no tables, no nested lists, and no bold.
