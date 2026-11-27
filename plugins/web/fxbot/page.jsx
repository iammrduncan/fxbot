// The web plugin in the app: the Web section of its tab in Settings, which picks the provider for each job and tries
// it, and how a search, a read, and research show in a reply. Built into page.js; see the README.
import { useEffect, useState } from "react";
import { api, go, ui } from "@fxbot/app";

async function call(path, method = "GET", body) {
  const res = await api(path, { method, ...(body ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}) });
  const answer = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(answer.error ?? `HTTP ${res.status}`);
  return answer;
}

// Plugin pages get only the classes the app itself uses, so what it doesn't is written out.
const wraps = { overflowWrap: "anywhere" };
const jobs = [
  { job: "search", label: "Search with" },
  { job: "read", label: "Read pages with" },
  { job: "research", label: "Research with" },
];

function Job({ job, label, config, save }) {
  const [trying, setTrying] = useState(false);
  const [said, setSaid] = useState(null);
  const can = config.providers.filter((p) => p.can.includes(job));
  if (job === "research" && !can.length) return null;
  // With nothing picked, search and research go to the first that can; reading is fxbot's own.
  const picked = config.picks[job] ?? (job === "read" ? "" : (can[0]?.id ?? ""));
  const none = job === "search" && !can.length;
  const tryIt = () => {
    setTrying(true);
    setSaid(null);
    call("try", "POST", { job, provider: picked || null })
      .then((r) => setSaid({ ok: true, text: r.said }), (e) => setSaid({ ok: false, text: e.message }))
      .finally(() => setTrying(false));
  };
  return (
    <div className="grid gap-1">
      <label className="grid gap-1">
        <span>{label}</span>
        <span className="flex items-center gap-2">
          <ui.NativeSelect aria-label={label} className="w-full" value={picked} disabled={none} onChange={(e) => save({ [job]: e.target.value || null })}>
            {job === "read" && <ui.NativeSelectOption value="">fxbot itself</ui.NativeSelectOption>}
            {none && <ui.NativeSelectOption value="">{config.freeSearch ? "Parallel's free search" : "Nothing: add a provider"}</ui.NativeSelectOption>}
            {can.map((p) => (
              <ui.NativeSelectOption key={p.id} value={p.id}>
                {p.name}
              </ui.NativeSelectOption>
            ))}
          </ui.NativeSelect>
          <ui.Button variant="outline" size="sm" disabled={trying || (none && !config.freeSearch)} onClick={tryIt}>
            {trying ? "Trying…" : "Try it"}
          </ui.Button>
        </span>
      </label>
      {said && (
        <p className={said.ok ? "text-muted-foreground" : "text-destructive"} style={wraps}>
          {said.text}
        </p>
      )}
      {job === "read" && !picked && <Blocked config={config} can={can} save={save} />}
    </div>
  );
}

