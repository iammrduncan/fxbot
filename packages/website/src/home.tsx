import { cn } from "cn";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { Blob, colorCount, shapeCount } from "./blob.tsx";
import { Command } from "./code.tsx";
import { crowd } from "./crowd.ts";
import { buttonVariants } from "./components/ui/button.tsx";
import { latest } from "./release.ts";
import { Shell } from "./layout.tsx";
import { agentPrompt, changelogPath, href, installCommand, repo } from "./site.ts";

// Three facts under the headline, each answering what people ask first (docs/phases/first-impressions.md).
const facts: { shape: string; color: string; title: string; link: string; body: ReactNode }[] = [
  {
    shape: "sparkle",
    color: "amber",
    title: "Any model",
    link: "/docs/how-to/add-a-provider/",
    body: <>Sign in with ChatGPT, Grok, or OpenRouter, add a key for Claude or Gemini, or run one with Ollama or LM Studio.</>,
  },
  {
    shape: "egg",
    color: "teal",
    title: "On your phone",
    link: "/docs/how-to/reach-it-from-your-phone/",
    body: <>The fxbot app, away from home too, with web pairing. No VPN needed.</>,
  },
  {
    shape: "heart",
    color: "pink",
    title: "Yours",
    link: "/docs/tutorials/first-fxbot/",
    body: <>Free and open source, on your own machine. One command installs it, and your bots, chats, files, and keys stay with you.</>,
  },
];

const features: { shape: string; color: string; title: string; link: string; body: ReactNode }[] = [
  {
    shape: "circle",
    color: "blue",
    title: "Bots and chats",
    link: "/docs/explanation/bots-and-chats/",
    body: (
      <>
        Give each bot a name, instructions, a model, and a look: one of {shapeCount} shapes in {colorCount} colors, with a feeling and things to wear. Its chat streams, survives reloads and restarts, and takes images and text files. It keeps what it learns as memories you can edit, and searches them and its past chats.
      </>
    ),
  },
  {
    shape: "sparkle",
    color: "amber",
    title: "Any model",
    link: "/docs/how-to/add-a-provider/",
    body: <>Sign in with ChatGPT, Grok, OpenRouter, and more, from any device. Or add a key from one of about 30 gateways, labs, and clouds, such as Anthropic, Google, and OpenAI, each walked through, or point at a local server such as Ollama or LM Studio. Each bot can use a different one.</>,
  },
  {
    shape: "squircle",
    color: "purple",
    title: "A computer of its own",
    link: "/docs/how-to/give-bots-a-computer/",
    body: <>Each bot gets a computer of its own on your machine, with a desktop, a browser, and a terminal. Watch it work, and take over when you want.</>,
  },
  {
    shape: "hexagon",
    color: "green",
    title: "Routines",
    link: "/docs/how-to/give-a-bot-a-routine/",
    body: <>Tasks a bot runs on a schedule, such as every morning or every Monday, with everything it has. It tells you in its chat how each one went.</>,
  },
  {
    shape: "flower",
    color: "orange",
    title: "Subagents",
    link: "/docs/how-to/hand-work-to-subagents/",
    body: <>A bot hands big jobs to helpers that dig in the background while you keep talking, and their reports come back together.</>,
  },
  {
    shape: "egg",
    color: "teal",
    title: "On your phone",
    link: "/docs/how-to/reach-it-from-your-phone/",
    body: <>Install fxbot as an app on a phone or a computer. With web pairing, it opens at web.fxbot.sh, away from home too, over a connection straight to your fxbot.</>,
  },
];

const steps: { title: string; command?: string; body: ReactNode }[] = [
  {
    title: "Install it",
    command: installCommand,
    body: (
      <>
        On your computer or a server, one command installs fxbot and its database as containers, with podman or docker, and starts it at <code>http://127.0.0.1:8787</code>. See <a className="underline underline-offset-4" href={href("/docs/tutorials/first-fxbot/")}>what it runs on</a>.
      </>
    ),
  },
  {
    title: "Set it up",
    body: (
      <>
        Open <code>http://127.0.0.1:8787</code> on that machine, or <a className="underline underline-offset-4" href={href("/docs/how-to/reach-it/#over-ssh")}>over SSH</a> from another computer. It walks you through plugins, a model, and your first bot: sign in to an account, add a key, or point at a local model server.
      </>
    ),
  },
  {
    title: "Put it on your phone",
    body: (
      <>
        Add <strong>Web pairing</strong> from <strong>Plugins</strong>, then open web.fxbot.sh on your phone and pair it with the code fxbot shows. Install the app from there, and your bots come with you.{" "}
        <a className="underline underline-offset-4" href={href("/docs/how-to/reach-it-from-your-phone/")}>How</a>
      </>
    ),
  },
];

