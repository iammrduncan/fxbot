import { readFileSync } from "node:fs";
import type { CatalogEntry, CatalogField, LocalServer } from "./types.ts";

// fxbot's catalog of providers, `providers-registry.json`: the copy this release shipped with, replaced by the one
// fxbot.sh publishes, read at start and hourly, as the plugins list is. An entry this release can't run, such as a way
// in it has no code for, is left out, so an older fxbot never offers a button it can't carry out.
type Fetch = typeof fetch;
const hour = 60 * 60 * 1000;
const groups = ["sign-in", "key", "cloud", "local", "custom"];
const connects = ["device", "key", "url", "service-account"];
export const signInCodes = ["chatgpt", "grok", "vercel", "openrouter", "huggingface", "orcarouter"];
const isText = (value: unknown, max = 1000) => typeof value === "string" && value.length <= max;
const isUrl = (value: unknown) => isText(value) && /^(https:\/\/|http:\/\/(localhost|127\.0\.0\.1)[:/])/.test(value as string);

const field = (f: CatalogField) =>
  f &&
  /^[a-z]{1,20}$/.test(f.name) &&
  isText(f.label, 80) &&
  (f.default === undefined || isText(f.default, 100)) &&
  (f.hint === undefined || isText(f.hint, 300)) &&
  (f.options === undefined || (Array.isArray(f.options) && f.options.every((o) => isText(o?.value, 100) && isText(o?.label, 80))));

