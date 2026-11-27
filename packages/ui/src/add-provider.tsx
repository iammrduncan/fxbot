import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import qrcode from "qrcode-generator";
import { ArrowLeftIcon, CheckIcon, CopyIcon, ExternalLinkIcon, LoaderCircleIcon, PlugIcon, SearchIcon } from "lucide-react";
import type { Catalog, CatalogEntry, LocalServer, Model, Provider, SignIn } from "@fxbot/sdk/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { client } from "./client.ts";
import { ModelField, aboutModel, useModels } from "./providers.tsx";

const label = "grid gap-1.5 text-sm font-medium";
const hint = "font-normal text-muted-foreground";
const link = "inline-flex items-center gap-1 font-medium underline underline-offset-4";
// An entry's page in fxbot's docs, or a long-tail host's own.
const helpUrl = (docs: string) => (docs.startsWith("/") ? `https://fxbot.sh${docs}` : docs);
const host = (url: string) => new URL(url).host;
const byOrder = (a: CatalogEntry, b: CatalogEntry) => (a.order ?? 0) - (b.order ?? 0);
// What the owner typed as a list: one per line, or split by commas.
const listOf = (value: string) => value.split(/[\n,]/).map((id) => id.trim()).filter(Boolean);

// The catalog, read once a page opens, and the local servers found on the machine, which take up to half a second.
export function useCatalog() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [found, setFound] = useState<LocalServer[]>([]);
  const [error, setError] = useState("");
  const load = () => (setError(""), client.providers.catalog().then(setCatalog, (e: Error) => setError(e.message)));
  useEffect(() => {
    void load();
    client.providers.local().then(setFound, () => {});
  }, []);
  return { catalog, found, error, load };
}

// The groups, as the page lays them out, and the words first-run setup puts under them.
type Words = { signIn?: string; key?: string; local?: string };
const groups = [
  ["key", "Use a key", "key"],
  ["cloud", "Clouds", ""],
  ["local", "On your machine", "local"],
] as const;

