import { baseOf, call, ProviderError, results, shape, str, type Adapter, type Result } from "./common.ts";

// Keiro Labs, sold as BrowserFoundry too: the owner's web before this plugin, through its MCP server. One key covers
// search (lite, fast, slow, deep), search with each page's text, extract, answer, and its web agent
// (docs.keirolabs.cloud, read 2026-11-26). Every answer carries creditsCharged or credits_used.
const base = (p: { baseUrl: string | null }) => baseOf(p as never, "https://api.keirolabs.cloud/api/v2");
const origin = (p: { baseUrl: string | null }) => new URL(base(p)).origin;
const credits = (body: any) => {
  const n = body?.creditsCharged ?? body?.credits_used ?? body?.stats?.credits_used ?? body?.data?.credits_used ?? body?.data?.stats?.credits_used;
  return typeof n === "number" ? `${n} Keiro credit${n === 1 ? "" : "s"}` : undefined;
};
const result = (r: any): Result => ({ title: str(r.title), url: str(r.url), snippet: str(r.snippet ?? r.excerpt), ...(r.content ? { text: str(r.content) } : {}) });

export const keiro: Adapter = {
  kinds: ["keiro"],
  async search(fx, p, { query, count, depth, text, domains, exclude, options }, signal) {
    const q = [query, ...domains.map((d) => `site:${d}`), ...exclude.map((d) => `-site:${d}`)].join(" ");
    const { route, ...rest } = options as { route?: string };
    // Its own route when asked, as `route: "slow"`, else by depth, or the one that reads each page.
    const [path, body] = route
      ? [`/search/${route}`, { query: q, maxResults: count, ...rest }]
      : text
        ? ["/search/content", { query: q, maxResults: Math.min(count, 5), ...rest }]
        : depth === "quick"
          ? ["/search/lite", { query: q, count: Math.min(count, 20), ...rest }]
          : depth === "deep"
            ? ["/deep", { query: q, content: false, ...rest }]
            : ["/search/fast", { query: q, maxResults: count, ...rest }];
    const answer = await call(fx, p, `${base(p)}${path}`, { body }, signal);
    return { results: results(answer.results, result, count), cost: credits(answer) };
  },
  async read(fx, p, { url, options }, signal) {
    const answer = await call(fx, p, `${base(p)}/extract`, { body: { url, ...options } }, signal);
    // Its replies, seen on 2026-11-27, aren't its docs': `results` is at the top, not in `data`, and each has the page
    // as `markdown_content` or `content`, with the site's `status` and an `error`. A reply with no text says what it held.
    const got = (Array.isArray(answer?.results) ? answer.results[0] : Array.isArray(answer?.data?.results) ? answer.data.results[0] : null) ?? {};
    const asked = Boolean((options as { json_schema?: unknown }).json_schema);
    const schema = got.json_schema?.data ?? got.json_schema ?? (asked && got.structuredData && Object.keys(got.structuredData).length ? got.structuredData : undefined);
    const text = [got.markdown_content, got.content, got.text, got.markdown].find((v) => typeof v === "string" && v.trim()) as string | undefined;
    if (!text && !schema) {
      const why = str(got.error?.message ?? (typeof got.error === "string" ? got.error : "")) || str(got.note?.message ?? "");
      throw new ProviderError(`Keiro answered with none of the page's text${typeof got.status === "number" && got.status !== 200 ? `, after the site answered ${got.status}` : ""}${why ? `: ${why}` : ""}. Its reply: ${shape(answer)}.`);
    }
    const markdown = [str(text), schema ? `\`\`\`json\n${JSON.stringify(schema, null, 2)}\n\`\`\`` : ""].filter(Boolean).join("\n\n");
    return { title: str(got.title), url: str(got.url) || url, markdown, cost: credits(answer) };
  },
  async research(fx, p, { question, depth, options }, signal) {
    if (depth === "deep") {
      // Its web agent, waited for whole. Its JSON's fields aren't in Keiro's docs, so each likely one is read.
      const answer = await call(fx, p, `${origin(p)}/api/webagents/research`, { body: { query: question, research_depth: "medium", outputs: ["summary", "sources"], ...options } }, signal);
      const out = answer?.data ?? answer?.result ?? answer;
      const text = [out?.summary, out?.detailed_answer, out?.answer].map((v) => (typeof v === "string" ? v : "")).find(Boolean) ?? JSON.stringify(out).slice(0, 4000);
      const sources = (Array.isArray(out?.sources) ? out.sources : []).map((s: any) => ({ title: str(s.title ?? s.name), url: str(s.url ?? s.link) })).filter((s: any) => s.url);
      return { answer: text, sources, cost: credits(answer) ?? credits(answer?.metadata) };
    }
    const answer = await call(fx, p, `${base(p)}/answer`, { body: { query: question, stream: false, ...options } }, signal);
    // Its reply, seen on 2026-11-27: the answer, its sources as addresses, and its stats are in `data`, not at the top
    // as its docs show. A reply with no answer says what it held.
    const body = answer?.data && typeof answer.data === "object" && !Array.isArray(answer.data) ? answer.data : answer;
    const text = [body?.answer, body?.text].find((v) => typeof v === "string" && v.trim()) as string | undefined;
    if (!text) throw new ProviderError(`Keiro answered with no answer. Its reply: ${shape(answer)}.`);
    const sources = (Array.isArray(body?.sources) ? body.sources : [])
      .map((s: any) => (typeof s === "string" ? { title: "", url: s } : { title: str(s.title), url: str(s.url) || (s.domain ? `https://${s.domain}` : "") }))
      .filter((s: { url: string }) => /^https?:\/\//.test(s.url));
    return { answer: text, sources, cost: credits(answer) };
  },
};
