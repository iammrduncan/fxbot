import { baseOf, call, poll, results, str, type Adapter } from "./common.ts";

// Tavily (docs.tavily.com, its OpenAPI file, read 2026-11-26): search at three depths, with each page's text as
// Markdown when asked, extract, and research that runs in the background and is asked after until it's done.
const depths = { quick: "fast", normal: "basic", deep: "advanced" } as const;
const credits = (body: any) => (typeof body?.usage?.credits === "number" ? `${body.usage.credits} Tavily credit${body.usage.credits === 1 ? "" : "s"}` : undefined);
const base = (p: { baseUrl: string | null }) => baseOf(p as never, "https://api.tavily.com");

export const tavily: Adapter = {
  kinds: ["tavily"],
  async search(fx, p, { query, count, depth, text, recency, domains, exclude, options }, signal) {
    const body = {
      query,
      max_results: count,
      search_depth: depths[depth],
      include_usage: true,
      ...(text ? { include_raw_content: "markdown" } : {}),
      ...(recency ? { time_range: recency } : {}),
      ...(domains.length ? { include_domains: domains } : {}),
      ...(exclude.length ? { exclude_domains: exclude } : {}),
      ...options,
    };
    const answer = await call(fx, p, `${base(p)}/search`, { body }, signal);
    return { results: results(answer.results, (r) => ({ title: str(r.title), url: str(r.url), snippet: str(r.content), published: r.published_date ? str(r.published_date) : undefined, ...(r.raw_content ? { text: str(r.raw_content) } : {}) }), count), cost: credits(answer) };
  },
  async read(fx, p, { url, options }, signal) {
    const answer = await call(fx, p, `${base(p)}/extract`, { body: { urls: [url], format: "markdown", include_usage: true, ...options } }, signal);
    const got = answer.results?.[0];
    if (!got) throw new Error(`Tavily couldn't read it: ${str(answer.failed_results?.[0]?.error) || "no result"}.`);
    return { title: str(got.title), url: str(got.url) || url, markdown: str(got.raw_content), cost: credits(answer) };
  },
  async research(fx, p, { question, depth, options }, signal) {
    const started = await call(fx, p, `${base(p)}/research`, { body: { input: question, model: depth === "deep" ? "pro" : "mini", ...options } }, signal);
    const id = str(started.request_id);
    const done = await poll("Tavily", async () => {
      const now = await call(fx, p, `${base(p)}/research/${encodeURIComponent(id)}`, {}, signal);
      if (now.status === "failed") throw new Error(`Tavily's research failed: ${str(now.error) || "no reason given"}.`);
      return now.status === "completed" ? now : undefined;
    }, signal);
    const content = typeof done.content === "string" ? done.content : JSON.stringify(done.content, null, 2);
    return { answer: content, sources: (done.sources ?? []).map((s: any) => ({ title: str(s.title), url: str(s.url) })).filter((s: any) => s.url), cost: credits(done) };
  },
};
