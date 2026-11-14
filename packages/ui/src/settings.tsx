import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { BrainIcon, InfoIcon, KeyRoundIcon, PuzzleIcon, SlidersHorizontalIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { Plugin, Profile, Provider, Settings } from "@fxbot/sdk/client";
import { client } from "./client.ts";
import { Header } from "./header.tsx";
import { TeamMemories } from "./memories.tsx";
import { MemorySearch } from "./memory-search.tsx";
import { follow } from "./nav.ts";
import { PluginIcon } from "./plugin-icon.tsx";
import { PluginPart, usePluginSettings } from "./plugins.tsx";
import { PluginTab, pluginTab, useInstalled } from "./plugins-page.tsx";
import { ModelField, Providers } from "./providers.tsx";
import { install, standalone, useInstall } from "./pwa.ts";
import { Version } from "./release.tsx";

type Tab = { tab: string; label: string; Icon?: ComponentType; iconKey?: string };
// The core's tabs. Each installed plugin gets one after Plugins, and About comes last.
const core: Tab[] = [
  { tab: "", label: "General", Icon: SlidersHorizontalIcon },
  { tab: "providers", label: "Providers", Icon: KeyRoundIcon },
  { tab: "memory", label: "Memory", Icon: BrainIcon },
  { tab: "plugins", label: "Plugins", Icon: PuzzleIcon },
];
const about: Tab = { tab: "about", label: "About", Icon: InfoIcon };
const idleChoices: [number, string][] = [
  [0, "Off"],
  [15, "After 15 minutes"],
  [30, "After 30 minutes"],
  [60, "After 1 hour"],
  [120, "After 2 hours"],
];
const sizeChoices: [number, string][] = [
  [5_000, "Over 5,000 tokens"],
  [10_000, "Over 10,000 tokens"],
  [20_000, "Over 20,000 tokens"],
  [30_000, "Over 30,000 tokens"],
  [50_000, "Over 50,000 tokens"],
  [100_000, "Over 100,000 tokens"],
];
const tokensLabel = (n: number) => `Over ${n.toLocaleString("en-US")} tokens`;
// A plugin's tab is named for it: computer is Computer, and chat-rooms is Chat rooms. A server's name is its address.
const labelOf = (addon: Plugin) => (addon.kind === "mcp" ? addon.name : addon.name.charAt(0).toUpperCase() + addon.name.slice(1).replace(/-/g, " "));
// Every zone the browser knows, and the one set, should the browser not list it.
const zones = (set: string) => [...new Set([...(set ? [set] : []), ...Intl.supportedValuesOf("timeZone")])].sort();
const repository = "https://github.com/iammrduncan/fxbot";
const links = [
  ["fxbot.sh", "https://fxbot.sh"],
  ["Docs", "https://fxbot.sh/docs/"],
  ["Changelog", "https://fxbot.sh/docs/reference/changelog/"],
  ["Source code", repository],
];

// Settings, in tabs, each at its own address: /settings is General, a plugin's is /settings/plugins/<plugin>, and
// About is last. `tab` is what follows /settings/. An address no tab has shows the tabs over an empty pane, as a
// plugin's does until the list of plugins loads.
export function SettingsScreen({ tab, profiles }: { tab: string; profiles: Profile[] | null }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState("");
  useEffect(() => void client.settings.get().then(setSettings, (e: Error) => setError(e.message)), []);
  const save = (fields: Partial<Settings>) =>
    client.settings.update(fields).then(
      (saved) => (setSettings(saved), setError("")),
      (e: Error) => setError(e.message),
    );
  const installed = useInstalled();
  const drawn = usePluginSettings();
  const plugins = (installed.addons ?? []).filter((addon) => !installed.owned.has(addon.id));
  const tabs: Tab[] = [...core, ...plugins.map((addon) => ({ tab: pluginTab(addon), label: labelOf(addon), iconKey: addon.iconKey })), about];

  // On a phone the tabs are a row that scrolls sideways, kept with the open one in view. Newer browsers' scrollIntoView
  // returns a promise, which an effect must not.
  const nav = useRef<HTMLElement>(null);
  useEffect(() => void nav.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "nearest" }), [tab, plugins.length]);

  const plugin = plugins.find((addon) => tab === pluginTab(addon));
  let content: ReactNode = null;
  if (tab === "")
    content = (
      <>
        <General />
        {settings && (
          <label className="grid gap-1.5 text-sm font-medium">
            Default bot
            <NativeSelect value={settings.defaultProfile} onChange={(e) => save({ defaultProfile: e.target.value })} className="w-full">
              <NativeSelectOption value="">None</NativeSelectOption>
              {profiles?.map((p) => (
                <NativeSelectOption key={p.id} value={p.id}>
                  {p.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <span className="font-normal text-muted-foreground">fxbot opens to this bot's chat when it starts at its address.</span>
          </label>
        )}
        {settings && (
          <label className="grid gap-1.5 text-sm font-medium">
            Time zone
            <NativeSelect value={settings.timeZone} onChange={(e) => save({ timeZone: e.target.value })} className="w-full">
              {zones(settings.timeZone).map((zone) => (
                <NativeSelectOption key={zone} value={zone}>
                  {zone}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <span className="font-normal text-muted-foreground">Bots' schedules use this.</span>
          </label>
        )}
        {settings && (
          <label className="grid gap-1.5 text-sm font-medium">
            Turns at once
            <Input
              key={settings.turnsAtOnce}
              type="number"
              min={4}
              max={100}
              defaultValue={settings.turnsAtOnce}
              className="w-24"
              onBlur={(e) => Number(e.target.value) !== settings.turnsAtOnce && save({ turnsAtOnce: Number(e.target.value) })}
            />
            <span className="font-normal text-muted-foreground">How many bots can work at the same time. One waiting on a long command holds its place. This takes effect the next time fxbot starts.</span>
          </label>
        )}
        {settings && <IdleCompaction settings={settings} save={save} />}
      </>
    );
  else if (tab === "providers")
    content = settings && (
      <>
        <Providers defaultProvider={settings.defaultProvider} onDefault={(defaultProvider) => save({ defaultProvider })} />
        <p className="text-sm text-muted-foreground">New bots start on the default provider, with its default model.</p>
      </>
    );
  else if (tab === "memory")
    content = (
      <>
        <TeamMemories profiles={profiles} />
        <MemorySearch />
      </>
    );
  else if (tab === "plugins")
    content = settings && (
      <section className="grid gap-3" aria-label="Plugins">
        <label className="flex items-center justify-between gap-3 text-sm font-medium">
          Show unvetted plugins
          <Switch checked={settings.unvetted} onCheckedChange={(unvetted) => save({ unvetted })} />
        </label>
        <p className="text-sm text-muted-foreground">
          fxbot shows the plugins it vets, tagged fxbot. Turn this on to also browse GitHub's MCP registry and skills.sh, and to add any MCP server by its address or any plugin by its repository. fxbot doesn't vet those: read what each one does before you add it.
        </p>
        <p className="text-sm text-muted-foreground">
          Add plugins in{" "}
          <a href="/plugins" onClick={follow} className="text-foreground underline underline-offset-4">
            Plugins
          </a>
          . Each one you add gets a tab here, with its settings.
        </p>
      </section>
    );
  else if (tab === "about") content = <About />;
  else if (plugin)
    content = (
      <PluginTab key={plugin.id} addon={plugin} installed={installed} profiles={profiles}>
        {drawn
          .find(({ name }) => name === plugin.name)
          ?.parts.map((Part, i) => (
            <PluginPart key={i} plugin={plugin.name}>
              <Part />
            </PluginPart>
          ))}
      </PluginTab>
    );

  return (
    <>
      <Header title="Settings" />
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <nav ref={nav} aria-label="Settings" className="flex shrink-0 gap-1 overflow-x-auto border-b px-3 pb-2 [scrollbar-width:none] lg:w-48 lg:flex-col lg:overflow-visible lg:border-b-0 lg:py-6">
          {tabs.map(({ tab: to, label, Icon, iconKey }) => (
            <a
              key={to}
              href={to ? `/settings/${to}` : "/settings"}
              onClick={follow}
              aria-current={to === tab ? "page" : undefined}
              className={buttonVariants({ variant: "ghost", size: "sm", className: "shrink-0 justify-start rounded-full text-muted-foreground aria-[current=page]:bg-accent aria-[current=page]:text-foreground lg:rounded-md" })}
            >
              {Icon ? <Icon /> : iconKey && <PluginIcon iconKey={iconKey} size={16} />}
              {label}
            </a>
          ))}
        </nav>
        <main className="min-w-0 flex-1 overflow-y-auto px-4 py-6">
          <div className="mx-auto grid max-w-xl gap-5">
            {(error || installed.error) && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error || installed.error}</p>}
            {content}
          </div>
        </main>
      </div>
    </>
  );
}

// Installing fxbot as an app: the browser's prompt, Safari's steps, or that it already is one.
function General() {
  const installing = useInstall();
  if (standalone) return <p className="text-sm text-muted-foreground">fxbot runs as an app on this device.</p>;
  if (installing === "prompt")
    return (
      <div className="flex items-center gap-3 rounded-xl border p-3 text-sm">
        <p className="flex-1">Install fxbot as an app on this device.</p>
        <Button onClick={install}>Install</Button>
      </div>
    );
  if (installing === "steps") return <p className="rounded-xl border p-3 text-sm">To install fxbot, tap Share, then Add to Home Screen, and leave Open as Web App on.</p>;
  return <p className="text-sm text-muted-foreground">fxbot can run as an app of its own: install it from the browser's menu, where the browser offers it.</p>;
}

// The version and updates, then where fxbot lives, and its license.
function About() {
  return (
    <>
      <Version />
      <nav aria-label="About fxbot" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {links.map(([label, href]) => (
          <a key={href} href={href} target="_blank" rel="noreferrer" className="underline underline-offset-4">
            {label}
          </a>
        ))}
      </nav>
      <p className="text-sm text-muted-foreground">
        <a href={`${repository}/blob/main/LICENSE`} target="_blank" rel="noreferrer" className="underline underline-offset-4">
          Apache License 2.0
        </a>
      </p>
    </>
  );
}

// Idle compaction: how long a bot's chat sits idle before it's summarized, how long it must be, and the model that
// writes the summary, each bot's own or one the owner picks. A time or size set some other way shows as itself.
function IdleCompaction({ settings, save }: { settings: Settings; save: (fields: Partial<Settings>) => Promise<unknown> }) {
  const [providers, setProviders] = useState<Provider[]>([]);
  useEffect(() => void client.providers.list().then(setProviders, () => {}), []);
  // A provider with no default model waits here for its model, and the two are saved together.
  const [picked, setPicked] = useState("");
  const shown = picked || settings.compactProvider;
  function pick(id: string) {
    if (id && !providers.find((p) => p.id === id)?.model) return setPicked(id);
    setPicked("");
    void save({ compactProvider: id });
  }
  const minutes = settings.idleCompactMinutes;
  const choices = idleChoices.some(([m]) => m === minutes) ? idleChoices : [...idleChoices, [minutes, `After ${minutes} minutes`] as [number, string]];
  const tokens = settings.idleCompactTokens;
  const sizes = sizeChoices.some(([n]) => n === tokens) ? sizeChoices : [...sizeChoices, [tokens, tokensLabel(tokens)] as [number, string]].sort((a, b) => a[0] - b[0]);
  return (
    <div className="grid gap-3">
      <label className="grid gap-1.5 text-sm font-medium">
        Idle compaction
        <NativeSelect value={String(minutes)} onChange={(e) => save({ idleCompactMinutes: Number(e.target.value) })} className="w-full">
          {choices.map(([value, label]) => (
            <NativeSelectOption key={value} value={String(value)}>
              {label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <span className="font-normal text-muted-foreground">A long chat that sits idle is summarized, so your next message starts fast. The chat shows where it happened.</span>
      </label>
      {minutes > 0 && (
        <label className="grid gap-1.5 text-sm font-medium">
          Only chats
          <NativeSelect value={String(tokens)} onChange={(e) => save({ idleCompactTokens: Number(e.target.value) })} className="w-full">
            {sizes.map(([value, label]) => (
              <NativeSelectOption key={value} value={String(value)}>
                {label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <span className="font-normal text-muted-foreground">A shorter chat is left as it is, since it starts fast anyway. Counted from its text, at about 4 characters a token.</span>
        </label>
      )}
      {minutes > 0 && (
        <label className="grid gap-1.5 text-sm font-medium">
          Summarize with
          <NativeSelect value={shown} onChange={(e) => pick(e.target.value)} className="w-full">
            <NativeSelectOption value="">Each bot's own model</NativeSelectOption>
            {providers.map((p) => (
              <NativeSelectOption key={p.id} value={p.id}>
                {p.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
      )}
      {minutes > 0 && shown && (
        <label className="grid gap-1.5 text-sm font-medium">
          Model
          <ModelField
            id="compact"
            provider={shown}
            value={picked ? "" : settings.compactModel}
            onChange={(compactModel) => void (picked ? save({ compactProvider: picked, compactModel }).then(() => setPicked("")) : save({ compactModel }))}
          />
          <span className="font-normal text-muted-foreground">
            {picked ? "Pick the model that writes the summary. " : ""}A cheaper model saves money. When a chat is longer than it takes, the bot's own model writes the summary.
          </span>
        </label>
      )}
    </div>
  );
}
