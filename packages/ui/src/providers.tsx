import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { CheckIcon, ChevronsUpDownIcon, LoaderCircleIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { CatalogEntry, Model, Provider, Team } from "@fxbot/sdk/client";
import { AddProvider, ProviderCard, useCatalog } from "./add-provider.tsx";
import { client } from "./client.ts";

const label = "grid gap-1.5 text-sm font-medium";
const hint = "font-normal text-muted-foreground";

// What fxbot knows a model can do, in a few words: its context window, tools, and images.
export function aboutModel(m: Model) {
  const tokens = m.contextWindow ? (m.contextWindow >= 1_000_000 ? `${+(m.contextWindow / 1_000_000).toFixed(1)}M` : `${Math.round(m.contextWindow / 1000)}K`) : "";
  return [tokens && `${tokens} context`, m.supportsToolUse && "tools", m.supportsVision && "images"].filter(Boolean).join(" · ");
}

// A provider's models. The server answers with the list it kept, and fetches a fresh one behind that answer when it is
// old, so `load` again, as when the picker opens, brings the new one. `version` starts over, as after a Vercel account
// picks its team.
export function useModels(provider: string, version = "") {
  const [models, setModels] = useState<Model[] | null>(null);
  const [error, setError] = useState("");
  const load = () => {
    if (provider) client.providers.models(provider).then((list) => (setModels(list), setError("")), (e: Error) => setError(e.message));
  };
  useEffect(() => {
    setModels(null);
    setError("");
    load();
  }, [provider, version]);
  return { models, error, load };
}

// A model picked from the provider's list. It opens on every model, the current one marked, and narrows as you type;
// an id the list lacks can be used as typed.
export function ModelField({ id, provider, version, value, onChange, placeholder }: { id: string; provider: string; version?: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  const { models, error, load } = useModels(provider, version);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  const typed = query.trim();
  const q = typed.toLowerCase();
  const shown = (models ?? []).filter((m) => !q || m.id.toLowerCase().includes(q) || m.name?.toLowerCase().includes(q));
  // An id the list lacks comes last, so Enter takes the first match and the typed id only when nothing matches.
  const options = [...shown, ...(typed && !models?.some((m) => m.id === typed) ? [{ id: typed, name: "Use this id" }] : [])];
  const optionId = (i: number) => `models-${id}-${i}`;

  function toggle(next: boolean) {
    setOpen(next);
    if (!next) return;
    setQuery("");
    setActive(Math.max(0, (models ?? []).findIndex((m) => m.id === value)));
    load();
  }
  const pick = (model: string) => (onChange(model), setOpen(false));
  // The marked option stays in view as the arrows move it, and the current model is in view on opening.
  useEffect(() => {
    if (open) document.getElementById(optionId(active))?.scrollIntoView({ block: "nearest" });
  }, [open, active, models]);
  function keys(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.min(Math.max(i + (event.key === "ArrowDown" ? 1 : -1), 0), Math.max(options.length - 1, 0)));
    } else if (event.key === "Enter" && options[active]) {
      event.preventDefault();
      pick(options[active].id);
    }
  }

  return (
    <>
      <Popover open={open} onOpenChange={toggle}>
        <PopoverTrigger asChild disabled={!provider}>
          <Button type="button" variant="outline" role="combobox" aria-expanded={open} className="h-9 w-full justify-between px-3 font-normal">
            <span className={`truncate ${value ? "" : "text-muted-foreground"}`}>{value || placeholder}</span>
            <ChevronsUpDownIcon className="text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-64 gap-0 p-0">
          <Input
            autoFocus
            role="combobox"
            aria-expanded
            aria-controls={`models-${id}`}
            aria-activedescendant={options[active] ? optionId(active) : undefined}
            aria-label="Search models, or type a model id"
            placeholder="Search, or type a model id"
            className="rounded-b-none border-0 border-b shadow-none focus-visible:ring-0"
            value={query}
            onChange={(e) => (setQuery(e.target.value), setActive(0))}
            onKeyDown={keys}
          />
          <div ref={list} id={`models-${id}`} role="listbox" className="max-h-72 overflow-y-auto p-1">
            {models === null && !error && (
              <p className="flex items-center gap-2 p-2 text-muted-foreground">
                <LoaderCircleIcon className="size-4 animate-spin" /> Loading models
              </p>
            )}
            {models !== null && options.length === 0 && <p className="p-2 text-muted-foreground">This provider lists no models.</p>}
            {options.map((m, i) => (
              <div
                key={m.id + i}
                id={optionId(i)}
                role="option"
                aria-selected={m.id === value}
                className={`flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 ${i === active ? "bg-accent text-accent-foreground" : ""}`}
                onMouseMove={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(m.id)}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{m.id}</span>
                  {((m.name && m.name !== m.id) || aboutModel(m)) && <span className="block truncate text-xs text-muted-foreground">{[m.name !== m.id && m.name, aboutModel(m)].filter(Boolean).join(" · ")}</span>}
                </span>
                {m.id === value && <CheckIcon className="size-4 shrink-0" />}
              </div>
            ))}
          </div>
          {(error || value) && (
            <div className="flex items-center gap-2 border-t p-1.5">
              {error && <span className="min-w-0 flex-1 px-1 text-xs text-destructive">{error}</span>}
              {error && (
                <Button type="button" size="xs" variant="ghost" onClick={load}>
                  Try again
                </Button>
              )}
              {value && (
                <Button type="button" size="xs" variant="ghost" className="ml-auto" onClick={() => pick("")}>
                  Clear
                </Button>
              )}
            </div>
          )}
        </PopoverContent>
      </Popover>
      {error && !open && <span className="font-normal text-destructive">{error}</span>}
    </>
  );
}

