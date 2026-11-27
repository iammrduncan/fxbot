import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { Component, createContext, lazy, Suspense, useContext, useMemo, useSyncExternalStore, type ComponentProps, type ComponentType, type ReactNode } from "react";
import { defaultComponents, Streamdown, type Components, type ExtraProps } from "streamdown";
import { createPortal } from "react-dom";
import * as attachment from "@/components/ui/attachment";
import * as badge from "@/components/ui/badge";
import * as bubble from "@/components/ui/bubble";
import * as button from "@/components/ui/button";
import * as checkbox from "@/components/ui/checkbox";
import * as dialog from "@/components/ui/dialog";
import * as empty from "@/components/ui/empty";
import * as input from "@/components/ui/input";
import { InputGroupTextarea } from "@/components/ui/input-group";
import * as message from "@/components/ui/message";
import * as nativeSelect from "@/components/ui/native-select";
import * as popover from "@/components/ui/popover";
import * as scroller from "@/components/ui/message-scroller";
import * as sidebar from "@/components/ui/sidebar";
import * as switches from "@/components/ui/switch";
import * as textarea from "@/components/ui/textarea";
import { applyLine, type LibraryItem, type Part, type Profile } from "@fxbot/sdk/client";
import { Blob } from "./blob.tsx";
import { ModelField } from "./providers.tsx";
import { client } from "./client.ts";
import { Header } from "./header.tsx";
import { followBeside, go, openBeside } from "./nav.ts";
import { PluginIcon } from "./plugin-icon.tsx";
import { useReorder } from "./reorder.ts";
import { breaks, code } from "./said.ts";
import { Reply } from "./steps.tsx";

// Plugins' page code, loaded the way opencode loads it: the server serves each running plugin's prebuilt CommonJS
// bundle, and the page runs it with a `require` that hands over the app's own React, its ProseMirror, and
// `@fxbot/app`, so there is one copy of each. Its default export is called with the app's API, scoped to it, and each
// part it adds sits in an error boundary. With no plugins, nothing here fetches or runs any code.

export type ToolCall = Extract<Part, { type: "tool" }>;
// setDraft takes the new text, or a function from the draft to it, as React's setters do.
export type ComposerProps = { bot: Profile; setDraft: (text: string | ((draft: string) => string)) => void; attach: (files: File[]) => void };
// What a plugin folds into a pill: a message by its id, with the turn it starts or alone, and the bot it's from, and a
// tool call that sends one, with the bot it went to.
export type Fold = {
  message?: (id: string) => { fold: "turn" | "message"; bot?: string } | void;
  tool?: (call: ToolCall) => { bot?: string; name?: string } | void;
};
// A fenced code block a plugin draws: its text, its language, what follows the language on the fence, and whether the
// fence is still open, as it is while a reply streams.
export type CodeBlockProps = { code: string; language: string; meta?: string; incomplete: boolean };
type Nav = { label: string; path: string; icon?: ComponentType<{ className?: string }> };
// What a plugin offers a box's @ list, as herdr offers its agents: up to 8 choices for what follows the @, for the bot
// whose box it is. `name` shows, and a pick is written `[@name](link "title")`, which a bot reads.
export type MentionChoice = { key: string; name: string; link: string; title?: string; detail?: string };
export type Mention = { search: (query: string, bot?: Profile) => MentionChoice[] | Promise<MentionChoice[]> };
type Places = {
  // `beside`: a screen, such as a room, that shows other plugins' screens beside it, as a bot's chat does (beside.tsx).
  routes: { path: string; parts: string[]; Component: ComponentType<{ params: Record<string, string> }>; beside: boolean }[];
  sidebar: ComponentType[];
  nav: Nav[];
  composer: ComponentType<ComposerProps>[];
  toolViews: Map<string, { View: ComponentType<{ call: ToolCall }>; open: boolean }>;
  settings: ComponentType[];
  botSettings: ComponentType<{ bot: Profile }>[];
  botPanel: ComponentType<{ bot: Profile }>[];
  libraryItem: ComponentType<{ item: LibraryItem }>[];
  chat: ComponentType<{ bot: Profile; reload: () => void }>[];
  // In a bot chat's header, left of the bot panel's button, such as phone's calls.
  header: ComponentType<{ bot: Profile }>[];
  box: ComponentType<any>[];
  fold: Fold[];
  said: { pattern: RegExp; Component: ComponentType<{ match: RegExpMatchArray }> }[];
  mentions: Mention[];
  codeBlocks: { language: string; Component: ComponentType<CodeBlockProps> }[];
  // Places other plugins leave with Slot, by name, such as `chat-rooms.room-header`.
  slots: Map<string, ComponentType<any>[]>;
};
// `key` is the URLs it loaded from, which change with its files.
type Loaded = { name: string; iconKey: string; key: string; css?: HTMLLinkElement; places: Places; pageError?: string };

