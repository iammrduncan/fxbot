import { createFxAgent, type FxAgent, type FxAgentEvent, type FxAgentTool, type FxCustomProviderModel, type FxProviderCredentials } from "libfx";
import * as chatgpt from "libfx/chatgpt";
import type { Durability } from "libfx/durable-world";
import * as grok from "libfx/grok";
import { fill, type ProviderCatalog } from "./catalog.ts";
import type { Device } from "./device.ts";
import type { EmbeddingsTarget } from "./embeddings.ts";
import * as huggingface from "./huggingface.ts";
import { createModels, type Access } from "./models.ts";
import * as openrouter from "./openrouter.ts";
import * as orcarouter from "./orcarouter.ts";
import { createSecrets, withoutSecrets } from "./secrets.ts";
import { newId, type ProviderRecord, type Sql, type Store } from "./store.ts";
import { embeddingKinds, type CatalogEntry, type NewProvider, type Provider, type ProviderUpdate, type SignIn, type SignInStatus } from "./types.ts";
import * as vercel from "./vercel.ts";
import * as vertex from "./vertex.ts";

type Fetch = typeof fetch;
const fail = (status: number, message: string): never => {
  throw Object.assign(new Error(message), { status });
};
const plans = { chatgpt, grok };
const refreshSkewMs = 5 * 60 * 1000;
const loopback = new Set(["localhost", "127.0.0.1", "[::1]"]);
// A provider's sealed secret: a key, a plan's or an account's tokens, or Vertex AI's service account and its token.
type Held = { apiKey?: string; accessToken?: string; refreshToken?: string; expiresAt?: number; serviceAccount?: vertex.ServiceAccount };

// libfx's rule for a custom provider's address. libfx checks it only when a turn starts, so it is checked here first.
export function checkBaseUrl(value: unknown) {
  let url: URL;
  try {
    url = new URL(String(value));
  } catch {
    return fail(400, "baseUrl must be a URL");
  }
  if (url.username || url.password || url.search || url.hash) fail(400, "baseUrl must not carry credentials, a query, or a fragment");
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback.has(url.hostname))) fail(400, "baseUrl must use https, or http on localhost");
  return `${url.origin}${url.pathname}`.replace(/\/+$/, "");
}

// OpenCode's requests: the session id moves from the key libfx sent into `x-opencode-session`, and fxbot names itself,
// as OpenCode asks of clients. libfx would mask only the combined key, so the plain key is masked in error bodies here.
function opencodeFetch(fetch: Fetch): Fetch {
  return async (input, init = {}) => {
    const headers = new Headers(init.headers);
    const [, key, session] = /^Bearer (\S+) session=(\S+)$/.exec(headers.get("authorization") ?? "") ?? [];
    if (key) {
      headers.set("authorization", `Bearer ${key}`);
      headers.set("x-opencode-session", session);
    }
    headers.set("user-agent", "fxbot");
    return withoutSecrets(await fetch(input, { ...init, headers }), [key]);
  };
}

// An entry's own headers on every request to it, such as OpenRouter's attribution or Azure's `api-key`, where
// `{apiKey}` is the provider's key, masked if an error body quotes it. None: libfx's own fetch.
function entryFetch(fetch: Fetch, entry: CatalogEntry, key: () => Promise<string | undefined>): Fetch | undefined {
  const extra = Object.entries(entry.headers ?? {});
  if (!extra.length) return undefined;
  return async (input, init = {}) => {
    const apiKey = await key();
    const headers = new Headers(init.headers);
    for (const [name, value] of extra) if (apiKey || !value.includes("{apiKey}")) headers.set(name, value.replaceAll("{apiKey}", apiKey ?? ""));
    return withoutSecrets(await fetch(input, { ...init, headers }), [apiKey]);
  };
}

const text = (value: unknown, name: string, max = 200) => {
  if (typeof value !== "string") return fail(400, `${name} must be a string`);
  if (value.trim().length > max) fail(400, `${name} is over ${max} characters`);
  return value.trim();
};
const contextField = (value: unknown) =>
  value === null || (Number.isInteger(value) && (value as number) > 0 && (value as number) <= 100_000_000) ? (value as number | null) : fail(400, "contextWindow must be a whole number of tokens, or null");
