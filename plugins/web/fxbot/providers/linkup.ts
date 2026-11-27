import { baseOf, call, results, since, str, type Adapter } from "./common.ts";

// Linkup (docs.linkup.so, read 2026-11-26): search at three depths, each result with its content, a sourced answer
// from the same search, and fetch, a page as Markdown.
const depths = { quick: "fast", normal: "standard", deep: "deep" } as const;
const base = (p: { baseUrl: string | null }) => baseOf(p as never, "https://api.linkup.so/v1");
const filters = (recency: string | undefined, domains: string[], exclude: string[]) => ({
  ...(recency ? { fromDate: since(recency as never) } : {}),
  ...(domains.length ? { includeDomains: domains } : {}),
  ...(exclude.length ? { excludeDomains: exclude } : {}),
});

export const linkup: Adapter = {
  kinds: ["linkup"],
  async search(fx, p, { query, count, depth, recency, domains, exclude, options }, signal) {
    const body = { q: query, depth: depths[depth], outputType: "searchResults", maxResults: count, ...filters(recency, domains, exclude), ...options };
    const answer = await call(fx, p, `${base(p)}/search`, { body }, signal);
    return { results: results(answer.results, (r) => ({ title: str(r.name ?? r.title), url: str(r.url), snippet: str(r.content).slice(0, 400), text: str(r.content) }), count) };
  },
  async read(fx, p, { url, options }, signal) {
    const answer = await call(fx, p, `${base(p)}/fetch`, { body: { url, ...options } }, signal);
    return { title: str(answer.title), url, markdown: str(answer.markdown ?? answer.content) };
  },
  async research(fx, p, { question, depth, options }, signal) {
    const answer = await call(fx, p, `${base(p)}/search`, { body: { q: question, depth: depths[depth], outputType: "sourcedAnswer", ...options } }, signal);
    return { answer: str(answer.answer), sources: (answer.sources ?? []).map((s: any) => ({ title: str(s.name ?? s.title), url: str(s.url) })).filter((s: any) => s.url) };
  },
};