// Add provider: sign-ins first, then keys, clouds, and the machine, with search over all of them and models.dev's long
// tail. A tap opens the provider's card, and once it's connected, its model. Used in Settings and in first-run setup,
// which with `chatOnly` leaves out what serves no chat model, such as a plugin's voice service.
export function AddProvider({ first, words, done = "Done", chatOnly = false, onDefault, onDone }: { first: boolean; words?: Words; done?: string; chatOnly?: boolean; onDefault: (id: string) => void; onDone: (provider: Provider) => void }) {
  const { catalog, found, error, load } = useCatalog();
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<CatalogEntry | null>(null);
  const [connected, setConnected] = useState<Provider | null>(null);
  const [asked, setAsked] = useState(false);
  // models.dev's hosts come in a moment after a new install's first look, so a search without them asks once more.
  useEffect(() => {
    if (query.trim() && catalog && !catalog.more.length && !asked) (setAsked(true), void load());
  }, [query, catalog]);
  if (connected) return <ModelStep provider={connected} entry={picked} first={first} done={done} onDefault={onDefault} onDone={() => onDone(connected)} />;
  if (picked && catalog)
    return (
      <ProviderCard
        entry={picked}
        catalog={catalog}
        found={found.find((server) => server.kind === picked.id)}
        onBack={() => setPicked(null)}
        onConnected={(id) =>
          void client.providers.list().then((list) => {
            const added = list.find((p) => p.id === id) ?? null;
            // A provider that serves no chat model has no model to pick.
            if (added && picked.models === "none") onDone(added);
            else setConnected(added);
          })
        }
      />
    );
  if (!catalog)
    return error ? (
      <div className="grid gap-2">
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
        <Button variant="outline" className="justify-self-start" onClick={load}>
          Try again
        </Button>
      </div>
    ) : (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircleIcon className="size-4 animate-spin" /> Loading providers
      </p>
    );

  const shown = catalog.providers.filter((e) => e.order !== undefined && !e.plugin);
  // Each plugin's own entries, such as phone's voice services, under the plugin's name.
  const brought = chatOnly ? [] : [...new Set(catalog.providers.flatMap((e) => (e.plugin ? [e.plugin] : [])))];
  const signIns = [...shown.filter((e) => e.group === "sign-in").sort(byOrder), ...shown.filter((e) => e.group !== "sign-in" && e.signIn).sort(byOrder)];
  const custom = catalog.providers.find((e) => e.group === "custom");
  const q = query.trim().toLowerCase();
  const matches = (e: CatalogEntry) => e.name.toLowerCase().includes(q) || e.id.includes(q) || e.about.toLowerCase().includes(q);
  const results = q ? [...catalog.providers.filter((e) => matches(e) && !(chatOnly && e.models === "none")), ...catalog.more.filter(matches)] : [];
  const tile = (e: CatalogEntry) => <Tile key={`${e.group}-${e.id}`} entry={e} found={found.some((server) => server.kind === e.id)} onPick={() => setPicked(e)} />;
  return (
    <div className="grid gap-5">
      <label className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-8" aria-label="Search providers" placeholder="Search providers" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      {q ? (
        <Group title={results.length ? `${results.length} found` : "No provider by that name"} about={results.length ? undefined : "Custom takes any server that speaks OpenAI's Chat Completions."}>
          {results.map(tile)}
          {!results.length && custom && tile(custom)}
        </Group>
      ) : (
        <>
          <Group title="Sign in" about={words?.signIn ?? "With an account you already have. There's nothing to paste."}>
            {signIns.map((e) => (
              <Tile key={`s-${e.id}`} entry={e} onPick={() => setPicked(e)} />
            ))}
            {custom && <Tile entry={custom} onPick={() => setPicked(custom)} />}
          </Group>
          {groups.map(([group, title, worded]) => (
            <Group key={group} title={title} about={worded ? words?.[worded] : undefined}>
              {shown.filter((e) => e.group === group).sort(byOrder).map(tile)}
            </Group>
          ))}
          {brought.map((plugin) => (
            <Group key={`plugin-${plugin}`} title={`For ${plugin}`} about={`What the ${plugin} plugin uses. They serve no chat model.`}>
              {catalog.providers.filter((e) => e.plugin === plugin).sort(byOrder).map(tile)}
            </Group>
          ))}
        </>
      )}
    </div>
  );
}

function Group({ title, about, children }: { title: string; about?: string; children: ReactNode }) {
  return (
    <section className="grid gap-2" aria-label={title}>
      <h3 className="text-sm font-medium">{title}</h3>
      {about && <p className="-mt-1 text-sm text-muted-foreground">{about}</p>}
      <div className="grid gap-2 sm:grid-cols-2">{children}</div>
    </section>
  );
}

// The providers' logos, a chunk of their own, loaded once a page that shows them opens.
let logosLoaded: Promise<Record<string, string>> | undefined;
function useLogos() {
  const [logos, setLogos] = useState<Record<string, string> | null>(null);
  useEffect(() => void (logosLoaded ??= import("./provider-logos.ts").then((m) => m.logos)).then(setLogos, () => setLogos({})), []);
  return logos;
}

// A provider's logo in its own colors, as an image, which runs nothing, on a light tile in both themes, so a black logo and a
// colored one read alike. One with no logo shows its first letter, and Custom a plug.
export function Mark({ entry, size = 32 }: { entry: Pick<CatalogEntry, "id" | "name" | "modelsDev">; size?: number }) {
  const logos = useLogos();
  const logo = logos?.[entry.id] ?? logos?.[[entry.modelsDev ?? []].flat()[0] ?? ""];
  return (
    <span aria-hidden style={{ width: size, height: size, fontSize: size * 0.45 }} className="grid shrink-0 place-items-center rounded-[24%] bg-muted font-semibold text-neutral-900 dark:bg-neutral-100">
      {!logos ? null : logo ? (
        <img alt="" src={`data:image/svg+xml;utf8,${encodeURIComponent(logo)}`} style={{ width: size * 0.6, height: size * 0.6 }} className="object-contain" />
      ) : entry.id === "custom" ? (
        <PlugIcon style={{ width: size * 0.55, height: size * 0.55 }} />
      ) : (
        entry.name.charAt(0).toUpperCase()
      )}
    </span>
  );
}

