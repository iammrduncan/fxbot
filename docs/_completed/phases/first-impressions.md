# First impressions

What fxbot says it is, in the places people meet it first: the link preview, the home page's first screen, the README, the docs' first page, and the install's last lines. Each should answer, before anyone reads further, what people now ask:
- **What it is:** AI assistants that do real work, built your way, which you talk to in fxbot's own app. An open alternative to OpenClaw, Hermes Agent, Grok Bot, Muse, Claude Duet, and OpenAI's Dots.
- **Which models:** any, hosted or local. Sign in with ChatGPT, add a key for Claude or Gemini, or run one with Ollama.
- **How to reach it:** from any browser, and from your phone, away from home too, in the fxbot app, with web pairing. Tailscale isn't needed, and it's no longer the recommended way in.
- **What plugins are:** what you add to fxbot itself, said by what they let a bot do: a computer of its own, routines, subagents. The word stays, and "extensions" never appears.
- **What a bot does for you:** tasks named plainly, with the screenshots we already have.

Status: built on 2026-11-10, for `main` after 0.9.0, as planned the same day, with the owner's answers to the open questions ([5](#5-open-questions)). Where the build differs from the plan, [What the build changed](#what-the-build-changed) says so. Researched the same day:
- the questions people asked the owner after a link to fxbot.sh
- a test of today's link preview and home page on two fresh readers who knew nothing about fxbot
- how OpenClaw, Hermes Agent, Pi, eve, Grok's bot, Muse, Claude Duet, OpenAI's Dots, and Open WebUI introduce themselves
- a panel of six readers, each playing a common kind of person, on four headlines and six words for plugins

The chat apps people asked for are two stubs of their own: [Gateways](../../phases/gateways.md) and [Telegram and Discord](../../phases/telegram-and-discord.md).

## What the owner asked

"When sharing fxbot I've gotten two questions that make no sense to me." From a conversation after a link to fxbot.sh's plugins page:
- "So you deploy fxbot and then access it through tailscale to install it like a plugin for the browser?"
- "Any plans for discord or telegram comms?", then, after being told about web pairing, "But that requires tail scale."

And from others: "Does it only work with local models?"

"Our taglines and stuff and first impressions must be wrong, people don't understand what it is or how to use it. People know what hermes is, or open claw, or grokbot, or muse. Why can't they understand fxbot? Use the research directive to better adjust our marketing, docs, and quick starts." And: "people don't read the docs."

Then: "With web pairing, tailscale isn't the recommended way anymore."

On the open questions: "Headline: 'Your AI Assistants' or something... whats others tagline? I think local is less of a thing but more of the 'Its your assistant, configure and built just the way you want it'... Whatever works best... I think 'on your own machine' is obvious if you install it." "Name OpenClaw, Duet, Dots, Muse, GrokBot, Hermes in a FAQ entry. We are an open alternative to those, that is lighter weight, fully featured, and user experience first." "Write stub phase for telegram/discord. We should add a stub phase for general gateway plugins." "Also plugins gives people confusion it seems? Should we use addons or plugins or extensions or what? Run a naive discovery panel against common public personas." "Release posts should yes get a line saying what fxbot is."

And: "Windows does work through WSL 2. I tested it. And for v0.10.0 we should make it work for windows, linux, mac natively, so for now don't mention 'linux', cause you will cause more confusion and make work for us to revert later when we add more platforms and distribution channels."

## 0. Core or plugin

Neither. Nothing in the app changes. This phase changes words and pictures:
- the site's home page and its meta tags, the plugin directory's opener, and the social card
- the docs' first page, the tutorial, and the guides that call Tailscale the recommended way
- the README, `agent-setup.txt`, and the last lines `setup.sh` prints
- the GitHub repository's description and topics, which the owner sets