// The questions people ask after a first look, answered where they'd look.
const questions: { question: string; link?: [string, string]; answer: ReactNode }[] = [
  {
    question: "How is it different from OpenClaw, Hermes Agent, Grok Bot, Muse, Claude Duet, or OpenAI's dots?",
    answer: <>It's the same kind of thing: AI assistants that do real work, with a computer of their own, routines, and helpers. fxbot is the open alternative: free and open source, lighter, fully featured, and made to be good to use. It runs on your own machine, works with any model, and has only what you add.</>,
  },
  {
    question: "Is it a browser extension?",
    link: ["/docs/explanation/core-and-plugins/", "How plugins work"],
    answer: <>No. fxbot is an app that runs on a machine of yours, and you open it in a browser, or as an app on your phone. Plugins add features to fxbot itself.</>,
  },
  {
    question: "Does it only work with local models?",
    link: ["/docs/how-to/add-a-provider/", "Add a provider"],
    answer: <>No. Sign in with ChatGPT or Grok, use a key from Anthropic, Google, OpenAI, OpenRouter, or about 30 others, or run one locally. Each bot can use a different one.</>,
  },
  {
    question: "Does a bot use my computer?",
    link: ["/docs/how-to/give-bots-a-computer/", "Give bots a computer"],
    answer: <>No. With the computer plugin, each bot gets a computer of its own, in a container on your machine, with a desktop and a browser you watch and take over.</>,
  },
  {
    question: "Do I need Tailscale?",
    link: ["/docs/how-to/reach-it/", "Ways to reach it"],
    answer: (
      <>
        No. Web pairing opens your fxbot from your phone or any computer, at web.fxbot.sh, over a connection straight to it. Tailscale, SSH, and a proxy of your own work too, as does a network that{" "}
        <a className="underline underline-offset-4" href={href("/docs/how-to/when-a-device-cant-connect/")}>won't connect directly</a>.
      </>
    ),
  },
  {
    question: "Can I talk to it on Telegram or Discord?",
    answer: <>Not yet. fxbot has its own app, which installs on your phone and shows everything a bot does: its pages, its computer, its subagents, and the cards where it asks you first.</>,
  },
  {
    question: "Is there a hosted version, or an account?",
    answer: <>No. It runs on your machine, and your bots, chats, files, and keys stay there.</>,
  },
  {
    question: "What does it cost?",
    answer: <>fxbot is free and open source. You pay your model's provider, use a plan you already have, such as ChatGPT, or pay nothing with a local model.</>,
  },
];

// A first look at the SDK, as on its overview page.
const sdkSample = `import { createFxbot } from "@fxbot/sdk";

const fxbot = await createFxbot({ databaseUrl, secretKey });
const ollama = await fxbot.providers.add({
  kind: "ollama",
  model: "qwen3:8b",
});
const bot = await fxbot.profiles.create({
  name: "Scout",
  provider: ollama.id,
});

// The reply streams in on fxbot.stream(bot.id).
await fxbot.send(bot.id, {
  text: "Hello!",
  messageId: crypto.randomUUID(),
});`;

// A screenshot from scripts/screenshots, in the theme the page is in. With `phone`, a narrow screen gets the phone's.
// `size` is the shot's own, when it isn't its device's, and `crop` fits it to 16:10, from the top.
const sizes = { desktop: [1280, 800], phone: [390, 844] };
function Shot({ name, alt, phone = false, device = "desktop", size, crop = false, className = "" }: { name: string; alt: string; phone?: boolean; device?: "desktop" | "phone"; size?: [number, number]; crop?: boolean; className?: string }) {
  const [width, height] = size ?? sizes[device];
  return (["light", "dark"] as const).map((theme) => (
    <picture key={theme} className={cn(theme === "light" ? "theme-light" : "theme-dark", className)}>
      {phone && <source media="(max-width: 639px)" srcSet={href(`/shots/${name}-phone-${theme}.png`)} width={390} height={844} />}
      <img src={href(`/shots/${name}-${device}-${theme}.png`)} width={width} height={height} alt={alt} loading="lazy" decoding="async" className={cn("block h-auto w-full", crop && "aspect-[8/5] object-cover object-top")} />
    </picture>
  ));
}

