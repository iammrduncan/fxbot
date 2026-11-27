import { randomUUID } from "node:crypto";
import { baseOf, call, poll, ProviderError, results, str, type Adapter, type Result, type SearchInput } from "./common.ts";

// Parallel (docs.parallel.ai, read 2026-11-26): search at three speeds with excerpts of each page, extract with a page's
// full content, and Task runs for research, asked after until they're done. On /v1, max_results and source_policy go
// inside advanced_settings, and search_queries is required.
const modes = { quick: "turbo", normal: "fast", deep: "advanced" } as const;
const base = (p: { baseUrl: string | null }) => baseOf(p as never, "https://api.parallel.ai");
const result = (r: any): Result => ({ title: str(r.title), url: str(r.url), snippet: str(r.excerpts?.[0]).slice(0, 400), published: r.publish_date ? str(r.publish_date) : undefined, text: (r.excerpts ?? []).map(str).join("\n\n") });

export const parallel: Adapter = {
  kinds: ["parallel"],
  async search(fx, p, { query, count, depth, domains, exclude, options }, signal) {
    const policy = { ...(domains.length ? { include_domains: domains } : {}), ...(exclude.length ? { exclude_domains: exclude } : {}) };
    const body = { objective: query, search_queries: [query], mode: modes[depth], advanced_settings: { max_results: count, ...(domains.length || exclude.length ? { source_policy: policy } : {}) }, ...options };
    const answer = await call(fx, p, `${base(p)}/v1/search`, { body }, signal);
    return { results: results(answer.results, result, count) };
  },
  async read(fx, p, { url, options }, signal) {
    const answer = await call(fx, p, `${base(p)}/v1/extract`, { body: { urls: [url], advanced_settings: { full_content: true }, ...options } }, signal);
    const got = answer.results?.[0];
    if (!got) throw new Error(`Parallel couldn't read it: ${str(answer.errors?.[0]?.content ?? answer.errors?.[0]?.error_type) || "no result"}.`);
    return { title: str(got.title), url: str(got.url) || url, markdown: str(got.full_content) || (got.excerpts ?? []).map(str).join("\n\n") };
  },
  async research(fx, p, { question, depth, options }, signal) {
    const processor = depth === "deep" ? "core" : depth === "quick" ? "lite" : "base";
    const run = await call(fx, p, `${base(p)}/v1/tasks/runs`, { body: { input: question, processor, task_spec: { output_schema: { type: "text" } }, ...options } }, signal);
    const id = encodeURIComponent(str(run.run_id));
    await poll("Parallel", async () => {
      const now = await call(fx, p, `${base(p)}/v1/tasks/runs/${id}`, {}, signal);
      if (now.status === "failed" || now.status === "cancelled") throw new Error(`Parallel's research ${now.status}: ${str(now.error?.message) || "no reason given"}.`);
      return now.status === "completed" ? true : undefined;
    }, signal);
    const done = await call(fx, p, `${base(p)}/v1/tasks/runs/${id}/result`, {}, signal);
    const content = done.output?.content;
    const sources = (done.output?.basis ?? []).flatMap((b: any) => b.citations ?? []).map((c: any) => ({ title: str(c.title), url: str(c.url) })).filter((s: any) => s.url);
    return { answer: typeof content === "string" ? content : JSON.stringify(content, null, 2), sources: [...new Map(sources.map((s: any) => [s.url, s])).values()] as { title: string; url: string }[] };
  },
};

// Parallel's free search, with no key, through its MCP server (search.parallel.ai/mcp), from the plugin's own code: the
// MCP handshake, then web_search, as openmuse calls it. It gets the query and a session id of the plugin's own.
const free = "https://search.parallel.ai/mcp";
const session = randomUUID();
export async function freeSearch({ query, count }: SearchInput, signal: AbortSignal): Promise<{ results: Result[] }> {
  const stop = AbortSignal.any([signal, AbortSignal.timeout(45_000)]);
  let sid = "";
  const rpc = async (body: Record<string, unknown>) => {
    const res = await fetch(free, {
      method: "POST",
      redirect: "error",
      signal: stop,
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream", "user-agent": "fxbot-web", "mcp-protocol-version": "2025-06-18", ...(sid ? { "mcp-session-id": sid } : {}) },
      body: JSON.stringify({ jsonrpc: "2.0", ...body }),
    }).catch((error: Error) => {
      throw stop.aborted && !signal.aborted ? new ProviderError("Parallel's free search didn't answer in 45 seconds.") : new ProviderError(`Parallel's free search didn't answer: ${error.message}`);
    });
    sid = res.headers.get("mcp-session-id") ?? sid;
    const text = (await res.text()).slice(0, 1 << 20);
    if (!res.ok) throw new ProviderError(`Parallel's free search answered ${res.status}${res.status === 429 ? ": it's limiting searches, so try again later, or add a search provider" : ""}.`);
    if (!("id" in body)) return null;
    // A JSON answer, or a stream of events, whose last data line holds it.
    const json = res.headers.get("content-type")?.includes("text/event-stream") ? text.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).at(-1) : text;
    const answer = JSON.parse(json ?? "{}");
    if (answer.error) throw new ProviderError(`Parallel's free search refused it: ${str(answer.error.message)}`);
    return answer.result;
  };
  await rpc({ id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "fxbot-web", version: "0.1.0" } } });
  await rpc({ method: "notifications/initialized" });
  const called = await rpc({ id: 2, method: "tools/call", params: { name: "web_search", arguments: { objective: query, search_queries: [query.slice(0, 200)], session_id: session } } });
  const said = called?.content?.find((c: any) => c.type === "text")?.text;
  if (called?.isError) throw new ProviderError(`Parallel's free search failed: ${str(said).slice(0, 300)}`);
  const payload = called?.structuredContent ?? JSON.parse(said ?? "{}");
  return { results: results(payload.results, result, count) };
}