// Where a page goes when fxbot reads pages itself and a site blocks it: refuses it (HTTP 401, 403, or 429), or is only
// JavaScript. None tells the bot what else could read it, for it to choose.
function Blocked({ config, can, save }) {
  const value = config.picks.blocked ?? "";
  return (
    <label className="mt-2 grid gap-1">
      <span>If fxbot is blocked, read with</span>
      <ui.NativeSelect aria-label="If fxbot is blocked, read with" className="w-full" value={value} onChange={(e) => save({ blocked: e.target.value || null })}>
        <ui.NativeSelectOption value="">Nothing: tell the bot what else could</ui.NativeSelectOption>
        {config.computer && <ui.NativeSelectOption value="browser">The bot's own browser</ui.NativeSelectOption>}
        {can.map((p) => (
          <ui.NativeSelectOption key={p.id} value={p.id}>
            {p.name}
          </ui.NativeSelectOption>
        ))}
      </ui.NativeSelect>
      <span className="text-muted-foreground">
        When a site refuses fxbot, or a page is only JavaScript.
        {value === "browser" ? " A bot with its computer off is told what else could read it." : value ? " Each page read this way costs what the provider charges." : ""}
      </span>
    </label>
  );
}

function WebSection() {
  const [config, setConfig] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => void call("config").then(setConfig, (e) => setError(e.message)), []);
  if (!config) return error ? <p className="text-destructive">{error}</p> : null;
  const save = (patch) => (setError(""), call("config", "PUT", patch).then(setConfig, (e) => setError(e.message)));
  const searches = config.providers.some((p) => p.can.includes("search"));
  return (
    <section className="grid gap-3 text-sm" aria-label="Web">
      <h2 className="font-medium">Web</h2>
      <p className="text-muted-foreground">
        Which provider does each job. A bot can ask another you added for one call. Add web providers in Settings › Providers, under For web.
        {config.computer ? " With the computer on for a bot, it can also read a page in its own browser." : ""}
      </p>
      {!config.providers.length && (
        <p className="text-muted-foreground">
          No web provider is added yet. {config.freeSearch ? "Bots search with Parallel's free search, which needs no key and gets each query, and read pages themselves." : "Free search is off, so bots can't search until you add one. They read pages themselves."}{" "}
          <button type="button" className="underline" onClick={() => go("/settings/providers")}>
            Add a provider
          </button>
        </p>
      )}
      {config.providers.length > 0 && !searches && config.freeSearch && <p className="text-muted-foreground">None of these searches, so bots search with Parallel's free search.</p>}
      {jobs.map((j) => (
        <Job key={j.job} {...j} config={config} save={save} />
      ))}
      {error && <p className="text-destructive">{error}</p>}
    </section>
  );
}

// A call's view in a reply, from what the plugin kept of it: the chat has only a preview of the result.
function useView(tool) {
  const [view, setView] = useState(null);
  useEffect(() => {
    if (!tool.done || tool.error || !tool.id) return;
    call(`calls/${encodeURIComponent(tool.id)}`).then(setView, () => setView(null));
  }, [tool.id, tool.done, tool.error]);
  return view;
}
// The page's address, short: its site and path.
const short = (url) => {
  try {
    const u = new URL(url);
    return `${u.host.replace(/^www\./, "")}${u.pathname === "/" ? "" : u.pathname}`;
  } catch {
    return url;
  }
};
function Links({ items }) {
  return (
    <ol className="grid gap-1.5">
      {items.map((item, i) => (
        <li key={`${item.url}-${i}`} className="grid" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
          <a href={item.url} target="_blank" rel="noreferrer noopener" className="font-medium underline" style={wraps}>
            {item.title || short(item.url)}
          </a>
          <span className="truncate text-xs text-muted-foreground">
            {short(item.url)}
            {item.published ? ` · ${item.published}` : ""}
          </span>
        </li>
      ))}
    </ol>
  );
}
function Failed({ tool }) {
  return tool.done && tool.error ? (
    <p className="text-destructive" style={wraps}>
      {tool.output}
    </p>
  ) : null;
}

function SearchView({ call: tool }) {
  const view = useView(tool);
  return (
    <div className="grid gap-2 text-sm">
      <p className="text-muted-foreground" style={wraps}>
        {tool.input?.query ? `“${tool.input.query}”` : ""}
        {view?.by ? `, with ${view.by}` : ""}
      </p>
      {view?.results?.length ? <Links items={view.results} /> : tool.done && !tool.error && view && <p className="text-muted-foreground">No results.</p>}
      <Failed tool={tool} />
    </div>
  );
}
function FetchView({ call: tool }) {
  const view = useView(tool);
  const url = view?.final ?? tool.input?.url;
  return (
    <div className="grid gap-1 text-sm">
      {url && (
        <a href={url} target="_blank" rel="noreferrer noopener" className="font-medium underline" style={wraps}>
          {view?.title || short(url)}
        </a>
      )}
      {view && (
        <span className="text-xs text-muted-foreground">
          Read by {view.by}
          {view.library ? `, saved to the library as library:${view.library}` : ""}
        </span>
      )}
      <Failed tool={tool} />
    </div>
  );
}
function ResearchView({ call: tool }) {
  const view = useView(tool);
  return (
    <div className="grid gap-2 text-sm">
      <p className="text-muted-foreground" style={wraps}>
        {tool.input?.question ? `“${tool.input.question}”` : ""}
        {view?.by ? `, with ${view.by}` : ""}
      </p>
      {view?.sources?.length > 0 && <Links items={view.sources} />}
      <Failed tool={tool} />
    </div>
  );
}

export default function setup(app) {
  app.settings(WebSection);
  app.toolView("search", SearchView);
  app.toolView("fetch", FetchView);
  app.toolView("research", ResearchView);
}
