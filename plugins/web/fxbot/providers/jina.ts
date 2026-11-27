import { call, results, str, withSites, type Adapter } from "./common.ts";

// Jina's Reader, r.jina.ai/<url>, a page as Markdown, and its Search, s.jina.ai, five results with each page's text
// (jina.ai/reader, read 2026-11-26). Both answer JSON when asked, and a read spends tokens.
const origin = (p: { baseUrl: string | null }) => new URL(p.baseUrl ?? "https://r.jina.ai").origin;
// Search is at s.jina.ai, beside the Reader, or at the same address as a reader somewhere else.
const searchAt = (p: { baseUrl: string | null }) => (origin(p) === "https://r.jina.ai" ? "https://s.jina.ai" : origin(p));

export const jina: Adapter = {
  kinds: ["jina"],
  async search(fx, p, { query, count, domains, exclude, options }, signal) {
    const q = new URLSearchParams({ q: withSites(query, domains, exclude) });
    for (const [name, value] of Object.entries(options)) q.set(name, str(value));
    const answer = await call(fx, p, `${searchAt(p)}/?${q}`, { headers: { "x-respond-with": "markdown" } }, signal);
    return { results: results(answer.data, (r) => ({ title: str(r.title), url: str(r.url), snippet: str(r.description), ...(r.content ? { text: str(r.content) } : {}) }), count) };
  },
  async read(fx, p, { url, options }, signal) {
    const headers = Object.fromEntries(Object.entries(options).map(([name, value]) => [name, str(value)]));
    const answer = await call(fx, p, `${origin(p)}/${url}`, { headers }, signal);
    const data = answer.data ?? {};
    return { title: str(data.title), url: str(data.url) || url, markdown: str(data.content) };
  },
};