// The gallery under the hero: what a bot does, as the bots in the screenshots do it, each linked to its guide.
const gallery: { name: string; title: string; body: string; link: string; alt: string; phone?: boolean; size?: [number, number]; crop?: boolean }[] = [
  { name: "page", title: "Plan a weekend, as a page you keep", body: "Reports and plans it writes, with boxes you tick, kept in the library.", link: "/docs/how-to/keep-what-a-bot-writes/", alt: "A page called A slow weekend in Lisbon, with a ticked task list", phone: true },
  { name: "subagents", title: "Compare three hosts at once", body: "It hands a big job to subagents that dig in the background, and comes back with what they found.", link: "/docs/how-to/hand-work-to-subagents/", alt: "Atlas's chat: three subagents started, Curie, Hopper, and Turing, each at work, and the bot's panel listing them under Subagents, 3 working" },
  { name: "together", title: "Bots that work together", body: "One bot asks another, and you watch it happen in their chats.", link: "/docs/how-to/let-bots-work-together/", alt: "Sprout's chat, with pills for the message it sent Atlas and the answer it got" },
  { name: "routine", title: "Every Monday, three design reads", body: "Tasks it runs on a schedule, telling you in its chat.", link: "/docs/how-to/give-a-bot-a-routine/", alt: "Pixel's chat: the owner asks for design reading every Monday, and the routine is added, with Remove", size: [1024, 800], crop: true },
  { name: "room", title: "Rooms", body: "Several bots in one chat. Tag the ones you want.", link: "/docs/how-to/talk-in-a-room/", alt: "A chat room called Garden party, where Pixel and Sprout answer the owner", phone: true },
  { name: "approval", title: "You decide what needs asking", body: "A bot waits at a card for what you want to see first.", link: "/docs/how-to/choose-what-a-bot-can-do-alone/", alt: "A card in Rook's chat asking to add a routine, with Approve once, Always allow, and Deny" },
  { name: "diagram", title: "Draw it as a diagram", body: "Diagrams it writes draw in the chat, in the app's own colors.", link: "/docs/how-to/draw-diagrams-in-chat/", alt: "Pixel's chat: a flowchart of an order's journey, from Order placed through Paid? to the customer's door, drawn in the reply" },
  { name: "look", title: "A look for each bot", body: "32 shapes, a feeling, and things to wear, drawn as you pick.", link: "/docs/explanation/bots-and-chats/", alt: "The New bot screen, with a green bunny in a beanie and the Shape tab open", phone: true },
  { name: "plugins", title: "Add what you want them to do", body: "A computer of their own, routines, subagents, pages, and more, as plugins. Start with Essentials.", link: "/docs/how-to/add-a-plugin/", alt: "The Plugins screen, on Browse, with Essentials at the top", phone: true },
];

function SectionTitle({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <div className="max-w-2xl">
      <p className="text-sm font-medium text-muted-foreground">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h2>
      {children && <p className="mt-4 text-lg text-pretty text-muted-foreground">{children}</p>}
    </div>
  );
}

