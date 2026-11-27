import { call, results, str, withSites, type Adapter } from "./common.ts";

// SearXNG on the owner's own server (docs.searxng.org): its search as JSON, which its settings.yml must turn on
// (`search: formats: [html, json]`); without it, it answers 403.
export const searxng: Adapter = {
  kinds: ["searxng"],
  async search(fx, p, { query, count, recency, domains, exclude, options }, signal) {
    const q = new URLSearchParams({ q: withSites(query, domains, exclude), format: "json", ...(recency ? { time_range: recency } : {}) });
    for (const [name, value] of Object.entries(options)) q.set(name, str(value));
    const answer = await call(fx, p, `${(p.baseUrl ?? "http://localhost:8888").replace(/\/+$/, "")}/search?${q}`, {}, signal).catch((error: Error) => {
      throw /\b403\b/.test(error.message) ? new Error(`${p.name} refused JSON: turn it on in its settings.yml, under search: formats: [html, json].`) : error;
    });
    return { results: results(answer.results, (r) => ({ title: str(r.title), url: str(r.url), snippet: str(r.content), published: r.publishedDate ? str(r.publishedDate).slice(0, 10) : undefined }), count) };
  },
};
