// The shell's own service worker. It keeps the shell's few files and answers from them, so the app opens at once, with
// or without a network: a phone launching it waited on the network for every file before. The files are this build's,
// named by the version below, and a new build is a new worker, which the browser checks for at each launch and which
// fetches the new files together. It never touches the relay, and the frames have workers of their own.
declare const self: ServiceWorkerGlobalScope;
export {};
const version = "__FXBOT_BUILD__";
const files = ["/", "/shell.js", "/shell.css", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (e) => e.waitUntil(caches.open(version).then((c) => c.addAll(files)).then(() => self.skipWaiting())));
self.addEventListener("activate", (e) =>
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== version).map((k) => caches.delete(k)))).then(() => self.clients.claim())),
);
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/signal")) return;
  const key = e.request.mode === "navigate" ? "/" : url.pathname;
  e.respondWith(
    (async () => {
      const kept = files.includes(key) ? await caches.match(key, { cacheName: version }) : undefined;
      if (kept) return kept;
      try {
        const res = await fetch(e.request);
        if (res.ok && files.includes(key)) {
          const copy = res.clone();
          void caches.open(version).then((c) => c.put(key, copy));
        }
        return res;
      } catch {
        return (await caches.match(key)) ?? Response.error();
      }
    })(),
  );
});
