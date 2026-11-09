import { listModels } from "libfx";
import type postgres from "postgres";
import { fill, modelsDevIds, type ProviderCatalog } from "./catalog.ts";
import type { ProviderRecord, Sql } from "./store.ts";
import type { CatalogEntry, Model } from "./types.ts";

type Fetch = typeof fetch;
const day = 24 * 60 * 60 * 1000;
const cacheMs = 5 * 60 * 1000;

// A failed list says which source failed and its status, so a bad key never looks like an empty list. `upstream`
// is the source's own status, for the key check.
const failed = (what: string, upstream?: number) =>
  Object.assign(new Error(`${what} failed${upstream ? ` (HTTP ${upstream})` : ""}.`), { status: 502, upstream });

async function getJson(fetch: Fetch, url: string, init: RequestInit, what: string) {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw Object.assign(new Error(`${what} couldn't reach ${new URL(url).host}.`), { status: 502 });
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => {});
    throw failed(what, response.status);
  }
  return response.json();
}

const bearer = (token?: string): Record<string, string> => (token ? { authorization: `Bearer ${token}` } : {});

// Chat models only: models.dev also lists embedding, speech, and image models, and models some hosts serve only over
// Anthropic's or Google's API, which libfx's custom providers do not speak.
const isChat = (m: any) =>
  m.status !== "deprecated" &&
  (m.modalities?.output ?? ["text"]).includes("text") &&
  !String(m.family ?? "").includes("embedding") &&
  !String(m.id).includes("embedding") &&
  [undefined, "@ai-sdk/openai", "@ai-sdk/openai-compatible"].includes(m.provider?.npm);
const fromModelsDev = (m: any): Model => ({
  id: m.id,
  name: m.name,
  contextWindow: m.limit?.context,
  maxOutputTokens: m.limit?.output,
  supportsToolUse: m.tool_call,
  supportsVision: m.modalities?.input?.includes("image"),
});
// What fxbot keeps of models.dev, for every host: what the long tail in search needs, each chat model's details, and the
// ids it knows aren't chat models, so a host's own list can leave them out.
type Host = { name: string; api?: string; doc?: string; npm?: string; models: Record<string, Model & { canonical?: string }>; other: string[] };
function trim(all: Record<string, any>): Record<string, Host> {
  return Object.fromEntries(
    Object.entries(all).map(([id, p]) => {
      const models = Object.values(p?.models ?? {}) as any[];
      return [
        id,
        {
          name: p?.name ?? id,
          api: p?.api,
          doc: p?.doc,
          npm: p?.npm,
          models: Object.fromEntries(models.filter(isChat).map((m) => [m.id, { ...fromModelsDev(m), ...(m.canonical_model_id ? { canonical: m.canonical_model_id } : {}) }])),
          other: models.filter((m) => !isChat(m)).map((m) => m.id),
        },
      ];
    }),
  );
}

// A model id matches a pattern in `hide`, where `*` stands for anything.
const hidden = (id: string, patterns: string[] = []) => patterns.some((p) => new RegExp(`^${p.split("*").map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*")}$`).test(id));

// What a provider needs to be asked for its models: its key, a plan's tokens, or a fetch that adds its headers or a
// Vercel login.
export type Access = { apiKey?: string; accessToken?: string; accountId?: string; fetch?: Fetch };

type Kept = { at: number; models: Model[] };

