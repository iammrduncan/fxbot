// The frame's line to the shell: requests and WebSockets, each by an id, over a MessagePort the shell hands it. The page
// and its service worker each have one.
export const SHELL = "__FXBOT_SHELL__";

type Head = { status: number; headers: [string, string][]; protocol?: string; error?: string };
type Pending = { head?: (h: Head) => void; chunk?: (b: ArrayBuffer) => void; end?: () => void; error?: (e: string) => void; open?: (p: string) => void; msg?: (d: string | ArrayBuffer) => void; close?: (code: number, reason: string) => void };

// A plugin's file named by its version, which never changes under that name, so it's kept like a build's assets.
export const versioned = (url: URL) => /^\/api\/plugins\/[^/]+\/files\//.test(url.pathname) && url.searchParams.has("v");

// Statuses whose response has no body.
const empty = new Set([101, 103, 204, 205, 304]);

export class Line {
  private ids = 0;
  private live = new Map<number, Pending>();
  private port: MessagePort;
  constructor(port: MessagePort) {
    this.port = port;
    port.onmessage = (e) => {
      const m = e.data;
      const p = this.live.get(m.id);
      if (!p) return;
      if (m.t === "head") p.head?.(m.head);
      else if (m.t === "chunk") p.chunk?.(m.data);
      else if (m.t === "end") (this.live.delete(m.id), p.end?.());
      else if (m.t === "error") (this.live.delete(m.id), p.error?.(m.error));
      else if (m.t === "open") p.open?.(m.protocol);
      else if (m.t === "msg") p.msg?.(m.data);
      else if (m.t === "close") (this.live.delete(m.id), p.close?.(m.code, m.reason));
    };
    port.start();
  }
  // One request to fxbot, as a Response whose body streams as it comes, such as a chat's.
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const id = ++this.ids;
    const body = request.method === "GET" || request.method === "HEAD" ? null : await request.arrayBuffer();
    return new Promise((resolve, reject) => {
      let controller: ReadableStreamDefaultController<Uint8Array>;
      const stream = new ReadableStream<Uint8Array>({ start: (c) => void (controller = c), cancel: () => this.abort(id) });
      let answered = false;
      const fail = (e: string) => (answered ? controller.error(new TypeError(e)) : reject(new TypeError(e)));
      this.live.set(id, {
        head: (h) => {
          answered = true;
          if (h.error && h.status >= 500) console.warn(`fxbot: ${h.error}`);
          const headers = new Headers(h.headers);
          resolve(new Response(empty.has(h.status) || request.method === "HEAD" ? null : stream, { status: h.status === 101 ? 200 : h.status, headers }));
        },
        chunk: (b) => controller.enqueue(new Uint8Array(b)),
        end: () => {
          try {
            controller.close();
          } catch {}
        },
        error: fail,
      });
      request.signal?.addEventListener("abort", () => (this.abort(id), fail("aborted")));
      const head = { kind: "http", method: request.method, path: url.pathname + url.search, headers: [...request.headers] };
      this.port.postMessage({ t: "req", id, head, body }, body ? [body] : []);
    });
  }
  private abort(id: number) {
    if (this.live.delete(id)) this.port.postMessage({ t: "abort", id });
  }
  socket(path: string, protocols: string[], on: Required<Pick<Pending, "open" | "msg" | "close">>) {
    const id = ++this.ids;
    this.live.set(id, on);
    this.port.postMessage({ t: "ws", id, head: { kind: "ws", path, protocols } });
    return {
      send: (data: string | ArrayBuffer) => this.port.postMessage({ t: "send", id, data }),
      close: () => (this.live.delete(id), this.port.postMessage({ t: "close", id })),
    };
  }
}
