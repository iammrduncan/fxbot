import { baseOf, call, results, since, str, type Adapter } from "./common.ts";

// Exa (docs.exa.ai, read 2026-11-26): search by meaning at three speeds, with each page's text when asked, contents for
// a known page, and an answer with its citations. Its Research API is retired.
const types = { quick: "fast", normal: "auto", deep: "deep" } as const;
const cost = (body: any) => (typeof body?.costDollars?.total === "number" ? `$${body.costDollars.total.toFixed(4)} of Exa credit` : undefined);
const base = (p: { baseUrl: string | null }) => baseOf(p as never, "https://api.exa.ai");

export const exa: Adapter = {
  kinds: ["exa"],
  async search(fx, p, { query, count, depth, text, recency, domains, exclude, options }, signal) {
    const body = {
      query,
      type: types[depth],
      numResults: count,
      ...(text ? { contents: { text: { maxCharacters: 10_000 } } } : {}),
      ...(recency ? { startPublishedDate: `${since(recency)}T00:00:00.000Z` } : {}),
      ...(domains.length ? { includeDomains: domains } : {}),
      ...(exclude.length ? { excludeDomains: exclude } : {}),
      ...options,
    };
    const answer = await call(fx, p, `${base(p)}/search`, { body }, signal);
    return {
      results: results(answer.results, (r) => ({ title: str(r.title), url: str(r.url), snippet: str(r.highlights?.[0] ?? r.summary ?? (r.text ? "" : "")), published: r.publishedDate ? str(r.publishedDate).slice(0, 10) : undefined, ...(r.text ? { text: str(r.text) } : {}) }), count),
      cost: cost(answer),
    };
  },
  async read(fx, p, { url, options }, signal) {
    const answer = await call(fx, p, `${base(p)}/contents`, { body: { urls: [url], text: true, ...options } }, signal);
    const got = answer.results?.[0];
    if (!got) throw new Error(`Exa couldn't read it: ${str(answer.statuses?.[0]?.error?.tag ?? answer.statuses?.[0]?.status) || "no result"}.`);
    return { title: str(got.title), url: str(got.url) || url, markdown: str(got.text), cost: cost(answer) };
  },
  async research(fx, p, { question, options }, signal) {
    const answer = await call(fx, p, `${base(p)}/answer`, { body: { query: question, ...options } }, signal);
    return { answer: typeof answer.answer === "string" ? answer.answer : JSON.stringify(answer.answer, null, 2), sources: (answer.citations ?? []).map((c: any) => ({ title: str(c.title), url: str(c.url) })).filter((s: any) => s.url), cost: cost(answer) };
  },
};
