import { baseOf, call, results, str, withSites, type Adapter } from "./common.ts";

// Brave Search (api-dashboard.search.brave.com, read 2026-11-26): its own index, and LLM Context, each result's page cut
// into chunks for agents, when a search asks for text. It reads no page and researches nothing.
const freshness = { day: "pd", week: "pw", month: "pm", year: "py" } as const;
const base = (p: { baseUrl: string | null }) => baseOf(p as never, "https://api.search.brave.com/res/v1");

export const brave: Adapter = {
  kinds: ["brave"],
  async search(fx, p, { query, count, text, recency, domains, exclude, options }, signal) {
    const q = new URLSearchParams({ q: withSites(query, domains, exclude), count: String(count), ...(recency ? { freshness: freshness[recency] } : {}) });
    for (const [name, value] of Object.entries(options)) q.set(name, typeof value === "string" ? value : JSON.stringify(value));
    if (text) {
      const answer = await call(fx, p, `${base(p)}/llm/context?${q}`, {}, signal);
      const found = answer?.grounding?.generic ?? [];
      return { results: results(found, (r) => ({ title: str(r.title), url: str(r.url), snippet: str(r.snippets?.[0]).slice(0, 300), text: (r.snippets ?? []).map(str).join("\n\n") }), count) };
    }
    const answer = await call(fx, p, `${base(p)}/web/search?${q}`, {}, signal);
    return { results: results(answer?.web?.results, (r) => ({ title: str(r.title), url: str(r.url), snippet: [r.description, ...(r.extra_snippets ?? [])].map(str).join(" ").replace(/<\/?strong>/g, ""), published: r.page_age ? str(r.page_age).slice(0, 10) : r.age ? str(r.age) : undefined }), count) };
  },
};