const emptyPlaces = (): Places => ({ routes: [], sidebar: [], nav: [], composer: [], toolViews: new Map(), settings: [], botSettings: [], botPanel: [], libraryItem: [], chat: [], header: [], box: [], fold: [], said: [], mentions: [], codeBlocks: [], slots: new Map() });

// The loaded plugins, by name. A change makes a new array, which the places read through usePlugins.
let loaded: Loaded[] = [];
const listeners = new Set<() => void>();
const publish = (next: Loaded[]) => ((loaded = next), listeners.forEach((listener) => listener()));
const subscribe = (listener: () => void) => (listeners.add(listener), () => listeners.delete(listener));
export const usePlugins = () => useSyncExternalStore(subscribe, () => loaded);

// ProseMirror, the formatting, the app's box, and the format bar (formatting-kit.ts): a chunk of their own, fetched as
// the page starts, beside the plugins' bundles, so it's there before a box or a plugin's code needs it.
type Kit = typeof import("./formatting-kit.ts");
let kit: Promise<Kit> | null = null;
export const formattingKit = () => (kit ??= import("./formatting-kit.ts"));
void formattingKit().catch(() => (kit = null));
const Editor = lazy(() => formattingKit().then((loaded) => ({ default: loaded.Editor })));
export const FormatBar = lazy(() => formattingKit().then((loaded) => ({ default: loaded.FormatBar })));
export const FormatButton = lazy(() => formattingKit().then((loaded) => ({ default: loaded.FormatButton })));

// The bots, for `useBots`: the app's own list.
const BotsContext = createContext<Profile[] | null>(null);
export const BotsProvider = BotsContext.Provider;
export const useAppBots = () => useContext(BotsContext);

// Built when a plugin loads, after every module of the page has.
const ui = (pm: Kit | null) => ({
  ...attachment,
  ...badge,
  ...bubble,
  ...button,
  ...checkbox,
  ...dialog,
  ...empty,
  ...input,
  ...message,
  ...nativeSelect,
  ...popover,
  ...scroller,
  ...sidebar,
  ...switches,
  ...textarea,
  Streamdown: Markdown,
  Header,
  Blob,
  PluginIcon,
  Reply,
  ModelField,
  useReorder,
  ...(pm ? { FormatBar: pm.FormatBar, FormatButton: pm.FormatButton } : {}),
});

const formattingFor = ({ nodes, marks, plugins, toMarkdown, fromMarkdown, offsetOf, posOf, ownsKey, isEmpty }: Kit["formatting"]) => ({
  nodes,
  marks,
  plugins,
  toMarkdown,
  fromMarkdown,
  offsetOf,
  posOf,
  ownsKey,
  isEmpty,
  breaks,
});

// `@fxbot/app` for one plugin: the client, its own routes, the app's navigation and bots, the app's components, and
// the formatting a message box does, for a plugin's own box.
function appModule(name: string, pm: Kit | null) {
  return {
    client,
    applyLine,
    api: (path: string, init?: RequestInit) => fetch(`/api/plugins/${name}/${path.replace(/^\//, "")}`, init),
    go,
    // A path opened beside the chat when one is showing, such as a page from a card in a reply, so the chat stays.
    // Anywhere else, or for a path that isn't a plugin's screen, it's go.
    openBeside,
    useBots: useAppBots,
    // Every plugin's @ sources, with its name and icon, for a box that lists them.
    useMentions: () => usePlugins().flatMap(({ name, iconKey, places }) => places.mentions.map((source) => ({ ...source, plugin: name, iconKey }))),
    // React's, for a plugin that draws a component into DOM it doesn't render, such as an editor's node.
    createPortal,
    // A place in this plugin's page that other plugins fill with app.slot(name, Component), each part in its own
    // error boundary. One nobody fills draws nothing.
    Slot: ({ name, props }: { name: string; props?: Record<string, unknown> }) => <Place pick={(places) => places.slots.get(name) ?? []} props={props ?? {}} />,
    ui: ui(pm),
    // What the plugin API lists of the box's formatting, and nothing more.
    ...(pm ? { formatting: formattingFor(pm.formatting) } : {}),
  };
}