function Tile({ entry, found, onPick }: { entry: CatalogEntry; found?: boolean; onPick: () => void }) {
  return (
    <button type="button" onClick={onPick} className="flex min-w-0 items-center gap-3 rounded-xl border p-2.5 text-left outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring">
      <Mark entry={entry} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="truncate font-medium">{entry.name}</span>
          {found && <span className="shrink-0 text-xs text-primary">Found here</span>}
        </span>
        <span className="block truncate text-xs text-muted-foreground">{entry.about}</span>
      </span>
    </button>
  );
}

// A provider's whole card: its sign-in first, when it has one, then its key, its fields, or its address. For a provider
// already added, the same card signs it in again or replaces its key.
export function ProviderCard({ entry, catalog, provider, found, onBack, onConnected }: { entry: CatalogEntry; catalog: Pick<Catalog, "container" | "more">; provider?: Provider; found?: LocalServer; onBack?: () => void; onConnected: (id: string) => void }) {
  const fromTail = catalog.more.some((e) => e.id === entry.id);
  return (
    <div className="grid gap-4">
      {onBack && (
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1 justify-self-start text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeftIcon className="size-4" /> All providers
        </button>
      )}
      <div className="flex items-center gap-3">
        <Mark entry={entry} size={40} />
        <div className="min-w-0 flex-1">
          <h3 className="font-medium">{provider ? provider.name : entry.name}</h3>
          <p className="text-sm text-muted-foreground">{entry.about}</p>
        </div>
      </div>
      {(entry.start || entry.docs) && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          {entry.start && <span className="rounded-md bg-muted px-2 py-0.5">{entry.start}</span>}
          {entry.docs && (
            <a className={link} href={helpUrl(entry.docs)} target="_blank" rel="noreferrer">
              Help <ExternalLinkIcon className="size-3.5" />
            </a>
          )}
        </p>
      )}
      {fromTail && (
        <p className="text-sm text-muted-foreground">
          {entry.tested ? "" : "Not yet tried with fxbot. "}models.dev lists it as speaking OpenAI's API at <code className="break-all">{entry.baseUrl}</code>.
        </p>
      )}
      {entry.note && <p className="text-sm text-muted-foreground">{entry.note}</p>}
      {entry.signIn && <SignInPanel entry={entry} provider={provider} onDone={onConnected} />}
      {entry.signIn && entry.connect !== "device" && <p className="text-sm font-medium">Or use a key</p>}
      {entry.connect !== "device" && <KeyForm entry={entry} provider={provider} found={found} container={catalog.container} onDone={onConnected} />}
    </div>
  );
}

// A QR of the sign-in link, for an account that lives on a phone while this page is on a computer.
function Qr({ text }: { text: string }) {
  const path = useMemo(() => {
    const code = qrcode(0, "M");
    code.addData(text);
    code.make();
    const n = code.getModuleCount();
    let d = "";
    for (let row = 0; row < n; row++) for (let col = 0; col < n; col++) if (code.isDark(row, col)) d += `M${col + 2} ${row + 2}h1v1h-1z`;
    return { d, size: n + 4 };
  }, [text]);
  return (
    <svg viewBox={`0 0 ${path.size} ${path.size}`} className="size-36 rounded-md bg-white p-1" role="img" aria-label="QR code of the sign-in link">
      <path d={path.d} fill="#000" />
    </svg>
  );
}