// Model ids the owner typed, such as Azure's deployments: up to 100, each as a model is named.
const idsOf = (value: unknown) => {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 100) return fail(400, "modelIds must be a list of up to 100 model ids");
  return [...new Set(value.map((id) => text(id, "a model id")).filter(Boolean))];
};
// An entry's fields, each filled as its address takes it, with its default when it has one.
const fieldsOf = (entry: CatalogEntry, values: unknown) => {
  if (values !== undefined && (typeof values !== "object" || values === null || Array.isArray(values))) fail(400, "fields must be an object");
  return Object.fromEntries((entry.fields ?? []).map((f) => [f.name, fill(`{${f.name}}`, entry, (values ?? {}) as Record<string, string>)]));
};
// OpenRouter can send the browser back only to a page it can reach from it: HTTPS, or this machine.
const comesBack = (origin?: string) => {
  if (!origin || !URL.canParse(origin) || new URL(origin).origin !== origin) return false;
  const url = new URL(origin);
  return url.protocol === "https:" || (url.protocol === "http:" && loopback.has(url.hostname));
};

export type ProvidersOptions = {
  store: Store;
  secretKey: Buffer;
  /** Where every agent keeps its sessions (sessions.ts). */
  durability: Durability;
  /** OAuth apps at Vercel and Hugging Face, in place of the catalog's. */
  vercelClientId?: string;
  hfClientId?: string;
  catalog: ProviderCatalog;
  fetch: Fetch;
  tools: FxAgentTool[];
};