All of it is site work, which goes live on a push to `main` with no release ([Site deploys from main](../../../README.md#releasing)). `release/0.10.0` holds no app work yet, so it ships to `main` now, and `release/0.10.0` moves along with it.

## 1. Research

### What people asked, and why

Each question traces to words fxbot puts first:

| Question | What fxbot says first |
| --- | --- |
| "Does it only work with local models?" | The card says "Local first." The home page's description, which every link preview shows, is "a lean, local-first core that works with local models and grows with the plugins you pick." Hosted models aren't named. |
| "Like a plugin for the browser?" | The card ends "Grows with the plugins you pick," and the link shared was the plugins page, titled "Plugins," with "code, MCP servers, and skills to add to your fxbot." Nothing says what fxbot is, so "plugins" reads as browser extensions. |
| "But that requires Tailscale." | Step 2 of the home page's Get started is `sudo tailscale serve --bg 8787`. The hero screenshot's address bar reads `https://bot.<tailnet>.ts.net`. "Who it's for" and the Network row call Tailscale the recommended way in. The tutorial lists Tailscale under "You need." `setup.sh` ends with SSH and Tailscale. Web pairing isn't on the home page at all. |
| "Any plans for Discord or Telegram?" | Nothing on the first screen says how you talk to your bots away from the machine. The products people compare fxbot with answer that with chat apps (below). |

### Today's first impression, on fresh readers

Two fresh readers, each a model told to answer only from what it was shown, as a person skimming would:

**One saw only the link preview** (the card, the title, and the description). They said:
- What it is: "A customizable AI assistant or chatbot builder," medium confidence.
- Models: "'Works with local models' is the only thing it says, so I can't tell whether it works with ChatGPT or Claude."
- Plugins: "Add-ons you choose to give the bot extra abilities, like a browser extension or app add-ons."
- Their first question back: "Does it work with ChatGPT or Claude, or do I have to run my own model?"

**The other saw the home page's first screen and Get started:**
- From a phone: "Install the app on my phone, and have Tailscale on both the phone and the server machine."
- Their questions: "What can a bot actually do?" and "Can I reach it away from home without Tailscale?"
- Mac and Windows: "look unsupported."

Both readers asked the owner's questions back, so the words cause them, not the readers.

### The other places people look

- **The GitHub description:** "fxbot is your bot, built and configured how you want it." It names no category, model, or device. The topics are `agent-harness`, `agent-tools`, `ai-agents`, `autonomous-agents`, `harness`, `mcp-tools`, and `multi-agent`. Nothing says self-hosted or assistant.
- **The README and the docs' first page** open with the same line, then local models before hosted ones, then Tailscale as the recommended way in.
- **The home page's feature list** leads with plumbing: bots and chats, providers, the library, an installable app, plugins, and releases. The things bots do that people would want aren't in it: a computer of their own, routines, subagents, pages, and rooms. Most are in the gallery further down, titled by feature, not by task.
- **The only Mac and Windows line** is the tutorial's "On a Mac or on Windows, use a Linux machine, or a Linux VM." `setup.sh` runs in WSL 2's Ubuntu with systemd, which the owner checked on 2026-11-10, though [operations](operations.md) had left it unchecked.
- **"Linux" is on the first screen three times:** the line under the install command, step 1's list of distros, and the Machine row. Native Windows, Linux, and Mac installs are planned for 0.10.0 ([Distribution](../../phases/distribution.md)), so a platform named now is wrong soon.

### The products people do understand

Fetched from their own sites, READMEs, and docs on 2026-11-10.

**OpenClaw** ([openclaw.ai](https://openclaw.ai/)):
- **Title:** "OpenClaw — Open-Source AI Assistant".
- **Description:** "the open-source AI assistant that runs on your machine and works from WhatsApp, Telegram, or any chat app: inbox, email, calendar, flights."
- **Hero:** "The AI that really does things," with "Organizes your inbox, sends emails, manages your calendar, checks you in for flights. All from WhatsApp, Telegram, or any chat app you already use."
- **Above it:** "Open source · Runs on your machine." The README's title: "Your assistant, on your devices, in your chats."
- **Models:** the first feature card: "Bring hosted, subscription-backed, gateway, or local models."
- **Quickstart:** one install line, then onboarding. It ends: "Want to chat from your phone instead? The fastest channel to set up is Telegram (just a bot token)."
- **FAQ:** answers "Do I need a Claude or OpenAI subscription?" and "Do I have to buy a Mac Mini?" with "No." Tailscale appears only as an optional setup.

**Hermes Agent** ([hermes-agent.nousresearch.com](https://hermes-agent.nousresearch.com/)):
- **Hero:** "The Agent That Grows With You."
- **Description:** "A free, open-source AI agent with memory and skills. Download for Mac, Windows or Linux."
- **Buttons, first:** a desktop app, the cloud, and the terminal.
- **Feature #1:** "Telegram, Discord, Slack, WhatsApp, Signal, Email, CLI… One agent, one memory, every surface."
- **README:** "Use any model you want — Nous Portal, OpenRouter, OpenAI, your own endpoint… no lock-in."
- **FAQ:** "Can I use it offline / with local models?" "Yes." Also "How much does it cost?"

**Pi** ([pi.dev](https://pi.dev/)):
- **Hero:** "There are many agent harnesses but this one is yours," with "Pi is a minimal agent harness."
- **og:title:** "Pi Coding Agent".
- **Description:** "A terminal-based coding agent."
- **Models:** the third section, "15+ providers, hundreds of models," names Anthropic, OpenAI, Google, OpenRouter, and Ollama.
- **"What we didn't build":** answers the questions an FAQ would.

**eve** ([eve.dev](https://eve.dev/)):
- **Title:** "eve – build AI agents that you own." Hero: "Build production AI agents."
- **What it is:** a framework, for builders. It names its category, "agent framework", in the first line.
- **Demo:** an animated chat shows agents at work on a real task.

**Grok's bot** ([x.ai/bot](https://x.ai/bot), [its docs](https://docs.x.ai/grok-bot/overview)):
- **Hero:** "Meet Grok Bot. AI teammates you can give real work to. Bots can sign in to your tools, use them just like you do, and come back with finished work."
- **og:description:** "They have their own computer, use it like you do, and never log off."
- **Next on the page:** "Give tasks to Bots like you would a teammate on desktop or iOS."
- **Models:** never on the first screen. The FAQ: "Grok Bot picks the model for each task, and there is no model picker."
- **Quickstart:** five steps with no commands. It ends: "Make it a routine… Your Bot now runs that task on a schedule."
- **FAQ:** 34 entries, among them "Is Grok Bot the same as the Grok app?", "Where do I talk to Grok Bot?", "Does the Bot use my own computer?", and "Can I pick the model?"

**Muse**, Meta's ([muse.ai](https://muse.ai), [the launch post](https://about.fb.com/news/2026/09/introducing-muse/)), which CopilotKit's OpenMuse follows:
- **Hero:** "Muse, AI that gets it done for you," then verbs that turn: "sorts your email / books reservations / shops for you / manages calendars."
- **og:title:** "Muse — Your Personal AI Agent".
- **Where you talk to it:** in the launch post's first paragraph, "in the Muse app or directly in WhatsApp."
- **On the page:** "Every Muse user shares their own computer in the cloud with their Muse."
- **Models:** one house model, no choice.

**CopilotKit's open versions:**
- **[OpenBot](https://github.com/CopilotKit/openbot):** "A modular, self-hostable workspace for AI coworkers. Choose your models." Its second section: "Use OpenAI, Claude, Gemini, or open models… Fully local is an option."
- **[OpenDuet](https://github.com/CopilotKit/OpenDuet):** "Each agent has a computer of its own. Use it on the web, on mobile, in Slack, or in Microsoft Teams. Host OpenDuet yourself and choose your own model."

**Claude Duet and OpenAI's Dots**, from news coverage found on 2026-11-10, not their makers' own pages (the build checks their names there):
- **Claude Duet,** Anthropic's, a research preview since 2026-10-21: a standalone app, on iOS, Android, and claude.ai, where Claude works in the background with connected apps and a browser in the cloud, and asks before sensitive actions. OpenDuet follows it.
- **Dots,** OpenAI's, since 2026-09-29: always-on agents, reached in ChatGPT, Slack, and Microsoft Teams. OpenDots follows it.

**Open WebUI** ([openwebui.com](https://openwebui.com)), the self-hosted chat page people may take fxbot for:
- **Title:** "Open WebUI: Self-Hosted AI Platform".
- **README, first two sentences:** "Connect local models through Ollama or use OpenAI-compatible APIs for local and cloud models." Its site: "Connect to any model, local or cloud."
- **Quickstart:** one command, then a page at localhost.
- **Phones and chat apps:** not mentioned. Its examples are abstract: "Voice, vision, retrieval, generation, search."

**What they share:**
- **A role and a result first:** "AI teammates," "personal AI agent," "AI that gets it done for you."
- **Where you talk to it, by name, on the first screen:** desktop and iOS, the Muse app or WhatsApp, Slack.
- **Models, in one of two ways.** The hosted products hide them. The self-hosted ones name hosted and local together, in the first or second line.
- **A computer of the bot's own** is what Grok's bot, Muse, OpenMuse, and OpenDuet all lead with. fxbot has it, in its computer plugin, and its first screen doesn't say so.

### The words, on a panel of six

Six fresh readers, each a model playing a common kind of person, answered from a link preview and one line of the page, with the order of the choices changed for each:
- a school administrator, 56, who uses an iPhone and the ChatGPT app
- a college student, 20, on Discord, with Chrome extensions and game mods
- a software engineer, 34, with VS Code, Claude Code, and Ollama
- a sysadmin, 41, with Docker, Tailscale, and WordPress plugins
- a shop owner, 38, with Shopify apps, Zapier, and Google Workspace add-ons
- a designer, 29, with Figma plugins and Raycast extensions

It's a quick read on what words suggest, not a survey of people. [A person checks it](#4-checklist).

**Headlines:**

| Headline | Clearest | Most want to try | What they said |
| --- | --- | --- | --- |
| "AI assistants that do real work. Built your way." | 2 | 5 | "That's what I care about." "'Real work' is the pitch I care about." "A bit buzzwordy." |
| "Your own AI assistants, on your own machine." | 4 | 1 | The student, the engineer, the sysadmin, and the designer: "It says what it is and where it runs." The administrator: "'Machine' makes me nervous." The shop owner: "Feels like homework." |
| "Your AI assistants, built the way you want them." | 0 | 0 | "Vague." "Sounds like I'd have to build something." "Sounds like a lot of other products." |
| "Your bot, built and configured how you want it." (today's) | 0 | 0 | "'Bot' feels dated and small." "'Bot' sounds like Discord." "'Configured' sounds like work." |

**Words for what you add**, each put in "Add only what you want: ___":

| Word | What it meant to them | Would it go in the browser? | Their verdict |
| --- | --- | --- | --- |
| plugins | Features that extend one app: WordPress, Figma, game mods | 5 said no, 1 maybe | Clearest for the engineer, the sysadmin, and the designer, and second for the student |
| add-ons | The same as plugins, but older: Firefox, Google Docs | 5 said maybe, 1 no | More browser-like than plugins |
| extensions | Chrome extensions | 6 said yes | Most misleading, for all six: "I'd go hunting in the Chrome store" |
| skills | Alexa skills, a résumé, Claude's instruction packs | 6 said no | Clearest for the administrator and the student, as what the assistant can do. fxbot's skills are already something else: the instructions plugins carry |
| integrations | Two services connected: Zapier, Slack to Jira | 6 said no | Clearest for the shop owner, who'd expect connectors to Gmail and Shopify, and said it "might undersell what fxbot adds" |
| apps | Phone apps, the App Store | Unsure | Misleading for two: "I'd think of the App Store" |

## 2. Key takeaways

1. **Every product people understand says what it is in its first line, with a category word:** "AI assistant", "AI agent", "agent harness". fxbot's first line, "Your bot, built and configured how you want it," has none. "Bot" alone could be a chat bot, a Discord bot, or a browser bot, and to the panel it sounded "dated and small." A result sells it: "do real work" made five of six want to try it.
2. **None of them lets "local" stand alone.** Each names hosted and local models in one sentence, as the owner's choice. fxbot's "Local first" means the data is on your machine, but people read it as "local models only," and the description says only local models.
3. **They say how you reach it, by name, on the first screen.** OpenClaw and Hermes name chat apps. fxbot's answer is its own app, from any browser and on your phone through web pairing, and the first screen should say so as plainly. Today it shows Tailscale.
4. **They show tasks, not parts.** "Organizes your inbox, checks you in for flights." fxbot shows "the library" and "releases and updates." fxbot's screenshots already show tasks: a trip plan written as a page, a routine every Monday, three subagents comparing hosts, two bots working together.
5. **A computer of the bot's own is what this kind of product leads with now.** Grok's bot, Muse, and CopilotKit's versions all say it first. fxbot gives each bot one, a desktop the owner watches and takes over, and none of its first impressions mention it. Grok's quickstart ends on a routine, which fxbot has too.
6. **Their FAQs answer "do I need X?" head-on.** fxbot has no FAQ. The questions are known now, and each has a one-line answer.
7. **The quickstart ends on the phone.** OpenClaw: "Want to chat from your phone instead?" fxbot's ends on Tailscale. Its tutorial should end with the phone paired through web pairing, the way the owner already answers in person.
8. **"Plugins" stays, with what it does beside it.** The panel put plugins inside fxbot once fxbot said what it is. Add-ons and extensions read as the browser's, apps as the App Store's, integrations as connectors, and skills is taken. The friend's "plugin for the browser" came from a page that never said what fxbot is. Say what a plugin lets a bot do, in plain verbs, and keep the word beside it.
9. **Nobody reads the docs, so the link preview is the product's first page.** The card and the description are what people see in a chat. They have to carry the category, any model, and any device in about 20 words.

## 3. Implementation

### The words

From the owner's answers and the panel:
- **The line, everywhere it's first** (card, hero, README, docs, GitHub): **"AI assistants that do real work. Built your way."** "Built your way" is the owner's "configured and built just the way you want it," in three words. In the hero, "Built your way." is the H1's second line, in the muted color.
- **The sentence after it:** "Each one chats, remembers, works on a computer of its own, and runs tasks on a schedule. Pick its model, hosted or local, its look, and what it can do, and talk to it from any browser or the fxbot app on your phone."
- **Three facts, as a row under the hero:**
  - **Any model:** sign in with ChatGPT or Grok, add a key for Claude, Gemini, or OpenRouter, or run one with Ollama or LM Studio.
  - **On your phone:** the fxbot app, away from home too, with web pairing. No VPN needed. (A network that blocks direct connections needs one of the other ways, as [When a device can't connect](../../../packages/website/src/content/docs/docs/how-to/when-a-device-cant-connect.md) says, so the FAQ links there.)
  - **Yours:** free and open source, on your own machine. One command installs it, and your bots, chats, files, and keys stay with you.
- **The description** (meta, og, the docs' default): "AI assistants that do real work, built your way, on your own machine. Any model, hosted or local, from any browser or the fxbot app on your phone. Open source." That's 159 characters. The plan's first one left out "on your own machine" and "the fxbot app," and the [proof](#what-the-build-changed) missed both.
- **No platform is named on a first impression.** The card, the home page, the README's opener, the docs' first page, and GitHub say "your own machine," never Linux, Windows, or Mac. Native installs for all three are planned for 0.10.0, and this way nothing here changes when they land. What each install runs on stays where it's needed: the tutorial's "You need," `agent-setup.txt`, and `setup.sh`'s checks.
- **"Local first" and "a lean core" leave the first screen.** "On your own machine," in the third fact, says what "local first" meant, with no doubt about models. The lean core stays in "Who it's for" and the docs, for the people it's for.
- **Plugins, by what they do.** Where everyone reads it, the copy says what a plugin lets a bot do, then the word: "Add what you want them to do: a computer of their own, routines, subagents, pages, and more, as plugins." The app, the docs, and the plugin directory keep "plugins." No first impression says "extensions" or "add-ons."
- **A pitch for the owner to paste** when sharing a link: "fxbot is an open alternative to OpenClaw, Hermes, Grok Bot, and Muse: AI assistants that do real work, built your way. I run it on my own machine and use it from the browser or the app on my phone, with any model: ChatGPT, Claude, Gemini, or a local one. Each assistant gets its own computer, runs routines, and hands big jobs to helpers. Plugins add features like those to the app."

### The home page (`packages/website/src/home.tsx`)

In this order:
1. **The hero:** the crowd, then the line as the H1, then the sentence, then the three facts as a row of three short items, each with a small blob. On a phone they stack.
2. **The install:** the command and the AI-agent prompt, as now. Under them: "v0.9.0 · Free and open source (Apache-2.0)". "Linux" leaves it.
3. **The screenshot:** as now. The address bar reads `127.0.0.1:8787` in place of the tailnet address. The caption says the phone beside it is the fxbot app, paired with web pairing.
4. **"What your bots do"** in place of "What it looks like": the same gallery, each card titled by its task, as the bots in the shots say it. The page shot becomes "Plan a weekend, as a page you keep," and the routine shot, added beside it, "Every Monday, send three design reads." The subagents shot, also added, becomes "Compare three hosts at once, with subagents." "Bots that work together", "Rooms", "You decide what needs asking", and "A look for each bot" keep their shots. "Plugins you pick" becomes "Add what you want them to do: a computer, routines, subagents."
5. **Get started**, in three steps, with no Tailscale:
   1. **Install it:** the command, on your computer or a server. "What it runs on" links to the tutorial's "You need." The list of distros leaves the home page.
   2. **Set it up:** open `http://127.0.0.1:8787` on the machine, or over SSH from another computer. Sign in to a model, and make your first bot.
   3. **Put it on your phone:** add **Web pairing** from **Plugins**, and scan its code at web.fxbot.sh. The fxbot app installs from there.
6. **Questions people ask**, new, as a short list with a line or two each, linking to the guide that says more:
   - **How is it different from OpenClaw, Hermes Agent, Grok Bot, Muse, Claude Duet, or OpenAI's Dots?** It's the same kind of thing: AI assistants that do real work, with a computer of their own, routines, and helpers. fxbot is the open alternative: free and open source, lighter, fully featured, and made to be good to use. It runs on your own machine, works with any model, and has only what you add.
   - **Is it a browser extension?** No. fxbot is an app that runs on a machine of yours, and you open it in a browser or as an app on your phone. Plugins add features to fxbot itself.
   - **Does it only work with local models?** No. Sign in with ChatGPT or Grok, use a key from Anthropic, Google, OpenAI, OpenRouter, or about 30 others, or run one locally. Each bot can use a different one.
   - **Does a bot use my computer?** No. With the computer plugin, each bot gets a computer of its own, in a container on your machine, with a desktop and a browser you watch and take over.
   - **Do I need Tailscale?** No. Web pairing opens your fxbot from your phone or any computer, at web.fxbot.sh, over a connection straight to it. Tailscale, SSH, and your own proxy also work.
   - **Can I talk to it on Telegram or Discord?** Not yet ([Gateways](../../phases/gateways.md) is a stub). fxbot has its own app, which installs on your phone and shows everything a bot does: its pages, its computer, its subagents, and the cards where it asks you first.
   - **Is there a hosted version, or an account?** No. It runs on your machine, and your bots, chats, files, and keys stay there.
   - **What does it cost?** fxbot is free and open source. You pay your model's provider, use a plan you already have, such as ChatGPT, or nothing with a local model.
7. **What it does:** the feature list, with the computer, routines, and subagents in place of the library and releases, which move to "Who it's for."
8. **Who it's for:** web pairing is the way in from other devices. The Machine row becomes "Your computer, a home server, or a small VPS," linking to what it runs on. The Network row becomes "127.0.0.1:8787; from other devices, web pairing, or Tailscale, SSH, or a proxy of your own."
9. **The SDK:** as now.

### Link previews

- **The home page's tags** (`src/pages/index.astro`): the title becomes "fxbot: AI assistants that do real work, built your way". The description becomes the new one, and the image's alt text the card's words.
- **The docs' default description** (`astro.config.mjs`, Starlight's `description`) becomes the same.
- **The plugin directory** (`src/pages/plugins/index.astro`): the title becomes "fxbot plugins". The description and a line at the top of the page say: "What you can add to fxbot's AI assistants: a computer of their own, routines, subagents, pages, rooms, and more."
- **The card** (`public/card.png`): the crowd, the line, then "Any model. Any device. Free and open source." A script draws it from the site's own blob code and font, `scripts/screenshots/card.mjs`, run with `npm run card`, so the card follows the words when they change. It uses the Playwright the screenshots already use. AGENTS.md's Checks gets a line for it.

### Docs, README, and the rest

- **The docs' first page** (`docs/index.mdx`): the line and the sentence, then "From your phone, add web pairing ([Reach fxbot from your phone](/docs/how-to/reach-it-from-your-phone/))."
- **The tutorial** (`tutorials/first-fxbot.md`):
  - Tailscale leaves "You need." Windows joins it, through WSL 2's Ubuntu with systemd on, which the owner checked. On a Mac, a Linux VM, as now. The tutorial says nothing about what's planned.
  - The order becomes install, then open it on the machine or over SSH, then set it up, then pair your phone with web pairing.
  - It ends with the bot answering on the phone.
  - Tailscale stays a link, under other ways in.
- **Reach it** (`how-to/reach-it.md`): web pairing comes right after "On the machine itself," as "With web pairing (recommended)." Then SSH, then Tailscale, then the rest. The link to its old Tailscale heading in `how-to/when-a-device-cant-connect.md` follows the new anchor.
- **Security** (`explanation/security.md`): "Through web pairing, the recommended way in, only devices you've paired get in. Through Tailscale, your tailnet's access rules decide." The reasoning about a second login stays.
- **The README:** the line and the sentence, then the three facts. Under "Reaching it," web pairing comes first and Tailscale moves to the other ways.
- **`agent-setup.txt`:** fxbot is "AI assistants that do real work, built their way." The setup steps keep naming the systems it runs on, since the agent needs them, and add Windows through WSL 2. "From other devices, such as a phone," leads with web pairing, then Tailscale.
- **`setup.sh`'s last lines:**

  ```
  fxbot 0.9.0 runs on http://127.0.0.1:8787
  Open it there, or reach it:
    from your phone: add Web pairing in Plugins (https://fxbot.sh/docs/how-to/reach-it-from-your-phone/)
    from your computer, over SSH:  ssh -N -L 8787:127.0.0.1:8787 <you>@<this machine>
    with Tailscale:  sudo tailscale serve --bg 8787
  ```

- **GitHub's About** (the owner runs it, since this shell has no GitHub sign-in):

  ```sh
  gh repo edit iammrduncan/fxbot \
    --description "AI assistants that do real work, built your way, on your own machine. Any model, hosted or local, from any browser or the fxbot app on your phone. Open source." \
    --add-topic self-hosted --add-topic ai-assistant --add-topic personal-assistant --add-topic llm --add-topic ollama --add-topic pwa
  ```

- **Release posts** (`docs/releases/`, and the format in the prep-release skill's `references/docs.md`): a line under the first one, "fxbot: AI assistants that do real work, built your way," so a post shared on its own says what fxbot is.

### Not in this phase

- **Telegram, Discord, and other chat apps.** Every consumer product people compare fxbot with leads with chat apps. They're stubs of their own, [Gateways](../../phases/gateways.md) and [Telegram and Discord](../../phases/telegram-and-discord.md). Until one's built, the FAQ answers "Not yet."
- **Native installs on Windows, Linux, and Mac.** They're planned for 0.10.0 ([Distribution](../../phases/distribution.md), [Mac support](../../phases/mac-support.md)). This phase names no platform on a first impression, so nothing in it changes when they land.
- **Web pairing in Essentials.** The owner took it out in 0.9.0. The phone step names it instead.
- **Renaming plugins,** which the panel kept, or any change in the app.

### Size

| Where | Lines, about |
| --- | --- |
| `home.tsx`: hero, facts, gallery titles, three steps, FAQ, features | 120 changed |
| Meta tags, Starlight's description, the plugin directory | 10 |
| `card.mjs`, `card.png`, the npm script, the AGENTS.md line | 70 |
| Docs: index, tutorial, reach-it, security, the anchor | 80 |
| README, `agent-setup.txt`, `setup.sh` | 40 |
| The release-notes format | 5 |

No app code, no new dependency, and no new page in the docs.

## 4. Checklist

The words:
- [x] The line, the sentence, the three facts, and the description are as in [The words](#the-words), and the same everywhere they appear.
- [x] Claude Duet's and Dots' names and makers are checked on Anthropic's and OpenAI's own pages before the FAQ names them.
- [x] No first impression says "extensions" or "add-ons" for plugins.
- [x] No first-impression surface says "Local first," "local-first," or names local models without hosted ones: the card, the meta tags, the home page's first screen, the README's opener, the docs' first page, and GitHub's description.
- [x] Nothing calls Tailscale recommended or required: `grep -rn -i "recommended" | grep -i tailscale` over `packages/website`, `README.md`, and `setup.sh` finds nothing.
- [x] Every claim in the FAQ and the facts row is checked against the code: the providers named are in `providers-registry.json`, and web pairing's guide covers the phone step.
- [x] No first impression names a platform: `grep -n -i -E "linux|debian|ubuntu|fedora|windows|macos|wsl"` over `home.tsx`, `pages/index.astro`, Starlight's description, `docs/index.mdx`, the README's opener, and the card's words finds nothing. The tutorial's "You need" names Windows through WSL 2.

The home page:
- [x] The hero, the facts row, the install line, the screenshot's address bar and caption, the task gallery, the three steps, the FAQ, the features, and the Network row, as above.
- [x] Looked at, rendered from the build in Chromium, at 1280 and 390 wide, light and dark. Nothing overflows, and the facts row stacks on a phone.

Link previews:
- [x] `npm run card` writes `card.png`, 1200 by 630, and the card has been looked at.
- [x] The home page's and the plugin directory's `og:title`, `og:description`, and `og:image` read right in the built HTML.

Docs and the rest:
- [x] The docs' first page, the tutorial (no Tailscale in "You need," ending on the phone), reach-it (web pairing first, the anchor fixed), and security.
- [x] The README, `agent-setup.txt`, and `setup.sh`'s last lines. `bash -n setup.sh` passes.
- [x] The release-notes format has the line saying what fxbot is.
- [x] `npm run build-site` passes, with every link resolving. `git diff --check` is clean.

Proof:
- [x] A fresh reader, given only the new first screen, as in [the research](#todays-first-impression-on-fresh-readers), with the same questions, says with medium or high confidence that:
  - it's AI assistants that do things, which you run yourself
  - it works with ChatGPT or Claude
  - Tailscale isn't needed
  - the phone uses the fxbot app
  - plugins add features to fxbot, not to a browser
  Its answers are in [What the build changed](#what-the-build-changed).
- [ ] A fresh reader, given only the new link preview, says the same, where a preview can. On its second run it said that you run it yourself, and that it takes hosted models, at medium or high confidence. The phone was right, "open the fxbot app on my phone and connect to the copy running on my own machine," but at low confidence: "I don't know how the connection or login works." A preview has no room to say how pairing works, and plugins aren't on it. Its answers are in [What the build changed](#what-the-build-changed).
- [x] Committed on `release/0.10.0` with `main` moved to it, and the owner has the push command and the `gh repo edit` command.

Only a person can check:
- [ ] The card, in a text to three people who've never heard of fxbot, asking: "What is it, does it work with ChatGPT, and how would you use it from your phone?"

## 5. Open questions

All answered by the owner on 2026-11-10:
1. **The line:** "whatever works best," with "built just the way you want it" over "local," and "on your own machine is obvious if you install it." The panel picked "AI assistants that do real work. Built your way."
2. **The others:** yes, named in one FAQ entry: OpenClaw, Hermes Agent, Grok Bot, Muse, Claude Duet, and OpenAI's Dots. fxbot is "an open alternative to those, that is lighter weight, fully featured, and user experience first."
3. **Telegram and Discord:** stubs, [Telegram and Discord](../../phases/telegram-and-discord.md), and [Gateways](../../phases/gateways.md) for chat-app plugins in general.
4. **Plugins:** the panel kept the word ([research](#the-words-on-a-panel-of-six)).
5. **Release posts:** yes, a line saying what fxbot is.
6. **Platforms:** none named on a first impression, and Windows works through WSL 2.

## What the build changed

**The words:**
- **The description** gained "on your own machine" and "the fxbot app." The plan's first one, "Use any model, hosted or local, from any browser or the app on your phone. Free and open source.", left a fresh reader at "it may also be something you host yourself," at low-medium confidence, and "open it in the phone's browser or install the app," at low.
- **llms.txt's description,** in `astro.config.mjs`'s `starlightLlmsTxt`, still said "local-first" and "works with local models." The plan missed it, and it says the same as the others now.
- **The names.** Claude Duet is checked on Anthropic's own page, [claude.com/duet](https://claude.com/duet): "Claude Duet is a proactive agent that understands what needs your attention." OpenAI's and xAI's pages refuse automated fetches. Their names come from their own pages' titles in search results: "Introducing dots" and "Meet dots," lowercase, so the FAQ says "OpenAI's dots," and "Introducing Grok Bot."

**The home page:**
- **The crowd** moved to `src/crowd.ts`, so the page and `scripts/screenshots/card.mjs` draw the same seven.
- **The gallery** is nine cards: the page, subagents, bots working together, the routine, rooms, approvals, a diagram, the look, and plugins. The diagram shot joined to fill the third row.
- **The routine shot** is 1024 by 800 and mostly an empty chat. It's cropped to 16:10 from the top, so its row lines up, and it sits in the second row, not the first.
- **Get started:** in three columns the install command was cut off, so step 1 spans the row, and steps 2 and 3 sit under it. Its title is "From one command to your phone."
- **The questions** don't link the Gateways stub, since a phase doc isn't for the public site.
- **What it does** is six cards: bots and chats, any model, a computer of its own, routines, subagents, and on your phone. The library and updates are rows in "Who it's for," as Files and Updates.

**The rest:**
- **The plugin directory** keeps "Plugins" as its heading, and only its `og:title` is "fxbot plugins," through the page's `head`.
- **The README's opener** names the products fxbot is an open alternative to, as the questions do.
- **The tutorial** opens fxbot on the machine, or over SSH, in a new "Open it." It reloads the page where it had closed the app, since the chat is in a desktop browser at that point, and ends with "Put it on your phone."
- **`agent-setup.txt`'s hand-over** gained a third step, for the phone.
- **The phone comes early,** after the owner's review: "shouldn't the reach-it go under tutorials and be something pretty early on, especially phone access?" The tutorial pairs the phone right after setup, so the first chat is on it. The two phone guides and Pair another device lead the how-to list. "Reach it" stays a how-to, since it's a choice among ways, not a lesson. The docs' first page and the agent tutorial point to the phone.
- **[naive-panel](../../../.agents/skills/naive-panel/SKILL.md),** at the owner's word, is a skill now. It runs the fresh readers and the panel this phase's research used.

**The proof.** Fresh readers, each a model told to answer only from what it was shown.

The new first screen:

| Question | What they said | Confidence |
| --- | --- | --- |
| What it is | "A tool for making your own customizable AI chatbots or assistants that you run yourself, with a chat app, memory, its own computer, and scheduled tasks" | Medium |
| Where it runs | "On my own computer or a server, installed by one curl command… in a browser at http://127.0.0.1:8787, or through the phone app" | High |
| Tailscale | "No. The page says 'No VPN needed' and says to use web pairing" | Medium-high |
| Models | "Both. You can sign in with ChatGPT, Grok, or OpenRouter, add a key for Claude or Gemini, or run local models" | High |
| From a phone | "Add Web pairing from Plugins, open web.fxbot.sh on the phone, enter the code fxbot shows, and install the app from there" | Medium |
| Plugins | "Add-ons for fxbot itself, added from a Plugins area inside the app… They aren't browser extensions" | Medium |
| Telegram | "My guess is no" | Low-medium |

Its questions back: what a bot's computer can do, and whether it's safe; what models cost; and what hardware it needs.

The new link preview, on its second run:

| Question | What they said | Confidence |
| --- | --- | --- |
| What it is | "An app or service for building your own AI assistants… that you run yourself" | Medium |
| Where it runs | "On my own machine or a server I control, and I reach it through a browser or a phone app" | Medium |
| Models | "'Any model, hosted or local' suggests it works with ChatGPT, Claude, and the like" | Medium-high |
| From a phone | "Open the fxbot app on my phone and connect to the copy running on my own machine. I don't know how the connection or login works" | Low |
| Plugins | "The word isn't on this preview" | Low |

Its questions back: whether setup is technical, what it costs, and what it really does.

Before, the preview's reader read "local first" as local models only, and plugins as browser extensions. The first screen's reader read Tailscale as needed on the phone. None of the new readers did.

**Not checked:** real link previews in iMessage, Discord, and Slack, which keep a cached card for a while; the site on a real phone; and real people. Those are the person's check above.
