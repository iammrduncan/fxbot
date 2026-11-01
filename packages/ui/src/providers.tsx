import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { CheckIcon, CopyIcon, ExternalLinkIcon, LoaderCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/components/ui/native-select";
import { kinds, type Kind, type Model, type Provider, type SignIn, type Team } from "@fxbot/sdk/client";
import { client } from "./client.ts";

const label = "grid gap-1.5 text-sm font-medium";
const hint = "font-normal text-muted-foreground";
const groups = [
  ["Sign in", "device"],
  ["API key", "key"],
  ["Server", "url"],
] as const;

// A provider's models, for a model field's suggestions; a typed id works too. `version` asks again, as after a
// Vercel account picks its team.
export function useModels(provider: string, version = "") {
  const [models, setModels] = useState<Model[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    setModels([]);
    setError("");
    if (provider) client.providers.models(provider).then(setModels, (e: Error) => setError(e.message));
  }, [provider, version]);
  return { models, error };
}

export function ModelField({ id, provider, version, value, onChange, placeholder }: { id: string; provider: string; version?: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  const { models, error } = useModels(provider, version);
  return (
    <>
      <Input list={`models-${id}`} maxLength={200} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} disabled={!provider} />
      <datalist id={`models-${id}`}>
        {models.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name && m.name !== m.id ? m.name : ""}
          </option>
        ))}
      </datalist>
      {error && <span className="font-normal text-destructive">{error}</span>}
    </>
  );
}

// Settings' providers: a row for each, and an Add list like eve's /login. Keys go to the server once and never back.
export function Providers({ defaultProvider, onDefault }: { defaultProvider: string; onDefault: (id: string) => void }) {
  const [providers, setProviders] = useState<Provider[] | null>(null);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState<{ kind: Kind; provider?: Provider } | null>(null);
  const load = () => client.providers.list().then(setProviders, (e: Error) => setError(e.message));
  useEffect(() => void load(), []);
  const done = (id?: string) => {
    setAdding(null);
    load();
    if (id && !defaultProvider) onDefault(id);
  };

  return (
    <section className="grid gap-3" aria-label="Providers">
      <h2 className="font-medium">Providers</h2>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {providers?.length === 0 && <p className="text-sm text-muted-foreground">No providers yet. Add one to start chatting.</p>}
      {providers?.map((p) => (
        <ProviderRow key={p.id} provider={p} isDefault={p.id === defaultProvider} onDefault={() => onDefault(p.id)} onChange={load} onReconnect={() => setAdding({ kind: p.kind, provider: p })} />
      ))}
      <NativeSelect className="w-full" aria-label="Add provider" value="" onChange={(e) => e.target.value && setAdding({ kind: e.target.value as Kind })}>
        <NativeSelectOption value="">Add provider…</NativeSelectOption>
        {groups.map(([title, connect]) => (
          <NativeSelectOptGroup key={connect} label={title}>
            {(Object.keys(kinds) as Kind[])
              .filter((kind) => kinds[kind].connect === connect)
              .map((kind) => (
                <NativeSelectOption key={kind} value={kind}>
                  {kinds[kind].label}
                </NativeSelectOption>
              ))}
          </NativeSelectOptGroup>
        ))}
      </NativeSelect>
      {adding && kinds[adding.kind].connect === "device" ? (
        <SignInDialog kind={adding.kind} provider={adding.provider} onDone={done} onClose={() => setAdding(null)} />
      ) : adding ? (
        <KeyDialog kind={adding.kind} provider={adding.provider} onDone={done} onClose={() => setAdding(null)} />
      ) : null}
    </section>
  );
}

function ProviderRow({ provider: p, isDefault, onDefault, onChange, onReconnect }: { provider: Provider; isDefault: boolean; onDefault: () => void; onChange: () => void; onReconnect: () => void }) {
  const [model, setModel] = useState(p.model);
  const [context, setContext] = useState(p.contextWindow ? String(p.contextWindow) : "");
  const [teams, setTeams] = useState<Team[]>([]);
  const [status, setStatus] = useState("");
  const connect = kinds[p.kind].connect;
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
    run(() => client.providers.update(p.id, { model, ...(connect === "url" ? { contextWindow: context ? Number(context) : null } : {}) }));
  };
  // Local servers need no key, so they show no key state.
  const state = p.error ?? (p.signedIn ? "Signed in" : p.hasKey ? "Key saved" : connect === "device" ? "Not signed in" : p.kind === "custom" ? "No key" : "");
  const about = p.env ? "From the server's environment" : p.name === kinds[p.kind].label ? "" : kinds[p.kind].label;

  return (
    <form onSubmit={save} className="grid gap-3 rounded-xl border p-3" aria-label={p.name}>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-medium">{p.name}</span>
        {about && <span className="text-sm text-muted-foreground">{about}</span>}
        {isDefault && <span className="text-sm text-muted-foreground">· Default</span>}
        <span className={`ml-auto text-sm ${p.error ? "text-destructive" : "text-muted-foreground"}`}>{state}</span>
      </div>
      {p.baseUrl && <span className="truncate text-sm text-muted-foreground">{p.baseUrl}</span>}
      <label className={label}>
        Default model
        <ModelField id={p.id} provider={p.id} version={p.teamId ?? ""} value={model} onChange={setModel} placeholder="A model this provider serves" />
      </label>
      {connect === "url" && (
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
        <Button type="submit" size="sm">
          Save
        </Button>
        {!isDefault && (
          <Button type="button" size="sm" variant="outline" onClick={onDefault}>
            Make default
          </Button>
        )}
        {!p.env && (connect === "device" || connect === "key" || p.kind === "custom") && (
          <Button type="button" size="sm" variant="outline" onClick={onReconnect}>
            {connect === "device" ? "Sign in again" : "Replace key"}
          </Button>
        )}
        {!p.env && (
          <Button type="button" size="sm" variant="destructive" onClick={() => confirm(`Remove ${p.name}? Its key or sign-in is deleted.`) && run(() => client.providers.remove(p.id), "Removed.")}>
            Remove
          </Button>
        )}
      </div>
      {status && <p className="text-sm text-muted-foreground">{status}</p>}
    </form>
  );
}

function Frame({ title, description, onClose, children }: { title: string; description: string; onClose: () => void; children: ReactNode }) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
        {children}
      </DialogContent>
    </Dialog>
  );
}