// Runs one plugin's bundle, and keeps what its setup adds.
async function run(name: string, version: string, url: string, pm: Kit | null): Promise<Places> {
  const source = await (await fetch(url)).text();
  const places = emptyPlaces();
  const app = appModule(name, pm);
  const require = (id: string) => {
    if (id === "react") return React;
    if (id === "react/jsx-runtime") return jsxRuntime;
    if (id === "@fxbot/app") return app;
    if (pm && id in pm.modules) return pm.modules[id];
    throw new Error(`${name} asked for ${id}, which fxbot doesn't give plugins. Bundle it in.`);
  };
  const module: { exports: unknown } = { exports: {} };
  new Function("require", "module", "exports", source)(require, module, module.exports);
  const setup = typeof module.exports === "function" ? module.exports : (module.exports as { default?: unknown }).default;
  if (typeof setup !== "function") throw new Error(`${name}'s page code exports no function.`);
  setup({
    name,
    version,
    route: (path: string, Component: Places["routes"][number]["Component"], options?: { beside?: boolean }) =>
      places.routes.push({ path, parts: path.split("/").filter(Boolean), Component, beside: options?.beside === true }),
    sidebar: (Component: ComponentType) => places.sidebar.push(Component),
    nav: (nav: Nav) => places.nav.push(nav),
    composer: (Component: ComponentType<ComposerProps>) => places.composer.push(Component),
    toolView: (tool: string, Component: ComponentType<{ call: ToolCall }>, options?: { open?: boolean }) => places.toolViews.set(`${name}_${tool}`, { View: Component, open: Boolean(options?.open) }),
    settings: (Component: ComponentType) => places.settings.push(Component),
    botSettings: (Component: ComponentType<{ bot: Profile }>) => places.botSettings.push(Component),
    botPanel: (Component: ComponentType<{ bot: Profile }>) => places.botPanel.push(Component),
    libraryItem: (Component: ComponentType<{ item: LibraryItem }>) => places.libraryItem.push(Component),
    chat: (Component: ComponentType<{ bot: Profile; reload: () => void }>) => places.chat.push(Component),
    header: (Component: ComponentType<{ bot: Profile }>) => places.header.push(Component),
    box: (Component: ComponentType<any>) => places.box.push(Component),
    fold: (fold: Fold) => places.fold.push(fold),
    said: (pattern: RegExp, Component: ComponentType<{ match: RegExpMatchArray }>) => places.said.push({ pattern, Component }),
    mention: (source: Mention) => places.mentions.push(source),
    codeBlock: (language: string, Component: ComponentType<CodeBlockProps>) => places.codeBlocks.push({ language: String(language).toLowerCase(), Component }),
    slot: (name: string, Component: ComponentType<any>) => places.slots.set(name, [...(places.slots.get(name) ?? []), Component]),
  });
  return places;
}

// Reads the list of running plugins, and loads the ones that are new or changed. A plugin that's gone loses its
// places; its code stays in the page until it reloads. Adding, updating, or removing one calls this again.
// One load at a time. A second ask while one runs, as the app's start does twice in development, or after a change,
// reads the list once more when it ends, when the plugins it loaded are kept, rather than running each one twice.
let loading: Promise<void> | null = null;
let again = false;
export function loadPlugins(): Promise<void> {
  if (loading) {
    again = true;
    return loading;
  }
  loading = (async () => {
    do {
      again = false;
      await loadOnce();
    } while (again);
  })().finally(() => (loading = null));
  return loading;
}
async function loadOnce() {
  const [list, pm] = await Promise.all([client.plugins.pages().catch(() => null), formattingKit().catch(() => ((kit = null), null))]);
  if (!list) return;
  // All at once, each into its own places, and kept in the list's order: one after another, a cold start over a slow
  // link waited for every page in turn.
  const next: Loaded[] = await Promise.all(
    list.map(async ({ name, iconKey, version, page, css }): Promise<Loaded> => {
      const now = loaded.find((p) => p.name === name);
      const key = `${page ?? ""} ${css ?? ""}`;
      if (now && now.key === key) return { ...now, iconKey };
      now?.css?.remove();
      let link: HTMLLinkElement | undefined;
      if (css) {
        link = Object.assign(document.createElement("link"), { rel: "stylesheet", href: css });
        document.head.append(link);
      }
      let pageError: string | undefined;
      const places = page ? await run(name, version, page, pm).catch((error: Error) => (console.error(`Plugin ${name}:`, error), (pageError = error.message), emptyPlaces())) : emptyPlaces();
      return { name, iconKey, key, css: link, places, ...(pageError ? { pageError } : {}) };
    }),
  );
  for (const gone of loaded.filter((p) => !list.some((l) => l.name === p.name))) gone.css?.remove();
  publish(next);
}