export function Home() {
  return (
    <Shell>
      <main>
        <section className="mx-auto max-w-6xl px-4 pt-12 sm:px-6 sm:pt-20">
          <div className="crowd flex max-w-xl items-end gap-2 sm:gap-3">
            {crowd.map((blob) => (
              <Blob key={blob.shape} {...blob} follow={!blob.busy} />
            ))}
          </div>
          <h1 className="mt-8 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
            AI assistants that do real work. <span className="block text-muted-foreground">Built your way.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-pretty text-muted-foreground sm:text-xl">
            Each one chats, remembers, works on a computer of its own, and runs tasks on a schedule. Pick its model, hosted or local, its look, and what it can do, and talk to it from any browser or the fxbot app on your phone.
          </p>
          <ul className="mt-8 grid max-w-4xl gap-4 sm:grid-cols-3">
            {facts.map((fact) => (
              <li key={fact.title}>
                <a href={href(fact.link)} className="group flex h-full gap-3 rounded-xl border p-4 transition-colors hover:bg-muted/40">
                  <Blob shape={fact.shape} color={fact.color} size={32} follow />
                  <span className="grid content-start gap-1">
                    <span className="font-semibold">{fact.title}</span>
                    <span className="text-sm leading-6 text-pretty text-muted-foreground">{fact.body}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-8 max-w-2xl">
            <Command>{installCommand}</Command>
            <p className="mt-4 mb-2 text-sm text-muted-foreground">Or ask your AI agent to set it up:</p>
            <Command wrap>{agentPrompt}</Command>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {latest.version && (
              <>
                <a className="underline-offset-4 hover:text-foreground hover:underline" href={href(changelogPath)}>
                  v{latest.version}
                </a>
                {" · "}
              </>
            )}
            Free and open source (Apache-2.0)
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <a href={href("/docs/")} className={cn(buttonVariants({ size: "lg" }), "px-4")}>
              Read the docs
              <ArrowRight aria-hidden="true" data-icon="inline-end" />
            </a>
            <a href={repo} className={cn(buttonVariants({ variant: "outline", size: "lg" }), "px-4")}>
              Source on GitHub
            </a>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pt-14 sm:px-6 sm:pt-20">
          <figure>
            <div className="overflow-hidden rounded-xl border bg-card shadow-[0_24px_60px_-28px_rgb(0_0_0/0.35)]">
              <div className="flex items-center gap-3 border-b bg-muted/50 px-3 py-2">
                <span aria-hidden="true" className="flex gap-1.5">
                  <span className="size-2.5 rounded-full bg-foreground/15" />
                  <span className="size-2.5 rounded-full bg-foreground/15" />
                  <span className="size-2.5 rounded-full bg-foreground/15" />
                </span>
                <span className="mx-auto truncate rounded-md bg-background px-3 py-0.5 font-mono text-xs text-muted-foreground">127.0.0.1:8787</span>
                <span aria-hidden="true" className="w-[42px]" />
              </div>
              <Shot name="hero" alt="fxbot in a desktop browser: Juniper's chat, with a page it wrote, and the other bots in the sidebar" />
            </div>
            <div className="relative">
              <div className="absolute right-6 -bottom-6 hidden w-52 overflow-hidden rounded-[2rem] border-4 border-foreground/80 bg-card shadow-[0_24px_60px_-20px_rgb(0_0_0/0.45)] lg:block xl:w-60">
                <Shot name="hero" device="phone" alt="The same chat on a phone, in the fxbot app" />
              </div>
            </div>
            <figcaption className="mt-3 text-sm text-muted-foreground lg:max-w-[calc(100%-18rem)]">Juniper's chat in a browser, and in the fxbot app on a phone, paired with web pairing. The bots, and everything they say, are made up for these pictures.</figcaption>
          </figure>
        </section>

        <section className="mx-auto max-w-6xl px-4 pt-20 sm:px-6 sm:pt-28">
          <SectionTitle eyebrow="In use" title="What your assistants do" />
          <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {gallery.map((shot) => (
              <li key={shot.name}>
                <a href={href(shot.link)} className="group grid gap-3">
                  <div className="overflow-hidden rounded-xl border bg-card shadow-sm transition group-hover:shadow-md">
                    <Shot name={shot.name} alt={shot.alt} phone={shot.phone} size={shot.size} crop={shot.crop} />
                  </div>
                  <div>
                    <h3 className="flex items-center gap-1.5 font-semibold">
                      {shot.title}
                      <ArrowRight aria-hidden="true" className="size-4 -translate-x-1 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-60" />
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-pretty text-muted-foreground">{shot.body}</p>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className="mx-auto max-w-6xl px-4 pt-20 sm:px-6 sm:pt-28">
          <SectionTitle eyebrow="Get started" title="From one command to your phone" />
          <ol className="mt-10 grid gap-4 lg:grid-cols-2">
            {steps.map((step, i) => (
              <li key={step.title} className={cn("flex min-w-0 gap-4 rounded-xl border p-5", step.command && "lg:col-span-2")}>
                <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
                  {i + 1}
                </span>
                <div className="grid min-w-0 flex-1 grid-cols-1 content-start gap-3">
                  <h3 className="font-semibold">{step.title}</h3>
                  {step.command && <Command>{step.command}</Command>}
                  <p className="text-sm leading-6 text-pretty text-muted-foreground">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-8 flex flex-wrap gap-2">
            <a href={href("/docs/tutorials/first-fxbot/")} className={cn(buttonVariants({ size: "lg" }), "px-4")}>
              The tutorial: your first fxbot
              <ArrowRight aria-hidden="true" data-icon="inline-end" />
            </a>
            <a href={href("/docs/")} className={cn(buttonVariants({ variant: "outline", size: "lg" }), "px-4")}>
              All the docs
            </a>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pt-20 sm:px-6 sm:pt-28">
          <SectionTitle eyebrow="Questions" title="What people ask first" />
          <dl className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2">
            {questions.map((item) => (
              <div key={item.question}>
                <dt className="font-semibold text-pretty">{item.question}</dt>
                <dd className="mt-2 text-sm leading-6 text-pretty text-muted-foreground">
                  {item.answer}
                  {item.link && (
                    <>
                      {" "}
                      <a className="text-foreground underline underline-offset-4" href={href(item.link[0])}>
                        {item.link[1]}
                      </a>
                    </>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mx-auto max-w-6xl px-4 pt-20 sm:px-6 sm:pt-28">
          <SectionTitle eyebrow="What it does" title="Bots you keep talking to">
            Each bot is a profile with one long-running chat. The core stays small, and the rest comes as plugins you pick, most of them in Essentials. All of this ships in the current release.
          </SectionTitle>
          <ul className="mt-10 grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <li key={feature.title} className="bg-background">
                <a href={href(feature.link)} className="group flex h-full flex-col gap-3 p-6 transition-colors hover:bg-muted/40">
                  <Blob shape={feature.shape} color={feature.color} size={40} follow />
                  <h3 className="flex items-center gap-1.5 font-semibold">
                    {feature.title}
                    <ArrowRight aria-hidden="true" className="size-4 -translate-x-1 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-60" />
                  </h3>
                  <p className="text-sm leading-6 text-pretty text-muted-foreground">{feature.body}</p>
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className="mx-auto grid max-w-6xl gap-10 px-4 pt-20 sm:px-6 sm:pt-28 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-16">
          <div>
            <SectionTitle eyebrow="Who it's for" title="People who run their own machine" />
            <div className="mt-5 grid max-w-2xl gap-4 text-pretty text-muted-foreground">
              <p>
                fxbot is for one person with a machine of their own: the computer under the desk, a home server, or a small VPS. It listens on loopback and has no login of its own, so whatever you put in front of it decides who reaches it, and everyone who does sees every bot and every chat. From your phone and other devices,{" "}
                <a className="text-foreground underline underline-offset-4" href={href("/docs/how-to/reach-it-from-your-phone/")}>
                  web pairing
                </a>{" "}
                is the recommended way in.
              </p>
              <p>There is no hosted version and no account to make. Bots, chats, files, and keys are stored on your machine. Each message goes to the provider its bot uses, or stays on your network with a local model server.</p>
            </div>
          </div>
          <dl className="grid content-start gap-px overflow-hidden rounded-xl border bg-border text-sm">
            {(
              [
                [
                  "Machine",
                  <>
                    Your computer, a home server, or a small VPS:{" "}
                    <a className="underline underline-offset-4" href={href("/docs/tutorials/first-fxbot/")}>
                      what it runs on
                    </a>
                  </>,
                ],
                ["Runtime", "podman or docker, which setup.sh installs when neither is there"],
                ["Records", "Postgres with pgvector, in a container, with every key and token sealed"],
                ["Agents", "libfx, one agent per provider"],
                ["Files", "One library of every file the chats hold, searched across every bot"],
                ["Updates", "From Settings, with a backup first, and the release before when one doesn't start"],
                ["Network", "127.0.0.1:8787; from other devices, web pairing, or Tailscale, SSH, or a proxy of your own"],
              ] as [string, ReactNode][]
            ).map(([term, detail]) => (
              <div key={term} className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3 bg-background px-4 py-3">
                <dt className="font-medium">{term}</dt>
                <dd className="text-muted-foreground">{detail}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center">
          <div>
            <SectionTitle eyebrow="Build your own" title="Your app, on fxbot's SDK">
              fxbot runs on <code className="rounded-md bg-muted px-1.5 py-0.5 text-[0.85em]">@fxbot/sdk</code>, and your app can too: a chat in a terminal, a bot on a messaging service, or a page of your own design, with the same bots, providers, tools, and memories.
            </SectionTitle>
            <div className="mt-8 flex flex-wrap gap-2">
              <a href={href("/sdk/tutorials/terminal-chat/")} className={cn(buttonVariants({ size: "lg" }), "px-4")}>
                The tutorial: a terminal chat
                <ArrowRight aria-hidden="true" data-icon="inline-end" />
              </a>
              <a href={href("/sdk/")} className={cn(buttonVariants({ variant: "outline", size: "lg" }), "px-4")}>
                The SDK
              </a>
            </div>
          </div>
          <Command>{sdkSample}</Command>
        </section>
      </main>
    </Shell>
  );
}
