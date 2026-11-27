import { baseOf, call, results, str, type Adapter, type Result } from "./common.ts";

// Keiro Labs, sold as BrowserFoundry too: the owner's web before this plugin, through its MCP server. One key covers
// search (lite, fast, slow, deep), search with each page's text, extract, answer, and its web agent
// (docs.keirolabs.cloud, read 2026-11-26). Every answer carries creditsCharged or credits_used.
const base = (p: { baseUrl: string | null }) => baseOf(p as never, "https://api.keirolabs.cloud/api/v2");
const origin = (p: { baseUrl: string | null }) => new URL(base(p)).origin;
const credits = (body: any) => {
  const n = body?.creditsCharged ?? body?.credits_used ?? body?.stats?.credits_used;
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
    const got = answer?.data?.results?.[0] ?? {};
    const schema = got.json_schema?.data;
    const markdown = [str(got.text), schema ? `\`\`\`json\n${JSON.stringify(schema, null, 2)}\n\`\`\`` : ""].filter(Boolean).join("\n\n");
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
    const sources = (Array.isArray(answer.sources) ? answer.sources : []).map((s: any) => ({ title: str(s.title), url: str(s.url) || (s.domain ? `https://${s.domain}` : "") })).filter((s: any) => s.url);
    return { answer: str(answer.answer), sources, cost: credits(answer) };
  },
};