// A chat's message box: the first plugin's, given a textarea's props and the bot, or the app's own, which formats as the
// owner types (editor.tsx). The app's takes over if the plugin's throws, so a broken plugin can't take away the box, and
// the textarea, while the app's loads or if it can't.
export function MessageBox({ bot, ...props }: ComponentProps<typeof InputGroupTextarea> & { bot?: Profile | null }) {
  const plugin = usePlugins().find((p) => p.places.box.length);
  const plain = <InputGroupTextarea {...props} />;
  const own = (
    <PluginPart plugin="fxbot" fallback={plain}>
      <Suspense fallback={plain}>
        <Editor {...props} />
      </Suspense>
    </PluginPart>
  );
  if (!plugin) return own;
  const Box = plugin.places.box[0];
  return (
    <PluginPart plugin={plugin.name} fallback={own}>
      <Box bot={bot} {...props} />
    </PluginPart>
  );
}

// Why a plugin's page code didn't load, for its tab: the owner can't see the browser's console.
export const usePageError = (name: string) => usePlugins().find((plugin) => plugin.name === name)?.pageError;

// How a message or a tool call folds, by the first plugin that says. One that throws folds nothing.
export function useFold() {
  const folds = usePlugins().flatMap((plugin) => plugin.places.fold);
  const first = <T,>(ask: (fold: Fold) => T | void) => {
    for (const fold of folds) {
      try {
        const answer = ask(fold);
        if (answer) return answer;
      } catch (error) {
        console.error("A plugin's fold failed:", error);
      }
    }
  };
  return { message: (id: string) => first((fold) => fold.message?.(id)), tool: (call: ToolCall) => first((fold) => fold.tool?.(call)) };
}

// The code blocks plugins draw, as Streamdown's renderers: the first plugin to claim a language draws it, in its own
// error boundary, and the plain code shows if it throws. Made once for each list of loaded plugins, so a renderer keeps
// its identity, and its state, while a reply streams.
type Renderer = { language: string; component: ComponentType<{ code: string; isIncomplete: boolean; language: string; meta?: string }> };
const renderersOf = new WeakMap<Loaded[], Renderer[]>();
function useCodeBlocks() {
  const plugins = usePlugins();
  let renderers = renderersOf.get(plugins);
  if (!renderers) {
    const claimed = new Set<string>();
    renderers = plugins.flatMap(({ name, places }) =>
      places.codeBlocks.flatMap(({ language, Component }): Renderer[] => {
        if (claimed.has(language)) return [];
        claimed.add(language);
        const component = ({ code, isIncomplete, language, meta }: { code: string; isIncomplete: boolean; language: string; meta?: string }) => (
          <PluginPart plugin={name} fallback={<pre className="my-4 overflow-x-auto rounded-xl border p-4 text-sm"><code>{code}</code></pre>}>
            <Component code={code} language={language} meta={meta} incomplete={isIncomplete} />
          </PluginPart>
        );
        return [{ language, component }];
      }),
    );
    renderersOf.set(plugins, renderers);
  }
  return renderers;
}

// Markdown as the app draws it everywhere, and gives plugins as ui.Streamdown: Streamdown, with the code blocks plugins
// draw. With none, it's Streamdown as it is.
export function Markdown({ plugins, components, ...props }: ComponentProps<typeof Streamdown>) {
  const blocks = useCodeBlocks();
  const merged = useMemo(() => (blocks.length ? { ...plugins, renderers: [...(plugins?.renderers ?? []), ...blocks] } : plugins), [plugins, blocks]);
  const links = useMemo<Components>(() => ({ a: AppLink, ...components }), [components]);
  return <Streamdown {...props} components={links} plugins={merged} />;
}

// A link to a place in the app opens here: a plugin's screen, such as a page's /pages/<id>, beside the chat, and any
// other in place. Any other link is Streamdown's, which asks before it opens another site in a new tab.
function AppLink({ node, ...props }: ComponentProps<"a"> & ExtraProps) {
  const href = props.href ?? "";
  if (!/^\/(?!\/|api\/)/.test(href)) return <defaultComponents.a node={node} {...props} />;
  return <a {...props} target={undefined} rel={undefined} className={`wrap-anywhere font-medium text-primary underline ${props.className ?? ""}`} data-streamdown="link" onClick={followBeside} />;
}