// Settings' providers: a row for each, and Add provider, which opens the page of providers. Keys go to the server once
// and never back.
export function Providers({ defaultProvider, onDefault }: { defaultProvider: string; onDefault: (id: string) => void }) {
  const [providers, setProviders] = useState<Provider[] | null>(null);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [again, setAgain] = useState<Provider | null>(null);
  const load = () => client.providers.list().then(setProviders, (e: Error) => setError(e.message));
  useEffect(() => void load(), []);
  const done = () => (setAdding(false), setAgain(null), load());

  return (
    <section className="grid gap-3" aria-label="Providers">
      <h2 className="font-medium">Providers</h2>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {providers?.length === 0 && <p className="text-sm text-muted-foreground">No providers yet. Add one to start chatting.</p>}
      {providers?.map((p) => (
        <ProviderRow key={p.id} provider={p} isDefault={p.id === defaultProvider} onDefault={() => onDefault(p.id)} onChange={load} onReconnect={() => setAgain(p)} />
      ))}
      <Button variant="outline" className="justify-self-start" onClick={() => setAdding(true)}>
        <PlusIcon /> Add provider
      </Button>
      {adding && (
        <Sheetish title="Add a provider" description="Sign in with an account, use a key, or run models on your own machine." onClose={() => setAdding(false)}>
          <AddProvider first={!defaultProvider} onDefault={onDefault} onDone={done} />
        </Sheetish>
      )}
      {again && (
        <Sheetish title={again.connect === "device" ? `Sign in again: ${again.name}` : `Replace key: ${again.name}`} description="The key or sign-in goes to the server, sealed, and never comes back to this page." onClose={() => setAgain(null)}>
          <Again provider={again} onDone={done} />
        </Sheetish>
      )}
    </section>
  );
}

// A dialog on a computer, and the whole screen on a phone.
function Sheetish({ title, description, onClose, children }: { title: string; description: string; onClose: () => void; children: ReactNode }) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl max-sm:h-dvh max-sm:max-h-dvh max-sm:max-w-full max-sm:content-start max-sm:rounded-none max-sm:pt-[max(1rem,env(safe-area-inset-top))]">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
        {children}
      </DialogContent>
    </Dialog>
  );
}

// Sign in again, or replace a key: the provider's own card, from its entry, or one made from what the provider says of
// itself when the catalog no longer has it.
function Again({ provider, onDone }: { provider: Provider; onDone: () => void }) {
  const { catalog, error } = useCatalog();
  if (!catalog) return error ? <p className="text-sm text-destructive">{error}</p> : <LoaderCircleIcon className="size-4 animate-spin" />;
  const entry: CatalogEntry = [...catalog.providers, ...catalog.more].find((e) => e.id === provider.kind) ?? {
    id: provider.kind,
    name: provider.label,
    about: "",
    group: "key",
    connect: provider.connect,
    docs: provider.docs ?? "",
  };
  return <ProviderCard entry={entry} catalog={catalog} provider={provider} onConnected={onDone} />;
}