// A device code sign-in: the server holds what claims the tokens; the page shows the code and checks every 3 seconds.
function SignInDialog({ kind, provider, onDone, onClose }: { kind: Kind; provider?: Provider; onDone: (id: string) => void; onClose: () => void }) {
  const [signIn, setSignIn] = useState<SignIn | null>(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  const [copied, setCopied] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let stopped = false;
    let current: SignIn | null = null;
    setError("");
    setSignIn(null);
    client.signIns.start(kind, provider?.id).then(
      (started) => {
        if (stopped) return void client.signIns.cancel(started.id).catch(() => {});
        current = started;
        setSignIn(started);
      },
      (e: Error) => setError(e.message),
    );
    const poll = setInterval(async () => {
      if (!current) return;
      const status = await client.signIns.get(current.id).catch(() => null);
      if (status?.status === "done") onDone(status.provider!);
      if (status?.status === "failed") (setError(status.error ?? "The sign-in failed."), (current = null));
    }, 3000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      stopped = true;
      clearInterval(poll);
      clearInterval(tick);
      if (current) client.signIns.cancel(current.id).catch(() => {});
    };
  }, [kind, attempt]);

  const left = signIn ? Math.max(0, Math.round((signIn.expiresAt - now) / 1000)) : 0;
  const copy = () => signIn && navigator.clipboard.writeText(signIn.userCode).then(() => (setCopied(true), setTimeout(() => setCopied(false), 2000)));
  return (
    <Frame title={`Sign in: ${kinds[kind].label}`} description="Open the link on any device, sign in, and enter this code. This page finishes on its own." onClose={onClose}>
      {error ? (
        <div className="grid gap-3">
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
          <Button onClick={() => setAttempt((n) => n + 1)}>Try again</Button>
        </div>
      ) : !signIn ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircleIcon className="size-4 animate-spin" /> Getting a code…
        </p>
      ) : (
        <div className="grid gap-4">
          <div className="flex items-center justify-center gap-2">
            <code aria-label="Sign-in code" className="rounded-lg bg-muted px-4 py-2 font-mono text-2xl tracking-widest">
              {signIn.userCode}
            </code>
            <Button variant="ghost" size="icon" aria-label="Copy code" onClick={copy}>
              {copied ? <CheckIcon /> : <CopyIcon />}
            </Button>
          </div>
          <a href={signIn.verificationUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 text-sm font-medium underline underline-offset-4">
            Open {new URL(signIn.verificationUrl).host} <ExternalLinkIcon className="size-4" />
          </a>
          <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <LoaderCircleIcon className="size-4 animate-spin" /> Waiting · {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")} left
          </p>
        </div>
      )}
    </Frame>
  );
}

// A key or a server's address. Replacing a key on an existing provider asks for the key alone.
function KeyDialog({ kind, provider, onDone, onClose }: { kind: Kind; provider?: Provider; onDone: (id: string) => void; onClose: () => void }) {
  const preset = kinds[kind];
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("baseUrl" in preset ? preset.baseUrl : "");
  const [apiKey, setApiKey] = useState("");
  const [context, setContext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const wantsKey = preset.connect === "key" || kind === "custom";
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const saved = provider
        ? await client.providers.update(provider.id, { apiKey })
        : await client.providers.add({ kind, name, apiKey, ...(preset.connect === "url" ? { baseUrl, contextWindow: context ? Number(context) : null } : {}) });
      setApiKey("");
      onDone(saved.id);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <Frame title={provider ? `Replace key: ${provider.name}` : `Add ${preset.label}`} description="The key goes to the server, sealed, and never comes back to this page." onClose={onClose}>
      <form onSubmit={save} className="grid gap-4">
        {!provider && (
          <label className={label}>
            Name
            <Input maxLength={200} value={name} onChange={(e) => setName(e.target.value)} placeholder={preset.label} />
          </label>
        )}
        {!provider && preset.connect === "url" && (
          <label className={label}>
            Address
            <Input required value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://host/v1" />
            <span className={hint}>An OpenAI-compatible API with its /v1. HTTPS, or HTTP on localhost.</span>
          </label>
        )}
        {wantsKey && (
          <label className={label}>
            API key
            <Input type="password" autoComplete="off" required={preset.connect === "key" || !!provider} value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
          </label>
        )}
        {!provider && preset.connect === "url" && (
          <label className={label}>
            Context window
            <Input inputMode="numeric" value={context} onChange={(e) => setContext(e.target.value.replace(/\D/g, ""))} placeholder="As the server reports" />
          </label>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy}>
          {busy ? "Checking…" : "Save"}
        </Button>
      </form>
    </Frame>
  );
}
