// The frame's service worker: everything the frame's pages load by address, it fetches from fxbot through the shell.
// fxbot's page itself, its scripts and styles, images in the library, plugins' files, and the pages plugin's frames.
// Content-hashed assets are kept, so a reopened app draws at once while it connects.
import { Line, SHELL } from "./port.ts";

declare const self: ServiceWorkerGlobalScope;
let line: Line | null = null;
let waiting: ((l: Line) => void)[] = [];

self.addEventListener("install", () => void self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("message", (e) => {
  if (e.data?.fxbot !== "port" || !e.ports[0]) return;
  line = new Line(e.ports[0]);
  for (const w of waiting.splice(0)) w(line);
});

// A port, from the one it has, or from a page of the frame's, which asks the shell. A worker that was stopped has none.
async function getLine(): Promise<Line | null> {
  if (line) return line;
  const got = new Promise<Line>((r) => waiting.push(r));
  for (const c of await self.clients.matchAll({ type: "window", includeUncontrolled: true })) c.postMessage({ fxbot: "want-port" });
  return Promise.race([got, new Promise<null>((r) => setTimeout(() => r(null), 3000))]);
}

// Lets the frame run inside the shell: a page that allows only its own origin to frame it allows the shell too.
function framing(csp: string) {
  return csp.replace(/frame-ancestors([^;]*)'self'/, `frame-ancestors$1'self' ${SHELL}`);
}

// A policy as its directives, and back.
const directives = (csp: string) => new Map(csp.split(";").map((d) => d.trim().split(/\s+/)).filter((d) => d[0]).map(([name, ...values]) => [name.toLowerCase(), values]));
const policy = (d: Map<string, string[]>) => [...d].map(([name, values]) => [name, ...values].join(" ")).join("; ");
const attr = (text: string) => text.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
const unattr = (text: string) => text.replaceAll("&quot;", '"').replaceAll("&#39;", "'").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&");

// A sandboxed frame without allow-same-origin gets no service worker, so its page would come from the Worker, which
// has none of fxbot's. Its page goes into the frame as srcdoc instead, with its own policy as a meta tag, less what a
// meta tag can't say; the iframe's sandbox attribute still applies. A srcdoc page also inherits the policy of the page
// around it, so that page's policy takes in the framed page's sources, which its own fixed text doesn't use.
async function inlineSandboxed(html: string, base: URL, l: Line, outer: string | null) {
  let around = outer ? directives(outer) : null;
  let out = html;
  for (const m of html.matchAll(/<iframe\b([^>]*)>/gi)) {
    const sandbox = /\bsandbox(?:\s*=\s*(["'])(.*?)\1)?/i.exec(m[1]);
    const src = /\bsrc\s*=\s*(["'])(.*?)\1/i.exec(m[1]);
    if (!sandbox || /allow-same-origin/.test(sandbox[2] ?? "") || !src) continue;
    const url = new URL(unattr(src[2]), base);
    if (url.origin !== base.origin) continue;
    const res = await l.fetch(new Request(url));
    const page = await res.text();
    const own = directives(res.headers.get("content-security-policy") ?? "");
    for (const name of ["frame-ancestors", "sandbox", "report-uri", "report-to"]) own.delete(name);
    const meta = own.size ? `<meta http-equiv="Content-Security-Policy" content="${attr(policy(own))}">` : "";
    const doctype = /^\s*<!doctype[^>]*>/i.exec(page)?.[0] ?? "";
    out = out.replace(m[0], `<iframe${m[1].replace(src[0], `srcdoc="${attr(doctype + meta + page.slice(doctype.length))}"`)}>`);
    if (around) for (const [name, values] of own) {
      const mine = around.get(name) ?? around.get("default-src") ?? ["*"];
      const merged = [...new Set([...mine, ...values])].filter((v, _, all) => v !== "'none'" || all.length === 1);
      around.set(name, merged);
    }
  }
  return { html: out, csp: around ? policy(around) : outer };
}

async function handle(request: Request): Promise<Response> {
  const url = new URL(request.url);
  // A page of fxbot's only ever loads by GET. Another site that knew this frame's name could send the browser here
  // with a form, and its POST would reach fxbot through the open connection; so a page load that isn't a GET stops here.
  if (request.mode === "navigate" && request.method !== "GET" && request.method !== "HEAD") return new Response("Not here.", { status: 405 });
  const asset = request.method === "GET" && url.pathname.startsWith("/assets/");
  if (asset) {
    const kept = await caches.match(request);
    if (kept) return kept;
  }
  // A page load that can't reach fxbot starts over from the frame's first page, which gets a way to the shell and loads
  // it again, once the app connects. The browser's own error page would stay up after that.
  const again = () => Response.redirect(`/__fxbot/start?path=${encodeURIComponent(url.pathname + url.search)}`, 302);
  const l = await getLine();
  if (!l) {
    if (request.mode === "navigate") return again();
    return new Response("Not connected to your fxbot.", { status: 503 });
  }
  let res: Response;
  try {
    res = await l.fetch(request);
  } catch (error) {
    if (request.mode === "navigate") return again();
    throw error;
  }
  const csp = res.headers.get("content-security-policy");
  const type = res.headers.get("content-type") ?? "";
  if (csp || type.startsWith("text/html")) {
    const headers = new Headers(res.headers);
    if (csp) headers.set("content-security-policy", framing(csp));
    let body: BodyInit | null = res.body;
    if (type.startsWith("text/html")) {
      let text = await res.text();
      if (/<iframe\b[^>]*\bsandbox/i.test(text)) {
        const inlined = await inlineSandboxed(text, url, l, csp);
        text = inlined.html;
        if (inlined.csp) headers.set("content-security-policy", framing(inlined.csp));
      }
      // fxbot's own pages get the frame's script first, where their policy lets a script from here run.
      if (!csp || /script-src[^;]*'self'/.test(csp) || (!/script-src/.test(csp) && /default-src[^;]*'self'/.test(csp))) {
        const withScript = text.replace(/<head[^>]*>/i, (m) => `${m}<script src="/__fxbot/frame.js"></script>`);
        text = withScript === text ? `<script src="/__fxbot/frame.js"></script>${text}` : withScript;
      }
      body = text;
      headers.delete("content-length");
    }
    if (type.startsWith("text/html")) {
      // Only the app, and the frame itself, may frame fxbot's pages, and a link out doesn't tell the site this frame's name.
      const policy = headers.get("content-security-policy");
      if (!policy || !/frame-ancestors/.test(policy)) headers.set("content-security-policy", [policy, `frame-ancestors 'self' ${SHELL}`].filter(Boolean).join("; "));
      headers.set("referrer-policy", "same-origin");
    }
    res = new Response(body, { status: res.status, statusText: res.statusText, headers });
  }
  if (asset && res.ok) {
    const cache = await caches.open("fxbot-assets");
    await cache.put(request, res.clone());
  }
  return res;
}

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin || url.pathname.startsWith("/__fxbot/") || url.pathname === "/sw.js") return;
  e.respondWith(handle(e.request));
});