function ProviderRow({ provider: p, isDefault, onDefault, onChange, onReconnect }: { provider: Provider; isDefault: boolean; onDefault: () => void; onChange: () => void; onReconnect: () => void }) {
  const [model, setModel] = useState(p.model);
  const [context, setContext] = useState(p.contextWindow ? String(p.contextWindow) : "");
  const [modelIds, setModelIds] = useState(p.modelIds.join(", "));
  const [teams, setTeams] = useState<Team[]>([]);
  const [status, setStatus] = useState("");
  const connect = p.connect;
  // A provider a plugin brought, such as a voice service, serves no chat model: it has no model to pick, and isn't a default.
  const chat = p.chat !== false;
  // A provider whose models are typed, as Azure's deployments, or a custom server, edits its ids here.
  const typed = p.modelIds.length > 0 || p.kind === "custom";
  useEffect(() => {
    if (p.kind === "vercel" && p.signedIn) client.providers.teams(p.id).then(setTeams, (e: Error) => setStatus(e.message));
  }, [p.id]);

  async function run(action: () => Promise<unknown>, done = "Saved.") {
    setStatus("");
    try {
      await action();
      setStatus(done);
      onChange();
    } catch (e) {
      setStatus((e as Error).message);
    }
  }
  const save = (event: FormEvent) => {
    event.preventDefault();
    const ids = modelIds.split(/[\n,]/).map((id) => id.trim()).filter(Boolean);
    run(() => client.providers.update(p.id, { model, ...(connect === "url" ? { contextWindow: context ? Number(context) : null } : {}), ...(typed ? { modelIds: ids } : {}) }));
  };
  // Local servers need no key, so they show no key state.
  const state = p.error ?? (p.signedIn ? "Signed in" : p.hasKey ? "Key saved" : connect === "device" ? "Not signed in" : p.kind === "custom" ? "No key" : "");
  const about = p.name === p.label ? "" : p.label;

  return (
    <form onSubmit={save} className="grid gap-3 rounded-xl border p-3" aria-label={p.name}>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-medium">{p.name}</span>
        {about && <span className="text-sm text-muted-foreground">{about}</span>}
        {isDefault && <span className="text-sm text-muted-foreground">· Default</span>}
        {p.plugin && <span className="text-sm text-muted-foreground">· For {p.plugin}</span>}
        <span className={`ml-auto text-sm ${p.error ? "text-destructive" : "text-muted-foreground"}`}>{state}</span>
      </div>
      {p.baseUrl && <span className="truncate text-sm text-muted-foreground">{p.baseUrl}</span>}
      {chat && (
        <label className={label}>
          Default model
          <ModelField id={p.id} provider={p.id} version={`${p.teamId ?? ""}:${p.modelIds.join(",")}`} value={model} onChange={setModel} placeholder="A model this provider serves" />
        </label>
      )}
      {chat && typed && (
        <label className={label}>
          {p.kind === "custom" ? "Model ids, if the server lists none" : "Deployments"}
          <Input value={modelIds} onChange={(e) => setModelIds(e.target.value)} placeholder="One or more, with commas between" />
        </label>
      )}
      {chat && connect === "url" && (
        <label className={label}>
          Context window
          <Input inputMode="numeric" value={context} onChange={(e) => setContext(e.target.value.replace(/\D/g, ""))} placeholder="As the server reports" />
          <span className={hint}>Tokens. For Ollama, match the server's OLLAMA_CONTEXT_LENGTH.</span>
        </label>
      )}
      {p.kind === "vercel" && teams.length > 0 && (
        <label className={label}>
          Team
          <NativeSelect className="w-full" value={p.teamId ?? ""} onChange={(e) => run(() => client.providers.update(p.id, { teamId: e.target.value }))}>
            {!p.teamId && <NativeSelectOption value="">Pick a team…</NativeSelectOption>}
            {teams.map((t) => (
              <NativeSelectOption key={t.id} value={t.id}>
                {t.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
      )}
      <div className="flex flex-wrap gap-2">
        {chat && (
          <Button type="submit" size="sm">
            Save
          </Button>
        )}
        {chat && !isDefault && (
          <Button type="button" size="sm" variant="outline" onClick={onDefault}>
            Make default
          </Button>
        )}
        {(connect === "device" || connect === "key" || connect === "service-account" || (connect === "url" && p.kind !== "ollama" && p.kind !== "lmstudio")) && (
          <Button type="button" size="sm" variant="outline" onClick={onReconnect}>
            {connect === "device" ? "Sign in again" : connect === "service-account" ? "Replace service account" : "Replace key"}
          </Button>
        )}
        <Button type="button" size="sm" variant="destructive" onClick={() => confirm(`Remove ${p.name}? Its key or sign-in is deleted.`) && run(() => client.providers.remove(p.id), "Removed.")}>
          Remove
        </Button>
      </div>
      {status && <p className="text-sm text-muted-foreground">{status}</p>}
    </form>
  );
}
