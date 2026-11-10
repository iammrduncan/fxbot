# First impressions

What fxbot says it is, in the places people meet it first: the link preview, the home page's first screen, the README, the docs' first page, and the install's last lines. Each should answer, before anyone reads further, what people now ask:
- **What it is:** your own AI assistants, on a machine of yours, which you talk to in fxbot's own app.
- **Which models:** any, hosted or local. Sign in with ChatGPT, add a key for Claude or Gemini, or run one with Ollama.
- **How to reach it:** from any browser, and from your phone, away from home too, in the fxbot app, with web pairing. Tailscale isn't needed, and it's no longer the recommended way in.
- **What plugins are:** features you add to fxbot itself, such as a computer for each bot, routines, and subagents. They aren't browser extensions.
- **What a bot does for you:** tasks named plainly, with the screenshots we already have.

Status: planned on 2026-11-10, not built. Researched the same day:
- the questions people asked the owner after a link to fxbot.sh
- a test of today's link preview and home page on two fresh readers who knew nothing about fxbot
- how OpenClaw, Hermes Agent, Pi, eve, Grok's bot, Muse, and Open WebUI introduce themselves, from their own sites, READMEs, and docs

## What the owner asked

"When sharing fxbot I've gotten two questions that make no sense to me." From a conversation after a link to fxbot.sh's plugins page:
- "So you deploy fxbot and then access it through tailscale to install it like a plugin for the browser?"
- "Any plans for discord or telegram comms?", then, after being told about web pairing, "But that requires tail scale."

And from others: "Does it only work with local models?"

"Our taglines and stuff and first impressions must be wrong, people don't understand what it is or how to use it. People know what hermes is, or open claw, or grokbot, or muse. Why can't they understand fxbot? Use the research directive to better adjust our marketing, docs, and quick starts." And: "people don't read the docs."

Then: "With web pairing, tailscale isn't the recommended way anymore."

## 0. Core or plugin

Neither. Nothing in the app changes. This phase changes words and pictures:
- the site's home page and its meta tags, the plugin directory's opener, and the social card
- the docs' first page, the tutorial, and the guides that call Tailscale the recommended way
- the README, `agent-setup.txt`, and the last lines `setup.sh` prints
- the GitHub repository's description and topics, which the owner sets