// The kinds with a list of their own, in code; every other kind takes its list as its catalog entry says. Each list is
// kept in memory and in Postgres, so a restart still has it; one older than 5 minutes is fetched again behind the answer.
export function createModels(sql: Sql, fetch: Fetch, catalog: ProviderCatalog) {
  const cache = new Map<string, Kept>();
  const pending = new Map<string, Promise<Kept>>();
  // A list fetched for an old key or address is dropped rather than kept.
  const generation = new Map<string, number>();
  let codex: { at: number; version: string } | undefined;
  let hosts: { at: number; data: Record<string, Host> } | undefined;

  // Codex may hide newer models from an older client, so fx asks with the current Codex CLI version.
  async function codexVersion() {
    if (!codex || Date.now() - codex.at > day)
      codex = { at: Date.now(), version: (await getJson(fetch, "https://registry.npmjs.org/@openai/codex/latest", {}, "The Codex version lookup")).version };
    return codex.version;
  }

  // models.dev, at most once a day with its ETag, trimmed to what fxbot uses. A stale copy beats none. A copy kept by an
  // older fxbot, the four hosts it used, serves until the first fetch.
  async function modelsDev(): Promise<Record<string, Host>> {
    if (hosts && Date.now() - hosts.at < day) return hosts.data;
    const row = (await sql`select etag, data, fetched_at from models_dev`)[0];
    const current = row?.data?.v === 2;
    const kept = (): Record<string, Host> => (current ? row.data.hosts : trim(Object.fromEntries(Object.entries(row?.data ?? {}).filter(([, p]) => p))));
    if (current && Date.now() - row.fetchedAt < day) return (hosts = { at: new Date(row.fetchedAt).getTime(), data: row.data.hosts }).data;
    try {
      const response = await fetch("https://models.dev/api.json", { headers: current && row.etag ? { "if-none-match": row.etag } : {} });
      if (response.status === 304 && current) {
        await sql`update models_dev set fetched_at = now()`;
        return (hosts = { at: Date.now(), data: row.data.hosts }).data;
      }
      if (!response.ok) throw failed("models.dev", response.status);
      const data = trim(await response.json());
      await sql`insert into models_dev values (1, ${response.headers.get("etag")}, ${sql.json({ v: 2, hosts: data } as unknown as postgres.JSONValue)}, now())
        on conflict (id) do update set etag = excluded.etag, data = excluded.data, fetched_at = excluded.fetched_at`;
      return (hosts = { at: Date.now(), data }).data;
    } catch (error) {
      if (row?.data) return kept();
      throw error instanceof Error && "upstream" in error ? error : failed("Reaching models.dev");
    }
  }

  // An entry for a kind the catalog doesn't name: one from models.dev's long tail, whose kind is its models.dev id, or
  // one the catalog has since dropped. Either is a key at the address it was added with.
  const entryOf = (record: ProviderRecord): CatalogEntry =>
    catalog.get(record.kind) ?? { id: record.kind, name: record.name, about: "", group: "key", connect: "key", modelsDev: record.kind, docs: "" };

  // models.dev's lists for an entry, and the ids it knows aren't chat models.
  async function hostsOf(entry: CatalogEntry) {
    const ids = modelsDevIds(entry);
    if (!ids.length) return { models: new Map<string, Model & { canonical?: string }>(), other: new Set<string>() };
    const data = await modelsDev();
    const found = ids.map((id) => data[id]).filter(Boolean);
    return { models: new Map(found.flatMap((h) => Object.entries(h.models))), other: new Set(found.flatMap((h) => h.other)) };
  }

  // A host's own list, with what it says itself of each model: OpenRouter's shape, Groq's, vLLM's, and Hugging Face's
  // router, which lists each provider behind a model.
  function ownList(body: any, textOnly = false): Model[] {
    return (Array.isArray(body?.data) ? body.data : []).flatMap((m: any) => {
      if (typeof m?.id !== "string") return [];
      if (textOnly && Array.isArray(m.architecture?.output_modalities) && !m.architecture.output_modalities.includes("text")) return [];
      const behind: any[] = Array.isArray(m.providers) ? m.providers : [];
      const context = m.context_length ?? m.context_window ?? m.max_model_len ?? (behind.length ? Math.max(0, ...behind.map((p) => Number(p.context_length) || 0)) || undefined : undefined);
      const tools = behind.length ? behind.some((p) => p.supports_tools) : Array.isArray(m.supported_parameters) ? m.supported_parameters.includes("tools") : undefined;
      const vision = Array.isArray(m.architecture?.input_modalities) ? m.architecture.input_modalities.includes("image") : undefined;
      return [{ id: m.id, ...(typeof m.name === "string" ? { name: m.name } : {}), ...(Number.isFinite(context) ? { contextWindow: Number(context) } : {}), ...(tools === undefined ? {} : { supportsToolUse: tools }), ...(vision === undefined ? {} : { supportsVision: vision }) }];
    });
  }

  // An entry's list: the provider's own, its models.dev list where it has none, or the ids typed for it. Each model gets
  // models.dev's details by exact id, then without a vendor prefix, then by its canonical id, under what the host says.
  async function entryList(record: ProviderRecord, entry: CatalogEntry, access: Access): Promise<Model[]> {
    const md = await hostsOf(entry).catch(() => ({ models: new Map<string, Model & { canonical?: string }>(), other: new Set<string>() }));
    const fromCatalog = () => [...md.models.values()];
    const typed = () => (record.modelIds ?? []).map((id) => ({ id }));
    let list: Model[];
    if (entry.models === "typed") list = typed();
    else if (entry.models === "catalog") list = fromCatalog();
    else
      try {
        list = ownList(await getJson(access.fetch ?? fetch, `${record.baseUrl}/models`, { headers: bearer(access.apiKey) }, "The model list"), record.kind === "anyrouter").filter((m) => !md.other.has(m.id));
      } catch (error) {
        // A server with no list there: the catalog's, or the ids typed for it.
        const upstream = (error as { upstream?: number }).upstream;
        if (upstream !== 404 && upstream !== 405) throw error;
        list = record.modelIds?.length ? typed() : md.models.size ? fromCatalog() : [];
        if (!list.length) throw error;
      }
    // Ids typed for a server that lists models too come after its own.
    if (entry.models !== "typed") list.push(...typed().filter((m) => !list.some((other) => other.id === m.id)));
    const bare = new Map([...md.models.values()].map((m) => [m.id.split("/").at(-1)!, m]));
    const canonical = new Map([...md.models.values()].flatMap((m) => (m.canonical ? [[m.canonical, m] as const] : [])));
    return list
      .filter((m) => !hidden(m.id, entry.hide))
      .map((m) => {
        const known = md.models.get(m.id) ?? bare.get(m.id.split("/").at(-1)!) ?? canonical.get(m.id);
        const { canonical: _, ...details } = known ?? { id: m.id };
        const id = entry.modelPrefix && !m.id.includes("/") ? `${entry.modelPrefix}${m.id}` : m.id;
        return Object.fromEntries(Object.entries({ ...details, ...m, id }).filter(([, value]) => value !== undefined)) as Model;
      });
  }

  async function fetchList(record: ProviderRecord, access: Access): Promise<Model[]> {
    const origin = record.baseUrl ? new URL(record.baseUrl).origin : "";
    switch (record.kind) {
      case "chatgpt": {
        const url = `https://chatgpt.com/backend-api/codex/models?client_version=${await codexVersion()}`;
        const body = await getJson(fetch, url, { headers: { ...bearer(access.accessToken), "chatgpt-account-id": access.accountId! } }, "The ChatGPT model list");
        return body.models
          .filter((m: any) => m.visibility === "list" && m.supported_in_api)
          .map((m: any) => ({ id: m.slug, name: m.display_name, contextWindow: m.context_window, supportsVision: m.input_modalities?.includes("image") }));
      }
      case "grok": {
        const body = await getJson(fetch, "https://cli-chat-proxy.grok.com/v1/models", { headers: { ...bearer(access.accessToken), "x-userid": access.accountId! } }, "The Grok model list");
        return body.data
          .filter((m: any) => m.api_backend === "responses")
          .map((m: any) => ({ id: m.model ?? m.id, contextWindow: m.context_window, maxOutputTokens: m.max_completion_tokens }));
      }
      case "gateway":
      case "vercel":
        try {
          return (await listModels({ apiKey: access.apiKey ?? "vercel", fetch: access.fetch ?? fetch })).map((id) => ({ id }));
        } catch (error) {
          // libfx names only the HTTP status; anything else, such as a Vercel account with no team yet, keeps its own words.
          const upstream = Number(/HTTP (\d+)/.exec((error as Error).message)?.[1]);
          throw upstream ? failed("The AI Gateway model list", upstream) : Object.assign(error as Error, { status: 502 });
        }
      case "ollama": {
        const tags = await getJson(fetch, `${origin}/api/tags`, {}, "Ollama's model list");
        const shown = await Promise.all(
          tags.models.map(async (m: any) => ({
            id: m.name as string,
            show: await getJson(fetch, `${origin}/api/show`, { method: "POST", body: JSON.stringify({ model: m.name }) }, `Ollama's details for ${m.name}`),
          })),
        );
        return shown
          .filter(({ show }) => show.capabilities?.includes("completion"))
          .map(({ id, show }) => ({
            id,
            supportsToolUse: show.capabilities.includes("tools"),
            supportsVision: show.capabilities.includes("vision"),
            contextWindow: Object.entries(show.model_info ?? {}).find(([key, value]) => key.endsWith(".context_length") && typeof value === "number")?.[1] as number | undefined,
          }));
      }
      case "lmstudio": {
        const body = await getJson(fetch, `${origin}/api/v1/models`, {}, "LM Studio's model list");
        return body.models
          .filter((m: any) => m.type === "llm")
          .map((m: any) => ({
            id: m.key,
            name: m.display_name,
            supportsToolUse: m.capabilities?.trained_for_tool_use,
            supportsVision: m.capabilities?.vision,
            contextWindow: m.loaded_instances?.length ? Math.min(...m.loaded_instances.map((i: any) => i.config.context_length)) : m.max_context_length,
          }));
      }
      case "custom":
        return entryList(record, { ...entryOf(record), modelsDev: undefined }, access);
      default:
        return entryList(record, entryOf(record), access);
    }
  }

  async function kept(id: string): Promise<Kept | undefined> {
    const hit = cache.get(id);
    if (hit) return hit;
    const row = (await sql<{ models: Model[]; fetchedAt: Date }[]>`select models, fetched_at from model_lists where provider_id = ${id}`)[0];
    if (!row) return undefined;
    const found = { at: new Date(row.fetchedAt).getTime(), models: row.models };
    cache.set(id, found);
    return found;
  }

  // Fetches a provider's list and keeps it. Asks while one runs share it.
  function refresh(record: ProviderRecord, access: Access) {
    const running = pending.get(record.id);
    if (running) return running;
    const started = generation.get(record.id) ?? 0;
    const next = (async () => {
      const models = (await fetchList(record, access)).sort((a, b) => a.id.localeCompare(b.id));
      const found = { at: Date.now(), models };
      if ((generation.get(record.id) ?? 0) !== started) return found;
      cache.set(record.id, found);
      await sql`insert into model_lists (provider_id, models, fetched_at) values (${record.id}, ${sql.json(models as unknown as postgres.JSONValue)}, now())
        on conflict (provider_id) do update set models = excluded.models, fetched_at = excluded.fetched_at`;
      return found;
    })().finally(() => pending.delete(record.id));
    pending.set(record.id, next);
    return next;
  }

  return {
    modelsDev,
    entryOf,
    // What the provider listed last answers at once, and a list older than 5 minutes is fetched again behind it, for
    // the next look. A failed refresh keeps the old list. Only a provider never listed waits for its first fetch.
    // The provider's own context field wins over what its server reports.
    async list(record: ProviderRecord, access: Access) {
      let found = await kept(record.id);
      if (!found) found = await refresh(record, access);
      else if (Date.now() - found.at > cacheMs) refresh(record, access).catch(() => {});
      const window = record.contextWindow;
      return window ? found.models.map((m) => ({ ...m, contextWindow: window })) : found.models;
    },
    // A new key, address, team, or sign-in may list other models.
    async forget(id: string) {
      generation.set(id, (generation.get(id) ?? 0) + 1);
      cache.delete(id);
      await sql`delete from model_lists where provider_id = ${id}`;
    },
    // A key is checked where its entry says a bad one is refused, `keyCheck`, or at `/models`, where a 404 passes, since
    // some servers serve no list there. AI Gateway and the local servers are checked by listing.
    async check(record: ProviderRecord, access: Access) {
      const entry = entryOf(record);
      try {
        if (["gateway", "ollama", "lmstudio"].includes(record.kind)) await fetchList(record, access);
        else await getJson(access.fetch ?? fetch, entry.keyCheck ? fill(entry.keyCheck, entry, record.fields ?? {}) : `${record.baseUrl}/models`, { headers: bearer(access.apiKey) }, "The key check");
      } catch (error) {
        const upstream = (error as { upstream?: number }).upstream;
        if (upstream === 404) return;
        // A check that isn't served where this provider is, as in a region without Bedrock's mantle.
        if (!upstream && entry.optionalCheck && entry.keyCheck) return;
        if (upstream && (entry.badKey ?? [401, 403]).includes(upstream)) {
          // What each refusal most likely means.
          const why = upstream === 401 ? "it's wrong, or it was deleted" : upstream === 403 ? "it may lack a permission, or the account may need credit" : "it isn't a key it can read";
          throw Object.assign(new Error(`${entry.name || "The provider"} rejected this key (HTTP ${upstream}): ${why}.`), { status: 400 });
        }
        throw Object.assign(new Error((error as Error).message), { status: 400 });
      }
    },
  };
}