// Every provider runs as its own libfx agent, because libfx gives an agent one provider and a session runs only on
// the agent that started it. Keys and tokens live sealed in Postgres and reach libfx only through its callbacks.
export async function createProviders({ store, secretKey, durability, vercelClientId, hfClientId, catalog, fetch, tools }: ProvidersOptions) {
  const secrets = createSecrets(store.sql, secretKey);
  const models = createModels(store.sql, fetch, catalog);
  const agents = new Map<string, { agent: FxAgent; models: Record<string, FxCustomProviderModel> | null }>();
  // Why a provider has no agent, such as a secret that will not open. The server keeps running.
  const errors = new Map<string, string>();
  // The last refusal each provider gave, until it next answers. libfx retries one out of sight, for as long as it's let.
  const refused = new Map<string, { status: number; at: number }>();
  // fxbot's own apps, as the environment or the catalog names them. A sign-in with none isn't offered.
  const vercelId = () => vercelClientId || catalog.get("vercel")?.clientId || "";
  const hfId = () => hfClientId || catalog.get("huggingface")?.clientId || "";

  // One queue per provider, so its tokens are renewed once at a time: by libfx for turns and by the SDK for its own calls.
  const locks = new Map<string, Promise<unknown>>();
  function locked<T>(id: string, run: () => Promise<T>): Promise<T> {
    const next = (locks.get(id) ?? Promise.resolve()).then(run, run);
    locks.set(id, next.catch(() => {}));
    return next;
  }

  // Renews tokens that expire within 5 minutes, unless another caller already did while this one waited.
  async function renewed<T extends { accessToken: string; refreshToken?: string; expiresAt?: number }>(id: string, renew: (old: T) => Promise<T>) {
    const current = (await secrets.get<T>(id)) ?? fail(400, "Sign in to this provider first.");
    if (!current.refreshToken || !current.expiresAt || current.expiresAt - refreshSkewMs > Date.now()) return current;
    return locked(id, async () => {
      const latest = (await secrets.get<T>(id))!;
      if (latest.accessToken !== current.accessToken) return latest;
      const next = await renew(latest);
      await secrets.put(id, next);
      return next;
    });
  }
  // Vertex AI's token, made again from the service account 5 minutes before it ends.
  async function vertexToken(id: string) {
    const fresh = (held: Held) => held.accessToken && held.expiresAt && held.expiresAt - refreshSkewMs > Date.now();
    const current = (await secrets.get<Held>(id)) ?? fail(400, "This provider has no service account.");
    if (fresh(current)) return current.accessToken!;
    return locked(id, async () => {
      const latest = (await secrets.get<Held>(id))!;
      if (fresh(latest)) return latest.accessToken!;
      const minted = await vertex.token(latest.serviceAccount!, fetch);
      await secrets.put(id, { serviceAccount: latest.serviceAccount, ...minted });
      return minted.accessToken;
    });
  }

  const vercelFetch = (record: ProviderRecord) =>
    vercel.vercelFetch(async () => ({ credentials: await renewed<vercel.VercelCredentials>(record.id, (old) => vercel.refresh(old, vercelId(), fetch)), teamId: record.teamId }), fetch);
  const keyOf = async (record: ProviderRecord) => (await secrets.get<Held>(record.id))?.apiKey;
  // The bearer a provider's requests carry, read at each one: its key, Vertex AI's token, or a Hugging Face sign-in's.
  async function bearerOf(record: ProviderRecord) {
    const held = await secrets.get<Held>(record.id);
    if (held?.serviceAccount) return vertexToken(record.id);
    if (held?.accessToken && record.kind === "huggingface") return (await renewed<huggingface.HfCredentials>(record.id, (old) => huggingface.refresh(old, hfId(), fetch))).accessToken;
    return held?.apiKey;
  }

  // What the SDK's own requests to a provider need, outside a turn.
  async function access(record: ProviderRecord): Promise<Access> {
    if (record.kind === "chatgpt" || record.kind === "grok")
      return renewed<FxProviderCredentials>(record.id, (old) => plans[record.kind as "chatgpt"].refreshCredentials(old, { fetch }));
    if (record.kind === "vercel") return { fetch: vercelFetch(record) };
    return { apiKey: await bearerOf(record), fetch: entryFetch(fetch, models.entryOf(record), () => bearerOf(record)) };
  }

  // What a plugin may reach of an added provider: its own addresses only, its base URL's, its key check's, and its
  // entry's `hosts`, each with its WebSocket twin. A plan's sign-in has no API but its chat.
  async function reach(id: string, url: string) {
    const current = await record(id);
    if (current.kind === "chatgpt" || current.kind === "grok") fail(400, "This sign-in has no API for that.");
    const entry = models.entryOf(current);
    if (typeof url !== "string" || !URL.canParse(url)) fail(400, "url must be an address");
    const target = new URL(url);
    const origins = new Set<string>();
    const twins: Record<string, string> = { "https:": "wss:", "wss:": "https:", "http:": "ws:", "ws:": "http:" };
    const add = (address: string | null | undefined) => {
      if (!address || !URL.canParse(address)) return;
      const u = new URL(address);
      origins.add(`${u.protocol}//${u.host}`);
      if (twins[u.protocol]) origins.add(`${twins[u.protocol]}//${u.host}`);
    };
    add(current.baseUrl);
    if (current.kind === "gateway" || current.kind === "vercel") add("https://ai-gateway.vercel.sh");
    const fields = current.fields ?? {};
    for (const address of [entry.keyCheck, ...(entry.hosts ?? [])]) if (address) add(fill(address, entry, fields));
    if (!origins.has(`${target.protocol}//${target.host}`)) fail(400, `${target.protocol}//${target.host} isn't one of ${current.name}'s addresses.`);
    return { current, entry, target };
  }
  // The headers that carry a provider's key: its entry's, or a bearer when none of them holds it, as OpenRouter's,
  // which only name fxbot.
  function keyHeaders(entry: CatalogEntry, key: string | undefined) {
    const headers: Record<string, string> = {};
    for (const [name, value] of Object.entries(entry.headers ?? {})) if (key || !value.includes("{apiKey}")) headers[name] = value.replaceAll("{apiKey}", key ?? "");
    if (key && !Object.values(entry.headers ?? {}).some((value) => value.includes("{apiKey}"))) headers.authorization = `Bearer ${key}`;
    return headers;
  }

  // The libfx options that point an agent, or a throwaway engine, at a provider.
  async function options(record: ProviderRecord): Promise<Record<string, unknown>> {
    if (record.kind === "chatgpt" || record.kind === "grok")
      return {
        provider: record.kind === "chatgpt" ? "codex" : "grok",
        credentials: async () => (await secrets.get<FxProviderCredentials>(record.id)) ?? fail(400, "Sign in to this provider again."),
        onCredentials: (next: FxProviderCredentials) => secrets.put(record.id, next),
        refreshLock: (_: unknown, refresh: () => Promise<void>) => locked(record.id, refresh),
      };
    if (record.kind === "vercel") return { apiKey: "vercel-login", fetch: vercelFetch(record) };
    const held = await secrets.get<Held>(record.id);
    if (record.kind === "gateway") return { apiKey: held?.apiKey ?? fail(400, "This provider has no key.") };
    const provider = { name: `p-${record.id}`, baseUrl: record.baseUrl!, models: {} };
    // Read at each request, so a key that's replaced or removed stops working at once, even for a turn already running.
    const key = async () => (await bearerOf(record)) ?? fail(400, "This provider has no key.");
    if (record.kind !== "opencode" && record.kind !== "opencode-go") {
      const own = entryFetch(fetch, models.entryOf(record), () => bearerOf(record));
      return { provider, ...(held ? { credentials: async () => ({ apiKey: await key() }) } : {}), ...(own ? { fetch: own } : {}) };
    }
    // OpenCode routes each conversation by its `x-opencode-session` header, which Go requires. Only credentials() learns
    // a request's session, so the key handed to libfx carries it, and opencodeFetch moves it into the header.
    return {
      provider,
      credentials: async ({ sessionId }: { sessionId?: string }) => ({ apiKey: sessionId ? `${await key()} session=${sessionId}` : await key() }),
      fetch: opencodeFetch(fetch),
    };
  }

  async function start(record: ProviderRecord) {
    errors.delete(record.id);
    // A provider that serves no chat model, such as a voice service a plugin brought, runs no agent.
    if (models.entryOf(record).models === "none") return;
    try {
      const provider = await options(record);
      const agent = createFxAgent({
        // Sessions run only on an agent with the name that started them. Never rename one.
        name: `p-${record.id}`,
        // A durable session's checkpoint opens with the agent's own options, and a custom provider needs a model
        // there. Sessions always pass their own, so this one never reaches a request.
        model: "fxbot-unset",
        durability,
        tools,
        onEvent: (event: FxAgentEvent) => {
          if (event.type !== "transport.response") return;
          if (event.status >= 400) refused.set(record.id, { status: event.status, at: Date.now() });
          else refused.delete(record.id);
        },
        ...provider,
      } as Parameters<typeof createFxAgent>[0]);
      agents.set(record.id, { agent, models: (provider.provider as { models?: Record<string, FxCustomProviderModel> })?.models ?? null });
    } catch (error) {
      errors.set(record.id, (error as Error).message);
    }
  }

  // Closing an agent waits for its running turns, so one that's closing is kept: a second call waits for the same close.
  const stopping = new Map<string, Promise<void>>();
  function stop(id: string) {
    const entry = agents.get(id);
    agents.delete(id);
    if (entry) stopping.set(id, entry.agent.close().finally(() => stopping.delete(id)));
    return stopping.get(id);
  }

  // Closing an agent waits for its running turns. A turn asking for it meanwhile waits for the new one. A turn that
  // doesn't end, such as one waiting on the owner's answer, would leave the provider with no agent, every chat on it
  // empty and every message waiting, until fxbot restarted: so after 15 seconds, as removing one waits, the new agent
  // starts, and the old one finishes its turns beside it. libfx's agents of one name are copies, sharing their turns.
  const restarts = new Map<string, Promise<void>>();
  function restart(record: ProviderRecord) {
    const next = (restarts.get(record.id) ?? Promise.resolve()).then(async () => {
      await Promise.race([stop(record.id), new Promise((done) => setTimeout(done, 15_000).unref())]);
      await start(record);
    });
    restarts.set(record.id, next.catch(() => {}));
    return next;
  }

  async function record(id: unknown) {
    if (typeof id !== "string" || !id) return fail(400, "provider is required");
    return (await store.providers.get(id)) ?? fail(404, "provider not found");
  }

  for (const each of await store.providers.list()) await start(each);

  async function list(): Promise<Provider[]> {
    const held = await secrets.has();
    return (await store.providers.list()).map((r) => {
      const entry = models.entryOf(r);
      const device = entry.connect === "device";
      return {
        ...r,
        fields: r.fields ?? {},
        modelIds: r.modelIds ?? [],
        label: entry.name,
        connect: entry.connect,
        docs: entry.docs || null,
        hasKey: !device && held.has(r.id),
        signedIn: device && held.has(r.id),
        plugin: r.fields?.plugin ?? null,
        chat: entry.models !== "none",
        // A plugin's provider whose plugin isn't added says so.
        error: errors.get(r.id) ?? (r.fields?.plugin && !catalog.get(r.kind) ? `The ${r.fields.plugin} plugin isn't added.` : null),
      };
    });
  }
  const listed = async (id: string) => (await list()).find((p) => p.id === id)!;
  // The entry a new provider is added from: the catalog's, or one of models.dev's hosts in search.
  const entryFor = async (kind: unknown) =>
    (typeof kind === "string" && (catalog.get(kind) ?? catalog.more(await models.modelsDev().catch(() => ({}))).find((e) => e.id === kind))) ||
    fail(400, `kind ${String(kind)} isn't in fxbot's list of providers`);

  // One sign-in at a time. Its object stays here: what it holds can claim the tokens or the key.
  type Attempt = { id: string; kind: string; provider?: string; way: SignIn["way"]; status: SignInStatus; abort: AbortController; verifier?: string };
  let attempt: Attempt | undefined;

  async function signedIn(kind: string, provider: string | undefined, credentials: object) {
    if (provider) {
      const existing = await record(provider);
      await secrets.put(provider, credentials);
      await models.forget(provider);
      await restart(existing);
      return provider;
    }
    const entry = catalog.get(kind)!;
    const fresh: ProviderRecord = { id: newId(), kind, name: entry.name, baseUrl: entry.baseUrl ?? null, model: "", contextWindow: null, teamId: null, fields: {}, modelIds: null };
    // An account with one team needs no choice.
    if (kind === "vercel") {
      const teams = await vercel.teams((credentials as vercel.VercelCredentials).accessToken, fetch);
      if (teams.length === 1) fresh.teamId = teams[0].id;
    }
    await store.sql.begin(async (tx) => {
      await store.providers.save(fresh, tx as unknown as Sql);
      await secrets.put(fresh.id, credentials, tx as unknown as Sql);
    });
    await start(fresh);
    return fresh.id;
  }
  // A device code: the provider's code and page, then its tokens or key once the owner enters the code.
  function device(signIn: CatalogEntry["signIn"]): { start: () => Promise<Device | chatgpt.ChatgptDeviceSignIn>; complete: (device: any, signal: AbortSignal) => Promise<object> } {
    if (signIn === "vercel") return { start: () => vercel.startDeviceSignIn(vercelId(), fetch), complete: (d, signal) => vercel.completeDeviceSignIn(d, vercelId(), fetch, signal) };
    if (signIn === "huggingface") return { start: () => huggingface.start(hfId(), fetch), complete: (d, signal) => huggingface.complete(d, hfId(), fetch, signal) };
    if (signIn === "orcarouter") return { start: () => orcarouter.start(fetch), complete: (d, signal) => orcarouter.complete(d, fetch, signal) };
    const plan = plans[signIn as "chatgpt"];
    return { start: () => plan.startDeviceSignIn({ fetch }), complete: (d, signal) => plan.completeDeviceSignIn(d, { fetch, signal }) };
  }
  // A sign-in whose app this fxbot has: Vercel's and Hugging Face's need fxbot's own, from the environment or the catalog.
  const canSignIn = (entry: CatalogEntry) => (entry.signIn === "vercel" ? Boolean(vercelId()) : entry.signIn === "huggingface" ? Boolean(hfId()) : Boolean(entry.signIn));
  // OpenRouter's code, from its way back or pasted, makes the key once.
  async function finishCode(current: Attempt, code: unknown) {
    if (current.status.status !== "waiting") return current.status;
    if (typeof code !== "string" || !code.trim()) return fail(400, "code is required");
    try {
      const credentials = await openrouter.exchange(code.trim(), current.verifier!, fetch);
      current.status = { status: "done", provider: await signedIn(current.kind, current.provider, credentials) };
    } catch (error) {
      current.status = { status: "failed", error: (error as Error).message };
    }
    return current.status;
  }

  return {
    options,
    // The status a provider has been refusing with, if it did in the last 90 seconds.
    refusing(id: string) {
      const last = refused.get(id);
      return last && Date.now() - last.at < 90_000 ? last.status : undefined;
    },
    // The agent for a bot's provider, with the model metadata libfx reads when a turn opens its engine (libfx 0.0.16,
    // checked by hand). Vision stays on when unknown, so images are still tried.
    async agentFor(id: string, model: string) {
      await restarts.get(id);
      const entry = agents.get(id) ?? fail(400, errors.get(id) ?? "This bot's provider is gone. Pick another in its settings.");
      if (entry.models && model && !entry.models[model]) {
        const current = await record(id);
        const known = await access(current).then((a) => models.list(current, a)).then((list) => list.find((m) => m.id === model), () => undefined);
        const meta: FxCustomProviderModel = { supportsVision: known?.supportsVision ?? true };
        const contextWindow = current.contextWindow ?? known?.contextWindow;
        if (contextWindow) meta.contextWindow = contextWindow;
        if (known?.maxOutputTokens && (!contextWindow || known.maxOutputTokens < contextWindow)) meta.maxOutputTokens = known.maxOutputTokens;
        if (known?.supportsToolUse !== undefined) meta.supportsToolUse = known.supportsToolUse;
        entry.models[model] = meta;
      }
      return entry.agent;
    },
    has: (id: string) => agents.has(id),
    // Whether a provider serves chat models: not a voice service a plugin brought.
    servesChat: (record: ProviderRecord) => models.entryOf(record).models !== "none",
    // A plugin's request to an added provider, through fx.providers: the key goes on here, and never to the plugin.
    async request(id: string, url: string, init: RequestInit = {}) {
      const { current, entry, target } = await reach(id, url);
      const a = await access(current);
      if (a.fetch && !("apiKey" in a)) return a.fetch(target.href, init);
      const key = (a as { apiKey?: string }).apiKey;
      const headers = new Headers(init.headers);
      for (const [name, value] of Object.entries(keyHeaders(entry, key))) headers.set(name, value);
      return withoutSecrets(await fetch(target.href, { ...init, headers }), [key]);
    },
    // A plugin's WebSocket to an added provider, opened with its key in the headers, once it's open.
    async socket(id: string, url: string, protocols?: string | string[]) {
      const { current, entry, target } = await reach(id, url);
      if (target.protocol !== "wss:" && target.protocol !== "ws:") fail(400, "A socket's address starts with wss:.");
      const key = ((await access(current)) as { apiKey?: string }).apiKey;
      if (current.kind === "vercel") fail(400, "A Vercel sign-in opens no socket.");
      const ws = new WebSocket(target.href, { protocols, headers: keyHeaders(entry, key) } as unknown as string[]);
      ws.binaryType = "arraybuffer";
      await new Promise<void>((resolve, reject) => {
        ws.addEventListener("open", () => resolve(), { once: true });
        ws.addEventListener("error", () => reject(Object.assign(new Error(`${current.name} didn't open a socket at ${target.host}${target.pathname}.`), { status: 502 })), { once: true });
      });
      return ws;
    },
    // The providers a plugin sees: no key, only what each is.
    async forPlugins() {
      return (await list()).map((p) => ({ id: p.id, kind: p.kind, name: p.name, label: p.label, baseUrl: p.baseUrl }));
    },
    get: record,
    // A provider's name and its entry's, for words about it.
    async describe(id: string) {
      const current = await record(id);
      return { name: current.name, label: models.entryOf(current).name };
    },
    // Where a provider serves OpenAI's /embeddings, for memory search, with its key or its signed-in fetch.
    async embeddingsTarget(id: string): Promise<EmbeddingsTarget> {
      const current = await record(id);
      if (current.kind === "gateway") return { url: "https://ai-gateway.vercel.sh/v1/embeddings", apiKey: await keyOf(current), fetch };
      if (current.kind === "vercel") return { url: "https://ai-gateway.vercel.sh/v1/embeddings", fetch: vercelFetch(current) };
      if (!(embeddingKinds as readonly string[]).includes(current.kind)) return fail(400, `${models.entryOf(current).name} serves no embeddings.`);
      return { url: `${current.baseUrl}/embeddings`, apiKey: await keyOf(current), fetch };
    },
    list,
    // libfx fixes an agent's tools when it is made, so a new tool list, as when a plugin comes or goes, makes every
    // agent again.
    async retool(next: FxAgentTool[]) {
      tools = next;
      await Promise.all((await store.providers.list()).map(restart));
    },

    // What the Add provider page offers: entries whose way in this fxbot runs, a sign-in only where it has the app, and
    // models.dev's other hosts for search.
    async catalog(container: boolean) {
      const providers = catalog
        .list()
        .filter((e) => e.connect !== "device" || canSignIn(e))
        .map(({ clientId: _, ...e }) => (e.signIn && !canSignIn(e) ? { ...e, signIn: undefined } : e));
      // models.dev's hosts, once it's read: a first read waits a moment at most, and the page asks again when it searches.
      const hosts = await Promise.race([models.modelsDev().catch(() => ({})), new Promise<null>((done) => setTimeout(() => done(null), 1500).unref())]);
      return { providers, more: hosts ? catalog.more(hosts) : [], container };
    },
    local: () => catalog.local(),

    // Any entry but a sign-in's: a key, a server, or Vertex AI's service account. Plans and accounts are added by signing in.
    async add(input: NewProvider) {
      const entry = await entryFor(input?.kind);
      const kind = entry.id;
      if (entry.connect === "device") fail(400, `${entry.name} is added by signing in`);
      // A plugin's entry is remembered with the provider, so it stays a plugin's when the plugin is gone.
      const fields: Record<string, string> = { ...fieldsOf(entry, input.fields), ...(entry.plugin ? { plugin: entry.plugin } : {}) };
      const modelIds = idsOf(input.modelIds);
      if (entry.models === "typed" && !modelIds.length) fail(400, `Type the name of at least one of your ${entry.name} models`);
      let baseUrl: string | null = null;
      let apiKey = "";
      let held: Held | undefined;
      if (entry.connect === "service-account") {
        const serviceAccount = vertex.readServiceAccount(input.serviceAccount);
        baseUrl = checkBaseUrl(vertex.baseUrl(serviceAccount.project_id, fields.location ?? "global"));
        // Its check: Google makes a token from it.
        held = { serviceAccount, ...(await vertex.token(serviceAccount, fetch)) };
      } else if (kind !== "gateway") {
        baseUrl = checkBaseUrl(entry.connect === "url" ? input.baseUrl || entry.baseUrl : fill(entry.baseUrl ?? fail(400, `${entry.name} has no address`), entry, fields));
        apiKey = kind === "ollama" || kind === "lmstudio" ? "" : text(input.apiKey ?? "", "apiKey", 4096);
        if (entry.connect === "key" && !apiKey) fail(400, "apiKey is required");
        if (apiKey) held = { apiKey };
      } else {
        apiKey = text(input.apiKey ?? "", "apiKey", 4096) || fail(400, "apiKey is required");
        held = { apiKey };
      }
      const fresh: ProviderRecord = {
        id: newId(),
        kind,
        name: text(input.name ?? "", "name") || entry.name,
        baseUrl,
        model: text(input.model ?? "", "model"),
        contextWindow: entry.connect === "url" ? contextField(input.contextWindow ?? null) : null,
        teamId: null,
        fields,
        modelIds,
      };
      if (!held?.serviceAccount) await models.check(fresh, { apiKey, fetch: entryFetch(fetch, entry, async () => apiKey) });
      await store.sql.begin(async (tx) => {
        await store.providers.save(fresh, tx as unknown as Sql);
        if (held) await secrets.put(fresh.id, held, tx as unknown as Sql);
      });
      await start(fresh);
      return listed(fresh.id);
    },

    async update(id: string, input: ProviderUpdate) {
      const current = await record(id);
      const entry = models.entryOf(current);
      if (!input || typeof input !== "object") fail(400, "body must be a JSON object");
      if (input.apiKey !== undefined && entry.connect === "device") fail(400, "Sign in again to replace this provider's tokens.");
      if (input.apiKey !== undefined && entry.connect === "service-account") fail(400, "Choose a new service account file to replace this provider's.");
      if (input.serviceAccount !== undefined && entry.connect !== "service-account") fail(400, "Only Vertex AI takes a service account.");
      if (input.baseUrl !== undefined && entry.connect !== "url") fail(400, "This provider's address is fixed.");
      const next: ProviderRecord = {
        ...current,
        ...(input.name === undefined ? {} : { name: text(input.name, "name") || entry.name }),
        ...(input.model === undefined ? {} : { model: text(input.model, "model") }),
        ...(input.baseUrl === undefined ? {} : { baseUrl: checkBaseUrl(input.baseUrl) }),
        ...(input.modelIds === undefined ? {} : { modelIds: idsOf(input.modelIds) }),
        ...(input.contextWindow === undefined || entry.connect !== "url" ? {} : { contextWindow: contextField(input.contextWindow) }),
        ...(input.teamId === undefined || current.kind !== "vercel" ? {} : { teamId: text(input.teamId, "teamId") }),
      };
      if (entry.models === "typed" && !next.modelIds?.length) fail(400, `Type the name of at least one of your ${entry.name} models`);
      const apiKey = input.apiKey === undefined ? undefined : text(input.apiKey, "apiKey", 4096);
      if (apiKey === "" && entry.connect === "key") fail(400, "apiKey is required");
      let held: Held | undefined = apiKey ? { apiKey } : undefined;
      if (input.serviceAccount !== undefined) {
        const serviceAccount = vertex.readServiceAccount(input.serviceAccount);
        held = { serviceAccount, ...(await vertex.token(serviceAccount, fetch)) };
        next.baseUrl = checkBaseUrl(vertex.baseUrl(serviceAccount.project_id, current.fields?.location ?? "global"));
      }
      if (apiKey !== undefined || (next.baseUrl !== current.baseUrl && !held?.serviceAccount)) {
        const key = apiKey ?? (await bearerOf(current));
        await models.check(next, { apiKey: key, fetch: entryFetch(fetch, entry, async () => key) });
      }
      // An agent reads a custom provider's key at each request, once it has one, so a new key needs no new agent. Closing
      // the old one would wait for its turns, which may be stuck on the key this replaces.
      const keyed = current.kind !== "gateway" && Boolean(await secrets.get(id));
      await store.sql.begin(async (tx) => {
        await store.providers.save(next, tx as unknown as Sql);
        if (held) await secrets.put(id, held, tx as unknown as Sql);
      });
      const listChanged = held !== undefined || next.baseUrl !== current.baseUrl || next.teamId !== current.teamId || String(next.modelIds) !== String(current.modelIds);
      if (listChanged) await models.forget(id);
      if ((held !== undefined && !keyed) || next.baseUrl !== current.baseUrl || next.teamId !== current.teamId || next.contextWindow !== current.contextWindow) await restart(next);
      return listed(id);
    },

    // `stopTurns` ends what's running on it, which closing the agent waits for. A tool that ignores that gets 15 seconds:
    // the key goes either way, and a request after that fails.
    async remove(id: string, stopTurns: () => Promise<void>) {
      await record(id);
      const bots = await store.profiles.usingProvider(id);
      if (bots) fail(400, `${bots} bot${bots === 1 ? " uses" : "s use"} this provider. Move ${bots === 1 ? "it" : "them"} to another first.`);
      await stopTurns();
      // A restart under way would bring the agent back, so it finishes first.
      const closed = (async () => (await restarts.get(id), await stop(id)))();
      await Promise.race([closed, new Promise((done) => setTimeout(done, 15_000).unref())]);
      await store.providers.remove(id);
      secrets.forget(id);
      await models.forget(id);
      if ((await store.settings.get()).defaultProvider === id) await store.settings.save({ defaultProvider: "" });
    },

    async models(id: string) {
      const current = await record(id);
      return models.list(current, await access(current));
    },
    // A model's context window, from the provider's own setting or its kept model list, when either knows it.
    async contextWindow(id: string, model: string) {
      const current = await record(id);
      if (current.contextWindow) return current.contextWindow;
      const list = await access(current).then((a) => models.list(current, a), () => []);
      return list.find((m) => m.id === model)?.contextWindow;
    },

    async teams(id: string) {
      const current = await record(id);
      if (current.kind !== "vercel") fail(400, "Only a Vercel account has teams.");
      const { accessToken } = await renewed<vercel.VercelCredentials>(id, (old) => vercel.refresh(old, vercelId(), fetch));
      return vercel.teams(accessToken, fetch);
    },

    signIns: {
      // `origin` is the page's own, which the server checked against the address it was reached at. OpenRouter comes back
      // to it when it can, and shows a code to paste when it can't, or when the page asks for `paste`.
      async start({ kind, provider, way }: { kind: string; provider?: string; way?: string }, origin?: string): Promise<SignIn> {
        const entry = (typeof kind === "string" && catalog.get(kind)) || fail(400, `kind ${String(kind)} isn't in fxbot's list of providers`);
        if (!entry.signIn) fail(400, `${entry.name} has no sign-in`);
        if (entry.signIn === "vercel" && !vercelId()) fail(400, "Set FXBOT_VERCEL_CLIENT_ID to sign in with a Vercel account.");
        if (entry.signIn === "huggingface" && !hfId()) fail(400, "Set FXBOT_HF_CLIENT_ID to sign in with Hugging Face.");
        if (provider !== undefined && (await record(provider)).kind !== kind) fail(400, `provider ${provider} is not a ${entry.name} provider`);
        if (attempt?.status.status === "waiting") {
          attempt.abort.abort();
          attempt.status = { status: "failed", error: "A newer sign-in replaced this one." };
        }
        const current: Attempt = { id: newId(), kind, provider, way: "device", status: { status: "waiting" }, abort: new AbortController() };
        const signal = current.abort.signal;
        if (entry.signIn === "openrouter") {
          const back = way !== "paste" && comesBack(origin) ? `${origin}/api/sign-ins/${current.id}/callback` : undefined;
          const begun = openrouter.begin(back, current.id);
          Object.assign(current, { verifier: begun.verifier, way: back ? "redirect" : "paste" });
          attempt = current;
          // OpenRouter's code is good for 10 minutes.
          const expiresAt = Date.now() + 10 * 60_000;
          setTimeout(() => current.status.status === "waiting" && !signal.aborted && (current.status = { status: "failed", error: "The sign-in took too long. Start again." }), expiresAt - Date.now()).unref();
          return { id: current.id, way: current.way, url: begun.url, expiresAt };
        }
        const run = device(entry.signIn);
        let started;
        try {
          started = await run.start();
        } catch (error) {
          return fail(502, (error as Error).message);
        }
        attempt = current;
        run
          .complete(started, signal)
          .then((credentials) => signedIn(kind, provider, credentials))
          .then(
            (id) => !signal.aborted && (current.status = { status: "done", provider: id }),
            (error: Error) => !signal.aborted && (current.status = { status: "failed", error: error.message }),
          );
        return { id: current.id, way: "device", verificationUrl: started.verificationUrl, userCode: started.userCode, expiresAt: started.expiresAt };
      },
      get: (id: string) => (attempt?.id === id ? attempt.status : fail(404, "sign-in not found")),
      cancel(id: string) {
        if (attempt?.id !== id) return fail(404, "sign-in not found");
        if (attempt.status.status === "waiting") {
          attempt.abort.abort();
          attempt.status = { status: "failed", error: "Cancelled." };
        }
      },
      // OpenRouter's way back, with its code, and its state, which is the attempt's id.
      async callback(id: string, query: URLSearchParams) {
        if (attempt?.id !== id || attempt.way !== "redirect") return fail(404, "This sign-in isn't the one waiting. Start again from fxbot.");
        if (query.has("state") && query.get("state") !== id) return fail(400, "This sign-in came back for another one. Start again from fxbot.");
        if (!query.get("code")) return fail(400, "OpenRouter sent no code back. The sign-in may have been declined.");
        return finishCode(attempt, query.get("code"));
      },
      // OpenRouter's code, pasted from its page.
      async code(id: string, code: unknown) {
        if (attempt?.id !== id || !attempt.verifier) return fail(404, "sign-in not found");
        return finishCode(attempt, code);
      },
    },

    close: async () => Promise.all([...agents.keys()].map(stop)),
  };
}

export type Providers = Awaited<ReturnType<typeof createProviders>>;