All of it is site work, which goes live on a push to `main` with no release ([Site deploys from main](../../README.md#releasing)). `release/0.10.0` holds no app work yet, so it ships to `main` now, and `release/0.10.0` moves along with it.

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
- **The only Mac and Windows line** is the tutorial's "On a Mac or on Windows, use a Linux machine, or a Linux VM." `setup.sh` accepts WSL 2 with systemd, but [operations](../_completed/phases/operations.md) left that unchecked.

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

## 2. Key takeaways

1. **Every product people understand says what it is in its first line, with a category word:** "AI assistant", "AI agent", "agent harness". fxbot's first line, "Your bot, built and configured how you want it," has none. "Bot" alone could be a chat bot, a Discord bot, or a browser bot.
2. **None of them lets "local" stand alone.** Each names hosted and local models in one sentence, as the owner's choice. fxbot's "Local first" means the data is on your machine, but people read it as "local models only," and the description says only local models.
3. **They say how you reach it, by name, on the first screen.** OpenClaw and Hermes name chat apps. fxbot's answer is its own app, from any browser and on your phone through web pairing, and the first screen should say so as plainly. Today it shows Tailscale.
4. **They show tasks, not parts.** "Organizes your inbox, checks you in for flights." fxbot shows "the library" and "releases and updates." fxbot's screenshots already show tasks: a trip plan written as a page, a routine every Monday, three subagents comparing hosts, two bots working together.
5. **A computer of the bot's own is what this kind of product leads with now.** Grok's bot, Muse, and CopilotKit's versions all say it first. fxbot gives each bot one, a desktop the owner watches and takes over, and none of its first impressions mention it. Grok's quickstart ends on a routine, which fxbot has too.
6. **Their FAQs answer "do I need X?" head-on.** fxbot has no FAQ. The questions are known now, and each has a one-line answer.
7. **The quickstart ends on the phone.** OpenClaw: "Want to chat from your phone instead?" fxbot's ends on Tailscale. Its tutorial should end with the phone paired through web pairing, the way the owner already answers in person.
8. **"Plugins" needs examples beside it.** Name what they add, a computer for each bot, routines, subagents, and pages, and say once, in the FAQ, that they're features of fxbot, not browser extensions.
9. **Nobody reads the docs, so the link preview is the product's first page.** The card and the description are what people see in a chat. They have to carry the category, any model, and any device in about 20 words.

## 3. Implementation

### The words

The owner picks the words ([open questions](#5-open-questions)). Recommended:
- **The line, everywhere it's first** (card, hero, README, docs, GitHub): **"Your own AI assistants, on your own machine."**
- **The sentence after it:** "Bots that chat, remember, work on a computer of their own, and run tasks on a schedule. Use any model, hosted or local, and talk to them from any browser or the fxbot app on your phone."
- **Three facts, as a row under the hero:**
  - **Any model:** sign in with ChatGPT or Grok, add a key for Claude, Gemini, or OpenRouter, or run one with Ollama or LM Studio.
  - **On your phone:** the fxbot app, away from home too, with web pairing. No VPN needed. (A network that blocks direct connections needs one of the other ways, as [When a device can't connect](../../packages/website/src/content/docs/docs/how-to/when-a-device-cant-connect.md) says, so the FAQ links there.)
  - **On your machine:** a Linux computer, home server, or VPS. One command installs it.
- **The description** (meta, og, the docs' default): "Your own AI assistants, on your own machine. Use any model, hosted or local, and talk to them from any browser or your phone. Free and open source." That's about 150 characters.
- **"Local first" and "a lean core" leave the first screen.** "On your own machine" says what "local first" meant, with no doubt about models. The lean core stays in "Who it's for" and the docs, for the people it's for.
- **A pitch for the owner to paste** when sharing a link: "fxbot is my own AI assistant app. It runs on my Linux box, and I use it from the browser or the app on my phone, with any model: ChatGPT, Claude, Gemini, or a local one. Each bot gets its own computer, runs routines, and hands big jobs to helpers. Plugins add features like those to the app."

### The home page (`packages/website/src/home.tsx`)

In this order:
1. **The hero:** the crowd, then the line as the H1, then the sentence, then the three facts as a row of three short items, each with a small blob. On a phone they stack.
2. **The install:** the command and the AI-agent prompt, as now. Under them: "v0.9.0 · Linux · Free and open source (Apache-2.0)."
3. **The screenshot:** as now. The address bar reads `127.0.0.1:8787` in place of the tailnet address. The caption says the phone beside it is the fxbot app, paired with web pairing.
4. **"What your bots do"** in place of "What it looks like": the same gallery, each card titled by its task, as the bots in the shots say it. The page shot becomes "Plan a weekend, as a page you keep," and the routine shot, added beside it, "Every Monday, send three design reads." The subagents shot, also added, becomes "Compare three hosts at once, with subagents." "Bots that work together", "Rooms", "You decide what needs asking", and "A look for each bot" keep their shots. "Plugins you pick" becomes "Add what you want: a computer, routines, subagents."
5. **Get started**, in three steps, with no Tailscale:
   1. **Install it:** the command, on a Linux machine.
   2. **Set it up:** open `http://127.0.0.1:8787` on the machine, or over SSH from another computer. Sign in to a model, and make your first bot.
   3. **Put it on your phone:** add **Web pairing** from **Plugins**, and scan its code at web.fxbot.sh. The fxbot app installs from there.
6. **Questions people ask**, new, as a short list with a line or two each, linking to the guide that says more:
   - **Is it a browser extension?** No. fxbot is an app that runs on a machine of yours, and you open it in a browser or as an app on your phone. Plugins add features to fxbot itself.
   - **Does it only work with local models?** No. Sign in with ChatGPT or Grok, use a key from Anthropic, Google, OpenAI, OpenRouter, or about 30 others, or run one locally. Each bot can use a different one.
   - **Does a bot use my computer?** No. With the computer plugin, each bot gets a Linux computer of its own, in a container on your machine, with a desktop you watch and take over.
   - **Do I need Tailscale?** No. Web pairing opens your fxbot from your phone or any computer, at web.fxbot.sh, over a connection straight to it. Tailscale, SSH, and your own proxy also work.
   - **Can I talk to it on Telegram or Discord?** Not yet. fxbot has its own app, which installs on your phone and shows everything a bot does: its pages, its computer, its subagents, and the cards where it asks you first.
   - **Does it run on a Mac or Windows?** Not on their own yet. Use a Linux machine, a small VPS, or a Linux VM. On Windows, WSL 2's Ubuntu with systemd may run it, but nobody has checked yet.
   - **Is there a hosted version, or an account?** No. It runs on your machine, and your bots, chats, files, and keys stay there.
   - **What does it cost?** fxbot is free and open source. You pay your model's provider, use a plan you already have, such as ChatGPT, or nothing with a local model.
7. **What it does:** the feature list, with the computer, routines, and subagents in place of the library and releases, which move to "Who it's for."
8. **Who it's for:** web pairing is the way in from other devices. The Network row becomes "127.0.0.1:8787; from other devices, web pairing, or Tailscale, SSH, or a proxy of your own."
9. **The SDK:** as now.

### Link previews

- **The home page's tags** (`src/pages/index.astro`): the title becomes "fxbot: your own AI assistants, on your own machine". The description becomes the new one, and the image's alt text the card's words.
- **The docs' default description** (`astro.config.mjs`, Starlight's `description`) becomes the same.
- **The plugin directory** (`src/pages/plugins/index.astro`): the title becomes "fxbot plugins". The description and a line at the top of the page say: "Features to add to fxbot, your own AI assistants: a computer for each bot, routines, subagents, pages, rooms, and more."
- **The card** (`public/card.png`): the crowd, the line, then "Any model. Any device. Free and open source." A script draws it from the site's own blob code and font, `scripts/screenshots/card.mjs`, run with `npm run card`, so the card follows the words when they change. It uses the Playwright the screenshots already use. AGENTS.md's Checks gets a line for it.

### Docs, README, and the rest

- **The docs' first page** (`docs/index.mdx`): the line and the sentence, then "From your phone, add web pairing ([Reach fxbot from your phone](/docs/how-to/reach-it-from-your-phone/))."
- **The tutorial** (`tutorials/first-fxbot.md`):
  - Tailscale leaves "You need."
  - The order becomes install, then open it on the machine or over SSH, then set it up, then pair your phone with web pairing.
  - It ends with the bot answering on the phone.
  - Tailscale stays a link, under other ways in.
- **Reach it** (`how-to/reach-it.md`): web pairing comes right after "On the machine itself," as "With web pairing (recommended)." Then SSH, then Tailscale, then the rest. The link to its old Tailscale heading in `how-to/when-a-device-cant-connect.md` follows the new anchor.
- **Security** (`explanation/security.md`): "Through web pairing, the recommended way in, only devices you've paired get in. Through Tailscale, your tailnet's access rules decide." The reasoning about a second login stays.
- **The README:** the line and the sentence, then the three facts. Under "Reaching it," web pairing comes first and Tailscale moves to the other ways.
- **`agent-setup.txt`:** fxbot is "their own AI assistants." "From other devices, such as a phone," leads with web pairing, then Tailscale.
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
    --description "Your own AI assistants, on your own machine. Any model, hosted or local. Use it from any browser or the app on your phone." \
    --add-topic self-hosted --add-topic ai-assistant --add-topic personal-assistant --add-topic llm --add-topic ollama --add-topic pwa
  ```

- **Release posts** (`docs/releases/`, and the format in the prep-release skill's `references/docs.md`): a line under the first one, "fxbot is your own AI assistants, on your own machine," so a post shared on its own says what fxbot is.

### Not in this phase

- **Telegram or Discord.** Every consumer product people compare fxbot with leads with chat apps, and its quickstart ends there. Whether fxbot gets a plugin for them is the owner's call ([open questions](#5-open-questions)). Until then the FAQ answers "Not yet."
- **fxbot on a Mac or Windows itself.** [Mac support](mac-support.md) and [Distribution](distribution.md) plan it. The FAQ says "not on their own yet."
- **Web pairing in Essentials.** The owner took it out in 0.9.0. The phone step names it instead.
- **Renaming plugins,** or any change in the app.

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
- [ ] The line, the sentence, the three facts, and the description are the owner's choice from the open questions, and the same everywhere they appear.
- [ ] No first-impression surface says "Local first," "local-first," or names local models without hosted ones: the card, the meta tags, the home page's first screen, the README's opener, the docs' first page, and GitHub's description.
- [ ] Nothing calls Tailscale recommended or required: `grep -rn -i "recommended" | grep -i tailscale` over `packages/website`, `README.md`, and `setup.sh` finds nothing.
- [ ] Every claim in the FAQ and the facts row is checked against the code: the providers named are in `providers-registry.json`, Windows is named only as unchecked, and web pairing's guide covers the phone step.

The home page:
- [ ] The hero, the facts row, the install line, the screenshot's address bar and caption, the task gallery, the three steps, the FAQ, the features, and the Network row, as above.
- [ ] Looked at, rendered from the build in Chromium, at 1280 and 390 wide, light and dark. Nothing overflows, and the facts row stacks on a phone.

Link previews:
- [ ] `npm run card` writes `card.png`, 1200 by 630, and the card has been looked at.
- [ ] The home page's and the plugin directory's `og:title`, `og:description`, and `og:image` read right in the built HTML.

Docs and the rest:
- [ ] The docs' first page, the tutorial (no Tailscale in "You need," ending on the phone), reach-it (web pairing first, the anchor fixed), and security.
- [ ] The README, `agent-setup.txt`, and `setup.sh`'s last lines. `bash -n setup.sh` passes.
- [ ] The release-notes format has the line saying what fxbot is.
- [ ] `npm run build-site` passes, with every link resolving. `git diff --check` is clean.

Proof:
- [ ] Two fresh readers, given only the new link preview and only the new first screen, as in [the research](#todays-first-impression-on-fresh-readers), with the same questions. Both say, with medium or high confidence, that:
  - it's an AI assistant you run yourself
  - it works with ChatGPT or Claude
  - Tailscale isn't needed
  - the phone uses the fxbot app
  - plugins add features to fxbot, not to a browser
  Their answers go in [What the build changed](#what-the-build-changed).
- [ ] Committed on `release/0.10.0` with `main` moved to it, and the owner has the push command and the `gh repo edit` command.

Only a person can check:
- [ ] The card, in a text to three people who've never heard of fxbot, asking: "What is it, does it work with ChatGPT, and how would you use it from your phone?"

## 5. Open questions

1. **The line.** Recommended: "Your own AI assistants, on your own machine." Others:
   - "AI agents that work for you, on your own machine," in the words of Hermes and of fxbot's own topics
   - keeping "Your bot, built and configured how you want it" as the second line, under the new first one
2. **Name the others?** One FAQ entry, "How is it different from OpenClaw or Hermes Agent?", would say where fxbot sits: the same kind of thing, with its own app in place of chat apps, a computer for each bot, and several bots that work together. People place a new product by the ones they know. Recommended: yes.
3. **Telegram and Discord.** Write a one-page stub, `docs/phases/chat-apps.md`, for a plugin that lets a bot answer in Telegram first ("just a bot token," as OpenClaw puts it), then Discord? Or keep the app as the only way, and let the FAQ say so?
4. **Mac and Windows.** The FAQ says "not on their own yet," with WSL 2 as unchecked. Should someone check WSL 2 on a real Windows machine first, so the facts row can say "Linux, or Windows with WSL 2"? Or leave Windows out of the copy until [Distribution](distribution.md) is built?
5. **Release posts.** Add the line saying what fxbot is under the first line of each post?