export function usable(e: CatalogEntry): boolean {
  if (!e || typeof e !== "object" || !/^[a-z0-9][a-z0-9-]{0,40}$/.test(e.id) || !isText(e.name, 80) || !isText(e.about, 300) || !isText(e.docs)) return false;
  if (!groups.includes(e.group) || !connects.includes(e.connect)) return false;
  // A device code is only ever a sign-in, and only Vertex AI makes tokens from a service account.
  if (e.signIn !== undefined && !signInCodes.includes(e.signIn)) return false;
  if (e.connect === "device" && !e.signIn) return false;
  if (e.connect === "service-account" && e.id !== "vertex") return false;
  if (e.baseUrl !== undefined && !isUrl(e.baseUrl)) return false;
  if (e.keyCheck !== undefined && !isUrl(e.keyCheck)) return false;
  if (e.keyPage !== undefined && !isUrl(e.keyPage)) return false;
  if (e.fields !== undefined && !(Array.isArray(e.fields) && e.fields.every(field))) return false;
  if (e.steps !== undefined && !(Array.isArray(e.steps) && e.steps.every((step) => isText(step, 300)))) return false;
  if (e.headers !== undefined && !(e.headers && typeof e.headers === "object" && Object.entries(e.headers).every(([k, v]) => /^[A-Za-z0-9-]{1,60}$/.test(k) && isText(v, 300)))) return false;
  if (e.optionalCheck !== undefined && typeof e.optionalCheck !== "boolean") return false;
  if (e.badKey !== undefined && !(Array.isArray(e.badKey) && e.badKey.every((n) => Number.isInteger(n) && n >= 400 && n < 500))) return false;
  if (e.hide !== undefined && !(Array.isArray(e.hide) && e.hide.every((h) => isText(h, 100)))) return false;
  if (e.models !== undefined && !["own", "catalog", "typed", "none"].includes(e.models)) return false;
  if (e.hosts !== undefined && !(Array.isArray(e.hosts) && e.hosts.length <= 10 && e.hosts.every((h) => isText(h, 300) && /^(https|wss):\/\/[^/?#\s]+$|^(http|ws):\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(h)))) return false;
  if (e.modelsDev !== undefined && !(isText(e.modelsDev, 60) || (Array.isArray(e.modelsDev) && e.modelsDev.every((m) => isText(m, 60))))) return false;
  return true;
}

const shipped = () => (JSON.parse(readFileSync(new URL("./providers-registry.json", import.meta.url), "utf8")) as { providers: CatalogEntry[] }).providers.filter(usable);
export const modelsDevIds = (e: Pick<CatalogEntry, "modelsDev">) => (e.modelsDev === undefined ? [] : [e.modelsDev].flat());

// An address with fields, as `https://bedrock-runtime.{region}.amazonaws.com/openai/v1`, filled in. A field with
// options takes one of them; any other takes a name, such as an account id or a resource, and nothing that could
// change the address's shape.
export function fill(template: string, entry: Pick<CatalogEntry, "fields">, values: Record<string, string>) {
  return template.replace(/\{([a-z]+)\}/g, (_, name: string) => {
    const spec = entry.fields?.find((f) => f.name === name);
    const value = String(values[name] ?? spec?.default ?? "").trim();
    if (!value) throw Object.assign(new Error(`${spec?.label ?? name} is required`), { status: 400 });
    if (spec?.options ? !spec.options.some((o) => o.value === value) : !/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(value))
      throw Object.assign(new Error(`${spec?.label ?? name} isn't one fxbot can use`), { status: 400 });
    return value;
  });
}

export function createCatalog({ url, fetch, sync = true }: { url?: string; fetch: Fetch; sync?: boolean }) {
  const ours = shipped();
  let entries = ours;
  // The entries plugins bring, by plugin, while each is added: a voice service for phone, say. Each serves no chat model.
  const brought = new Map<string, CatalogEntry[]>();
  const fromPlugins = () => [...brought.values()].flat();
  async function refresh() {
    if (!url) return;
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) }).catch(() => null);
    const page = res?.ok ? ((await res.json().catch(() => null)) as { providers?: unknown } | null) : null;
    if (Array.isArray(page?.providers)) entries = (page.providers as CatalogEntry[]).filter(usable);
    else console.error(`fxbot's providers list didn't answer${res ? ` (HTTP ${res.status})` : ""}; keeping the one it had.`);
  }
  if (sync && url) {
    void refresh();
    setInterval(() => void refresh(), hour).unref();
  }
  return {
    refresh,
    list: () => [...entries, ...fromPlugins()],
    // A provider's entry, from the list as it is now, or as this release shipped it, for one the list has dropped, or
    // from a plugin that's added.
    get: (kind: string) => entries.find((e) => e.id === kind) ?? ours.find((e) => e.id === kind) ?? fromPlugins().find((e) => e.id === kind),
    // A plugin's entries, in place of those it brought before: each one this fxbot can run, that serves no chat model,
    // and whose id fxbot's catalog and other plugins don't use. Answers the ids it left out.
    bring(plugin: string, offered: unknown[]): string[] {
      const others = new Set([...entries, ...ours, ...[...brought].filter(([name]) => name !== plugin).flatMap(([, list]) => list)].map((e) => e.id));
      const kept: CatalogEntry[] = [];
      const left: string[] = [];
      for (const raw of offered) {
        const { plugin: _, ...e } = (raw ?? {}) as CatalogEntry;
        if (usable(e as CatalogEntry) && e.models === "none" && e.connect !== "device" && e.connect !== "service-account" && !others.has(e.id) && !kept.some((k) => k.id === e.id))
          kept.push({ ...(e as CatalogEntry), plugin });
        else left.push(typeof e?.id === "string" ? e.id : "an entry");
      }
      if (kept.length) brought.set(plugin, kept);
      else brought.delete(plugin);
      return left;
    },
    drop: (plugin: string) => void brought.delete(plugin),
    // models.dev's other OpenAI-compatible hosts at a fixed HTTPS address, for search. Each is a key entry, named by its
    // models.dev id, which is the provider's kind once added.
    more(modelsDev: Record<string, any>): CatalogEntry[] {
      const covered = new Set(entries.flatMap((e) => [e.id, ...modelsDevIds(e)]));
      return Object.entries(modelsDev)
        .filter(([id, p]) => !covered.has(id) && p?.npm === "@ai-sdk/openai-compatible" && typeof p.api === "string" && /^https:\/\/[^${}\s]+$/.test(p.api) && typeof p.name === "string")
        .map(([id, p]) => ({ id, name: p.name, about: "From models.dev", group: "key" as const, connect: "key" as const, baseUrl: p.api.replace(/\/+$/, ""), modelsDev: id, docs: typeof p.doc === "string" && /^https:\/\//.test(p.doc) ? p.doc : "" }))
        .filter(usable)
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    // The local servers that answer at their usual address, each asked for its model list with half a second to answer.
    async local(): Promise<LocalServer[]> {
      const asked = entries.filter((e) => e.group === "local" && e.baseUrl);
      const found = await Promise.all(
        asked.map(async (e) => {
          const res = await fetch(`${e.baseUrl}/models`, { signal: AbortSignal.timeout(500) }).catch(() => null);
          const ok = res?.ok && (await res.json().then((body) => Array.isArray(body?.data), () => false));
          return ok ? { kind: e.id, baseUrl: e.baseUrl! } : null;
        }),
      );
      return found.filter((server) => server !== null);
    },
  };
}
export type ProviderCatalog = ReturnType<typeof createCatalog>;