// What the owner said, as Markdown, as a bot's reply is, with each line kept as they typed it (said.ts). Each match of
// a plugin's `said` pattern outside code is a <said-part> tag first, drawn by that plugin's part, as a room draws its
// mentions. Raw HTML stays out, as in replies, but what looks like a tag, as in Array<string>, is the owner's words, so
// each < outside code is text, but an autolink's, such as <https://fxbot.sh>.
export function SaidMarkdown({ text }: { text: string }) {
  const plugins = usePlugins();
  const parts: ReactNode[] = [];
  const tagged = text
    .split(code)
    .map((piece, i) => {
      if (i % 2) return piece;
      piece = piece.replace(/\\[\s\S]|<(?![a-z][a-z\d+.-]{1,31}:[^\s<>]*>|[^\s<>@]+@[^\s<>@]+>)/gi, (m) => (m === "<" ? "&lt;" : m));
      for (const { name, places } of plugins)
        for (const { pattern, Component } of places.said) {
          let out = "";
          let at = 0;
          for (const match of piece.matchAll(pattern)) {
            out += `${piece.slice(at, match.index)}<said-part n="${parts.length}"></said-part>`;
            parts.push(
              <PluginPart key={parts.length} plugin={name}>
                <Component match={match} />
              </PluginPart>,
            );
            at = match.index + match[0].length;
          }
          piece = out + piece.slice(at);
        }
      return piece;
    })
    .join("");
  const components = useMemo<Components>(() => ({ "said-part": ({ n }: { n?: string }) => parts[Number(n)] ?? null }) as Components, [text, plugins]);
  return (
    <Markdown mode="static" parseIncompleteMarkdown={false} allowedTags={{ "said-part": ["n"] }} components={components}>
      {breaks(tagged)}
    </Markdown>
  );
}

// A plugin's part, kept from taking down the app: one that throws shows a short card in its place.
export class PluginPart extends Component<{ plugin: string; children: ReactNode; fallback?: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {};
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;
    return (
      <p role="alert" className="m-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {this.props.plugin} broke here: {this.state.error.message}
      </p>
    );
  }
}

// Each plugin's parts for one place, in the order the plugins were added.
export function Place<P extends object>({ pick, props }: { pick: (places: Places) => ComponentType<P>[]; props: P }) {
  const plugins = usePlugins();
  return plugins.flatMap(({ name, places }) =>
    pick(places).map((Part, i) => (
      <PluginPart key={`${name}-${i}`} plugin={name}>
        <Part {...props} />
      </PluginPart>
    )),
  );
}

// Each loaded plugin that draws in Settings, with its parts, in load order: what its tab there shows first.
export function usePluginSettings() {
  return usePlugins().flatMap(({ name, iconKey, places }) => (places.settings.length ? [{ name, iconKey, parts: places.settings }] : []));
}

// The plugin screen for a path, `/<plugin>/…`, checked after the app's own, and whether it opens beside the chat.
export const usePluginRoute = (path: string) => pluginRoute(usePlugins(), path);
export function pluginRoute(plugins: Loaded[], path: string): { screen: ReactNode; beside: boolean } | undefined {
  const [, top, ...rest] = path.split("/");
  const plugin = plugins.find((p) => p.name === top);
  if (!plugin) return undefined;
  for (const route of plugin.places.routes) {
    if (route.parts.length !== rest.filter(Boolean).length) continue;
    const params: Record<string, string> = {};
    if (route.parts.every((part, i) => (part.startsWith(":") ? ((params[part.slice(1)] = decodeURIComponent(rest[i])), true) : part === rest[i])))
      return {
        beside: route.beside,
        screen: (
          <PluginPart key={path} plugin={plugin.name}>
            <route.Component params={params} />
          </PluginPart>
        ),
      };
  }
  return undefined;
}

// How a plugin's tool call shows in a reply, if its plugin drew one. An `open` one stays in sight, below the folded steps.
export function usePluginToolView(tool: string) {
  const plugins = usePlugins();
  for (const { name, places } of plugins) {
    const view = places.toolViews.get(tool);
    if (view) return { plugin: name, ...view };
  }
  return undefined;
}

// The sidebar footer's buttons, one per plugin nav entry, and each one's address.
export function usePluginNav() {
  return usePlugins().flatMap(({ name, iconKey, places }) => places.nav.map((nav) => ({ ...nav, plugin: name, iconKey, href: `/${name}${nav.path.startsWith("/") ? nav.path : `/${nav.path}`}` })));
}
