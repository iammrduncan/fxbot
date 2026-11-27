import { baseOf, call, results, str, withSites, type Adapter } from "./common.ts";

// Firecrawl v2, in its cloud or on the owner's own server, which needs no key (docs.firecrawl.dev, read 2026-11-26):
// one search, with each result's page as Markdown when asked, and a scrape of one page's main content. Nous Portal's
// reading gateway speaks the same.
const tbs = { day: "qdr:d", week: "qdr:w", month: "qdr:m", year: "qdr:y" } as const;
const credits = (body: any) => (typeof body?.creditsUsed === "number" ? `${body.creditsUsed} Firecrawl credit${body.creditsUsed === 1 ? "" : "s"}` : undefined);

export const firecrawl: Adapter = {
  kinds: ["firecrawl", "firecrawl-local"],
  async search(fx, p, { query, count, text, recency, domains, exclude, options }, signal) {
    const body = {
      query: withSites(query, domains, exclude),
      limit: count,
      ...(recency ? { tbs: tbs[recency] } : {}),
      ...(text ? { scrapeOptions: { formats: ["markdown"], onlyMainContent: true } } : {}),
      ...options,
    };
    const answer = await call(fx, p, `${baseOf(p, "https://api.firecrawl.dev/v2")}/search`, { body }, signal);
    const web = Array.isArray(answer?.data) ? answer.data : answer?.data?.web;
    return { results: results(web, (r) => ({ title: str(r.title ?? r.metadata?.title), url: str(r.url), snippet: str(r.description), ...(r.markdown ? { text: str(r.markdown) } : {}) }), count), cost: credits(answer) };
  },
  async read(fx, p, { url, options }, signal) {
    const answer = await call(fx, p, `${baseOf(p, "https://api.firecrawl.dev/v2")}/scrape`, { body: { url, formats: ["markdown"], onlyMainContent: true, ...options } }, signal);
    const data = answer?.data ?? {};
    return { title: str(data.metadata?.title), url: str(data.metadata?.sourceURL ?? data.metadata?.url) || url, markdown: str(data.markdown), cost: credits(answer) };
  },
};
