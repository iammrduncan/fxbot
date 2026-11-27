import type { PluginApi } from "@fxbot/sdk";

// What every adapter shares: the providers it serves, the jobs it can do, and the one shape each job gives back, so a
// tool works the same whichever provider answers it (docs/phases/web-tooling.md, The providers).

/** A provider the owner added, as fx.providers lists it. */
export type Added = { id: string; kind: string; name: string; label: string; baseUrl: string | null };
export type Depth = "quick" | "normal" | "deep";
export type Recency = "day" | "week" | "month" | "year";
export type Options = Record<string, unknown>;
export type SearchInput = { query: string; count: number; depth: Depth; text: boolean; recency?: Recency; domains: string[]; exclude: string[]; options: Options };
export type Result = { title: string; url: string; snippet: string; published?: string; text?: string };
export type Searched = { results: Result[]; cost?: string };
export type Read = { title: string; url: string; markdown: string; cost?: string };
export type Researched = { answer: string; sources: { title: string; url: string }[]; cost?: string };
export type Job = "search" | "read" | "research";

export type Adapter = {
  kinds: string[];
  search?: (fx: PluginApi, p: Added, input: SearchInput, signal: AbortSignal) => Promise<Searched>;
  read?: (fx: PluginApi, p: Added, input: { url: string; options: Options }, signal: AbortSignal) => Promise<Read>;
  research?: (fx: PluginApi, p: Added, input: { question: string; depth: Depth; options: Options }, signal: AbortSignal) => Promise<Researched>;
};

/** Why a provider's call failed, in words the bot and the owner both read. */
export class ProviderError extends Error {}

const said = (body: unknown) => {
  if (!body || typeof body !== "object") return typeof body === "string" ? body.slice(0, 300) : "";
  const b = body as Record<string, any>;
  const message = b.error?.message ?? b.error ?? b.message ?? b.detail?.message ?? b.detail ?? b.errors?.[0]?.message ?? "";
  return (typeof message === "string" ? message : JSON.stringify(message)).slice(0, 300);
};

/** A request to one of the provider's own addresses, its key added by fxbot, answering its JSON. */
export async function call(fx: PluginApi, p: Added, url: string, init: { method?: string; body?: unknown; headers?: Record<string, string> }, signal: AbortSignal): Promise<any> {
  const res = await fx.providers.fetch(p.id, url, {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"),
    headers: { accept: "application/json", ...(init.body === undefined ? {} : { "content-type": "application/json" }), ...init.headers },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    signal,
  }).catch((error: Error) => {
    if (signal.aborted) throw error;
    throw new ProviderError(`${p.name} didn't answer: ${error.message}`);
  });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {}
  if (!res.ok) {
    const why = said(body) || res.statusText;
    const hint = res.status === 401 || res.status === 403 ? " Its key may be wrong: check it in Settings › Providers." : res.status === 402 ? " Its account may be out of credits." : res.status === 429 ? " It's asking for fewer requests: try again in a minute." : "";
    throw new ProviderError(`${p.name} answered ${res.status}${why ? `: ${why}` : ""}.${hint}`);
  }
  if (typeof body === "string") throw new ProviderError(`${p.name} answered with something that isn't JSON.`);
  return body;
}

/** The provider's address: the one it was added with, else its entry's. */
export const baseOf = (p: Added, fallback: string) => (p.baseUrl ?? fallback).replace(/\/+$/, "");
/** A query that keeps to some sites, or leaves some out, for a provider with no filter of its own. */
export const withSites = (query: string, domains: string[], exclude: string[]) =>
  [query, domains.length ? `(${domains.map((d) => `site:${d}`).join(" OR ")})` : "", ...exclude.map((d) => `-site:${d}`)].filter(Boolean).join(" ");
/** The date `recency` reaches back to, as YYYY-MM-DD. */
export const since = (recency: Recency) => new Date(Date.now() - { day: 1, week: 7, month: 31, year: 366 }[recency] * 86_400_000).toISOString().slice(0, 10);
/** A reply's shape, its fields, each string's length, and each list's count, with none of its values: what a provider
 * answered when it wasn't what was expected, for the bot and the owner to read. */
export function shape(value: unknown, depth = 0): string {
  if (Array.isArray(value)) return `[${value.length}${value.length && depth < 3 ? ` ${shape(value[0], depth + 1)}` : ""}]`;
  if (value && typeof value === "object") {
    if (depth >= 3) return "{…}";
    const fields = Object.entries(value).slice(0, 20).map(([k, v]) => `${k}${v && typeof v === "object" ? shape(v, depth + 1) : `: ${typeof v}${typeof v === "string" ? ` (${v.length})` : ""}`}`);
    return `{ ${fields.join(", ")} }`;
  }
  return typeof value;
}
export const str = (value: unknown) => (typeof value === "string" ? value : value == null ? "" : String(value));
/** A provider's results, cut to the count asked for, with the ones that have no address left out. */
export const results = (list: unknown, map: (item: any) => Result, count: number): Result[] =>
  (Array.isArray(list) ? list : []).map(map).filter((r) => /^https?:\/\//.test(r.url)).slice(0, count);
/** Waits, unless the call is stopped. */
export const pause = (ms: number, signal: AbortSignal) =>
  new Promise<void>((done, fail) => {
    const timer = setTimeout(done, ms);
    signal.addEventListener("abort", () => (clearTimeout(timer), fail(signal.reason)), { once: true });
  });
/** Asks `check` every few seconds until it answers, for up to 3 minutes: research a provider runs in the background. */
export async function poll<T>(name: string, check: () => Promise<T | undefined>, signal: AbortSignal): Promise<T> {
  for (const end = Date.now() + 180_000; Date.now() < end; ) {
    const done = await check();
    if (done !== undefined) return done;
    await pause(4000, signal);
  }
  throw new ProviderError(`${name}'s research took over 3 minutes. Hand longer research to a subagent, or ask with depth "normal".`);
}