function CopyButton({ text, what }: { text: string; what: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => navigator.clipboard.writeText(text).then(() => (setCopied(true), setTimeout(() => setCopied(false), 2000)));
  return (
    <Button type="button" variant="outline" size="sm" onClick={copy}>
      {copied ? <CheckIcon /> : <CopyIcon />} {copied ? "Copied" : `Copy ${what}`}
    </Button>
  );
}

// A sign-in runs on the server, which holds what claims the key or tokens; this page shows the way in and checks every
// 2 seconds. One that also takes a key starts when asked, so opening its card for the key starts nothing.
function SignInPanel({ entry, provider, onDone }: { entry: CatalogEntry; provider?: Provider; onDone: (id: string) => void }) {
  const [asked, setAsked] = useState(entry.connect === "device" ? 1 : 0);
  const [paste, setPaste] = useState(false);
  const [signIn, setSignIn] = useState<SignIn | null>(null);
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!asked) return;
    let stopped = false;
    let current: SignIn | null = null;
    setError("");
    setSignIn(null);
    client.signIns.start(entry.id, provider?.id, paste ? "paste" : undefined).then(
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
      if (status?.status === "done") (clearInterval(poll), (current = null), onDone(status.provider!));
      if (status?.status === "failed") (setError(status.error ?? "The sign-in failed."), (current = null));
    }, 2000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      stopped = true;
      clearInterval(poll);
      clearInterval(tick);
      if (current) client.signIns.cancel(current.id).catch(() => {});
    };
  }, [entry.id, asked, paste]);

  async function sendCode(event: FormEvent) {
    event.preventDefault();
    if (!signIn) return;
    setError("");
    const status = await client.signIns.code(signIn.id, code).catch((e: Error) => ({ status: "failed" as const, error: e.message }));
    if (status.status === "done") onDone(status.provider!);
    else setError(status.error ?? "The code didn't work. Start again.");
  }
  const again = () => setAsked((n) => n + 1);

  if (!asked)
    return (
      <Button className="justify-self-start" onClick={again}>
        Sign in with {entry.name}
      </Button>
    );
  if (error)
    return (
      <div className="grid gap-2">
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
        <Button variant="outline" className="justify-self-start" onClick={again}>
          Start again
        </Button>
      </div>
    );
  if (!signIn)
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircleIcon className="size-4 animate-spin" /> Starting the sign-in…
      </p>
    );
  const left = Math.max(0, Math.round((signIn.expiresAt - now) / 1000));
  if (!left)
    return (
      <div className="grid gap-2">
        <p className="text-sm">This sign-in expired.</p>
        <Button variant="outline" className="justify-self-start" onClick={again}>
          Start again
        </Button>
      </div>
    );
  const waiting = (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <LoaderCircleIcon className="size-4 animate-spin" /> Waiting for you to sign in · {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")} left
    </p>
  );
  if (signIn.way === "redirect")
    return (
      <div className="grid gap-3">
        <Button asChild className="justify-self-start">
          <a href={signIn.url} target="_blank" rel="noopener">
            Continue to {entry.name} <ExternalLinkIcon />
          </a>
        </Button>
        <p className="text-sm text-muted-foreground">It opens in a new tab, and comes back to fxbot when you approve. This page finishes on its own.</p>
        {waiting}
        <button type="button" className="justify-self-start text-sm text-muted-foreground underline underline-offset-4" onClick={() => setPaste(true)}>
          Didn't come back? Use a code instead
        </button>
      </div>
    );
  if (signIn.way === "paste")
    return (
      <form onSubmit={sendCode} className="grid gap-3">
        <ol className="grid list-decimal gap-1 pl-5 text-sm">
          <li>
            <a className={link} href={signIn.url} target="_blank" rel="noopener">
              Open {entry.name}'s sign-in <ExternalLinkIcon className="size-3.5" />
            </a>
            , and approve fxbot.
          </li>
          <li>Copy the code it shows, and paste it here.</li>
        </ol>
        <Input aria-label="Code" autoComplete="off" required value={code} onChange={(e) => setCode(e.target.value)} placeholder="The code" />
        <Button type="submit" className="justify-self-start">
          Finish
        </Button>
        {waiting}
      </form>
    );
  return (
    <div className="grid gap-3">
      <p className="text-sm">Open the link on any device, sign in, and enter this code. This page finishes on its own.</p>
      <div className="flex flex-wrap items-center gap-4">
        <Qr text={signIn.verificationUrl!} />
        <div className="grid gap-2">
          <code aria-label="Sign-in code" className="justify-self-start rounded-lg bg-muted px-3 py-1.5 font-mono text-2xl tracking-widest">
            {signIn.userCode}
          </code>
          <div className="flex flex-wrap gap-2">
            <CopyButton text={signIn.userCode!} what="code" />
            <CopyButton text={signIn.verificationUrl!} what="link" />
          </div>
          <a className={link} href={signIn.verificationUrl} target="_blank" rel="noopener">
            Open {host(signIn.verificationUrl!)} <ExternalLinkIcon className="size-3.5" />
          </a>
        </div>
      </div>
      {waiting}
    </div>
  );
}

