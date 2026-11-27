import { call, results, str, type Adapter } from "./common.ts";

// Perplexity's Search API, whose snippets are each page's text already, and its Context API, a known page as Markdown
// (docs.perplexity.ai, read 2026-11-26). Nous Portal's search gateway speaks the same Search API.
const origin = (p: { baseUrl: string | null }) => new URL(p.baseUrl ?? "https://api.perplexity.ai").origin;

export const perplexity: Adapter = {
  kinds: ["perplexity"],
  async search(fx, p, { query, count, depth, recency, domains, exclude, options }, signal) {
    const filter = [...domains, ...exclude.map((d) => `-${d}`)];
    const body = {
      query,
      max_results: Math.min(count, 20),
      ...(depth === "quick" ? { search_type: "fast" } : {}),
      ...(recency ? { search_recency_filter: recency } : {}),
      ...(filter.length ? { search_domain_filter: filter.slice(0, 20) } : {}),
      ...options,
    };
    const answer = await call(fx, p, `${origin(p)}/search`, { body }, signal);
    return { results: results(answer.results, (r) => ({ title: str(r.title), url: str(r.url), snippet: str(r.snippet).slice(0, 400), published: r.date ? str(r.date) : undefined, text: str(r.snippet) }), count) };
  },
  async read(fx, p, { url, options }, signal) {
    const answer = await call(fx, p, `${origin(p)}/v1/context`, { body: { urls: [url], ...options } }, signal);
    const got = answer.results?.[0];
    if (!got || (got.status?.type && got.status.type !== "ok")) throw new Error(`Perplexity couldn't read it: ${str(got?.status?.type) || "no result"}.`);
    return { title: str(got.metadata?.title), url: str(got.url) || url, markdown: str(got.markdown) };
  },
};