// A key, walked through: where to make it, what to pick there, the entry's fields, and the key, checked when it's added.
// A local server's address comes filled in, and Vertex AI takes its service account's file. Replacing asks for the key alone.
function KeyForm({ entry, provider, found, container, onDone }: { entry: CatalogEntry; provider?: Provider; found?: LocalServer; container: boolean; onDone: (id: string) => void }) {
  const url = entry.connect === "url";
  const file = entry.connect === "service-account";
  const typed = entry.models === "typed" || entry.id === "custom";
  const keyless = entry.id === "ollama" || entry.id === "lmstudio";
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState(found?.baseUrl ?? entry.baseUrl ?? "");
  const [fields, setFields] = useState<Record<string, string>>(() => Object.fromEntries((entry.fields ?? []).map((f) => [f.name, f.default ?? ""])));
  const [apiKey, setApiKey] = useState("");
  const [serviceAccount, setServiceAccount] = useState("");
  const [modelIds, setModelIds] = useState("");
  const [context, setContext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (provider && keyless) return null;

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const secret = file ? { serviceAccount } : { apiKey };
      const saved = provider
        ? await client.providers.update(provider.id, secret)
        : await client.providers.add({
            kind: entry.id,
            name,
            ...secret,
            ...(entry.fields?.length ? { fields } : {}),
            ...(typed ? { modelIds: listOf(modelIds) } : {}),
            ...(url ? { baseUrl, contextWindow: context ? Number(context) : null } : {}),
          });
      onDone(saved.id);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  const steps = [...(entry.keyPage ? [null] : []), ...(entry.steps ?? [])];
  return (
    <form onSubmit={save} className="grid gap-4">
      {steps.length > 0 && (
        <ol className="grid list-decimal gap-1 pl-5 text-sm">
          {steps.map((step, i) =>
            step === null ? (
              <li key="page">
                <a className={link} href={entry.keyPage} target="_blank" rel="noreferrer">
                  Open {host(entry.keyPage!)} <ExternalLinkIcon className="size-3.5" />
                </a>
              </li>
            ) : (
              <li key={i}>{step}</li>
            ),
          )}
        </ol>
      )}
      {!provider &&
        entry.fields?.map((f) => (
          <label key={f.name} className={label}>
            {f.label}
            {f.options ? (
              <NativeSelect className="w-full" value={fields[f.name]} onChange={(e) => setFields({ ...fields, [f.name]: e.target.value })}>
                {f.options.map((o) => (
                  <NativeSelectOption key={o.value} value={o.value}>
                    {o.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            ) : (
              <Input required value={fields[f.name]} onChange={(e) => setFields({ ...fields, [f.name]: e.target.value.trim() })} />
            )}
            {f.hint && <span className={hint}>{f.hint}</span>}
          </label>
        ))}
      {!provider && url && (
        <label className={label}>
          Address
          <Input required value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://host/v1" />
          <span className={hint}>{found ? "Found running on this machine. " : ""}{entry.hint ?? "An OpenAI-compatible API, with its /v1. HTTPS, or HTTP on localhost."}</span>
          {container && entry.group === "local" && (
            <span className={hint}>
              fxbot runs in a container here, so localhost is the container, not this machine. A server on the machine is plain HTTP from inside it, which fxbot can't use yet. Put the server behind HTTPS, such as with{" "}
              <code>tailscale serve</code>, and give that address.
            </span>
          )}
        </label>
      )}
      {file ? (
        <label className={label}>
          Service account key
          <Input type="file" accept="application/json,.json" required onChange={(e) => void e.target.files?.[0]?.text().then(setServiceAccount)} />
          <span className={hint}>The JSON file Google downloaded. It goes to the server once, sealed, and never comes back to this page.</span>
        </label>
      ) : (
        !keyless && (
          <label className={label}>
            {url ? "API key, if the server needs one" : "API key"}
            <Input type="password" autoComplete="off" required={!url} value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
            <span className={hint}>It goes to the server once, sealed, and never comes back to this page.</span>
          </label>
        )
      )}
      {!provider && typed && (
        <label className={label}>
          {entry.id === "custom" ? "Model ids, if the server lists none" : "Deployments"}
          <Input required={entry.id !== "custom"} value={modelIds} onChange={(e) => setModelIds(e.target.value)} placeholder="One or more, with commas between" />
        </label>
      )}
      {!provider && url && (
        <label className={label}>
          Context window
          <Input inputMode="numeric" value={context} onChange={(e) => setContext(e.target.value.replace(/\D/g, ""))} placeholder="As the server reports" />
        </label>
      )}
      {!provider && (
        <label className={label}>
          Name
          <Input maxLength={200} value={name} onChange={(e) => setName(e.target.value)} placeholder={entry.name} />
        </label>
      )}
      {entry.unchecked && <p className="text-sm text-muted-foreground">{entry.name} answers any key at its model list, so fxbot can't check yours before a chat. A wrong key shows at the first message.</p>}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" className="justify-self-start" disabled={busy || (file && !serviceAccount)}>
        {busy ? "Checking…" : provider ? (file ? "Replace service account" : "Replace key") : "Add"}
      </Button>
    </form>
  );
}

// After connecting: the model, with the entry's recommended one filled in when the provider serves it.
export function ModelStep({ provider, entry, first, done, onDefault, onDone }: { provider: Provider; entry: CatalogEntry | null; first: boolean; done: string; onDefault: (id: string) => void; onDone: () => void }) {
  const { models } = useModels(provider.id);
  const [model, setModel] = useState(provider.model);
  const [makeDefault, setMakeDefault] = useState(first);
  const [error, setError] = useState("");
  useEffect(() => {
    // A host may name it with a prefix, as Gemini's `models/`.
    const recommended = entry?.recommended && models?.find((m) => m.id === entry.recommended || m.id.split("/").at(-1) === entry.recommended);
    if (!model && recommended) setModel(recommended.id);
  }, [models]);
  const picked: Model | undefined = models?.find((m) => m.id === model);
  async function finish() {
    setError("");
    try {
      await client.providers.update(provider.id, { model });
      if (makeDefault) onDefault(provider.id);
      onDone();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="grid gap-4">
      <div>
        <h3 className="font-medium">Connected to {provider.name}</h3>
        <p className="text-sm text-muted-foreground">Choose a model to start with. You can change it any time.</p>
      </div>
      <label className={label}>
        Model
        <ModelField id={`new-${provider.id}`} provider={provider.id} value={model} onChange={setModel} placeholder="Pick a model" />
        {picked && aboutModel(picked) && <span className={hint}>{aboutModel(picked)}</span>}
      </label>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={makeDefault} onCheckedChange={(on) => setMakeDefault(on === true)} /> Make it the default for new bots
      </label>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button className="justify-self-start" disabled={!model.trim()} onClick={() => void finish()}>
        {done}
      </Button>
    </div>
  );
}
