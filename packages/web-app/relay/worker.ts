// web.fxbot.sh, as one Cloudflare Worker: the shell's and the frames' static files, and the relay that passes sealed
// handshake messages between a device and its fxbot. The relay stores nothing: no storage API, no alarms, and its logs
// are off. It sees an fxbot's address, the IPs of its sockets, timing, and sizes; never what the messages say.
//
//   wss://<shell>/signal/listen/<rid>?l=&i=&t=&s=   an fxbot, proving its keys
//   wss://<shell>/signal/call/<rid>                 a device calling it
//   wss://<shell>/signal/plate                      an fxbot claiming a nameplate for a typed code
//   wss://<shell>/signal/call/plate/<n>             a device typing that code
//
// Each fxbot has a Durable Object of its own, holding its socket under the WebSocket Hibernation API, so it sleeps
// between messages with the socket open. A socket's role is in its tags, which hibernation keeps.

type Env = { RELAY: DurableObjectNamespace; PLATES: DurableObjectNamespace; ASSETS: Fetcher; SHELL_HOST?: string };

const MAX_MESSAGE = 16 * 1024;
const MAX_CALL_MESSAGES = 64;
const CALLS_PER_MINUTE = 30;
const PLATE_LIFE_MS = 10 * 60 * 1000;
const base32 = /^[a-z2-7]{26}$/;

const b64u = (s: string) => Uint8Array.from(atob(s.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0));
const utf8 = (s: string) => new TextEncoder().encode(s);
function concat(...parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) (out.set(p, at), (at += p.length));
  return out;
}
function base32Of(bytes: Uint8Array) {
  const a = "abcdefghijklmnopqrstuvwxyz234567";
  let out = "", bits = 0, value = 0;
  for (const x of bytes) for (value = (value << 8) | x, bits += 8; bits >= 5; bits -= 5) out += a[(value >>> (bits - 5)) & 31];
  return bits > 0 ? out + a[(value << (5 - bits)) & 31] : out;
}

// A listener proves it holds the keys its address comes from: Ed25519 over the address and the time, within two
// minutes, with the address a hash of both public keys. Done before the socket is accepted, so its role is fixed then.
async function provesKeys(rid: string, q: URLSearchParams) {
  const [l, i, t, s] = ["l", "i", "t", "s"].map((k) => q.get(k) ?? "");
  if (!l || !i || !s || !/^\d+$/.test(t) || Math.abs(Date.now() - Number(t)) > 120_000) return false;
  const [L, I] = [b64u(l), b64u(i)];
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", concat(utf8("fxbot/1 rid"), L, I)));
  if (base32Of(hash.slice(0, 16)) !== rid) return false;
  const key = await crypto.subtle.importKey("raw", L, { name: "Ed25519" }, false, ["verify"]);
  return crypto.subtle.verify({ name: "Ed25519" }, key, b64u(s), concat(utf8("fxbot/1 listen"), utf8(rid), utf8(t)));
}

const security = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "permissions-policy": "camera=(self), microphone=(self), geolocation=()",
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const shellHost = env.SHELL_HOST ?? "web.fxbot.sh";
    const [, first, kind, a, b] = url.pathname.split("/");
    if (first === "signal" && url.host === shellHost) {
      if (request.headers.get("upgrade") !== "websocket") return new Response("The relay takes WebSockets only.", { status: 426 });
      if (kind === "listen" && base32.test(a ?? "")) {
        if (!(await provesKeys(a, url.searchParams))) return new Response("That listener doesn't hold this address's keys.", { status: 403 });
        return env.RELAY.get(env.RELAY.idFromName(a)).fetch(request);
      }
      if (kind === "call" && base32.test(a ?? "")) return env.RELAY.get(env.RELAY.idFromName(a)).fetch(request);
      if (kind === "plate" || (kind === "call" && a === "plate" && /^\d{1,3}$/.test(b ?? ""))) return env.PLATES.get(env.PLATES.idFromName("plates")).fetch(request);
      return new Response("Not a relay route.", { status: 404 });
    }
    // The shell's files, on its host; a frame's few, on any other. A frame's origin is `<frame>.<base>`.
    const base = shellHost.replace(/^web\./, "");
    if (url.host === shellHost) {
      const res = await env.ASSETS.fetch(new Request(new URL(`/shell${url.pathname === "/" || url.pathname === "/pair" ? "/index.html" : url.pathname}`, url), request));
      // The relay is any wss: address, since an owner may run their own; ws: only when the shell itself is plain http,
      // on a machine of the owner's own.
      const ws = url.protocol === "http:" ? " ws:" : "";
      return withHeaders(res, {
        ...security,
        // The microphone for phone's calls in the app, in a frame of fxbot's page, which asks for it with allow=.
        "permissions-policy": `camera=(self), microphone=(self "${url.protocol}//*.${base}"), geolocation=()`,
        "content-security-policy": `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; media-src 'self'; connect-src 'self' wss:${ws}; frame-src ${url.protocol}//*.${base}; manifest-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'; frame-ancestors 'none'`,
        ...(url.pathname === "/sw.js" ? { "cache-control": "no-cache" } : {}),
      });
    }
    if (!url.host.endsWith(`.${base}`) || !/^[a-z2-7]{16}$/.test(url.host.slice(0, -base.length - 1))) return new Response("Not here.", { status: 404 });
    const frameFile = { "/__fxbot/start": "/frame/start.html", "/__fxbot/start.js": "/frame/start.js", "/__fxbot/frame.js": "/frame/frame.js", "/sw.js": "/frame/sw.js" }[url.pathname];
    const shellOrigin = `${url.protocol}//${shellHost}`;
    if (!frameFile) {
      // The frame's service worker serves everything else. A request that reaches here came before it took over.
      return withHeaders(new Response("<!doctype html><meta charset=utf-8><title>fxbot</title><p>Open this fxbot from its app.", { status: 404, headers: { "content-type": "text/html; charset=utf-8" } }), security);
    }
    let res = await env.ASSETS.fetch(new Request(new URL(frameFile, url), request));
    // The frame's scripts talk only to the shell, whose origin they're given here.
    if (res.ok && frameFile.endsWith(".js")) res = new Response((await res.text()).replaceAll("__FXBOT_SHELL__", shellOrigin), res);
    return withHeaders(res, {
      ...security,
      "content-security-policy": frameFile === "/frame/start.html" ? `default-src 'none'; script-src 'self'; frame-ancestors ${shellOrigin}` : "default-src 'self'",
      ...(frameFile === "/frame/sw.js" ? { "cache-control": "no-cache" } : {}),
    });
  },
};

function withHeaders(res: Response, headers: Record<string, string>) {
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(headers)) out.headers.set(k, v);
  return out;
}

// One fxbot's relay: its listener, and the devices calling it. Each call has an id the listener answers by.
export class Relay {
  private calls = new Map<string, number>();
  private recent: number[] = [];
  private state: DurableObjectState;
  constructor(state: DurableObjectState) {
    this.state = state;
    state.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }
  async fetch(request: Request) {
    const kind = new URL(request.url).pathname.split("/")[2];
    const [client, server] = Object.values(new WebSocketPair());
    if (kind === "listen") {
      // One listener for each fxbot; a newer one replaces it. Its tag says when it came, for listener().
      for (const old of this.state.getWebSockets("listener")) old.close(4000, "Replaced by a newer listener.");
      this.state.acceptWebSocket(server, ["listener", `since:${Date.now()}`]);
    } else {
      const now = Date.now();
      this.recent = this.recent.filter((at) => now - at < 60_000);
      if (this.recent.length >= CALLS_PER_MINUTE) return new Response("Too many calls to this fxbot. Try again in a minute.", { status: 429 });
      this.recent.push(now);
      const id = crypto.randomUUID();
      this.state.acceptWebSocket(server, ["call", `call:${id}`]);
      if (!this.listener()) server.send(JSON.stringify({ k: "err", e: "offline" }));
    }
    return new Response(null, { status: 101, webSocket: client });
  }
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (typeof message !== "string" || message.length > MAX_MESSAGE) return ws.close(1009, "Messages are text, 16 KB at most.");
    const tags = this.state.getTags(ws);
    if (tags.includes("listener")) {
      let m: { call?: string; d?: unknown; close?: boolean };
      try {
        m = JSON.parse(message);
      } catch {
        return;
      }
      const call = this.state.getWebSockets(`call:${m.call}`)[0];
      if (!call) return;
      if (m.close) return call.close(1000, "fxbot ended the call.");
      call.send(JSON.stringify(m.d));
      return;
    }
    const id = tags.find((t) => t.startsWith("call:"))!.slice(5);
    const count = (this.calls.get(id) ?? 0) + 1;
    this.calls.set(id, count);
    if (count > MAX_CALL_MESSAGES) return ws.close(1008, "Too many messages for one call.");
    const listener = this.listener();
    if (!listener) return ws.send(JSON.stringify({ k: "err", e: "offline" }));
    let d: unknown;
    try {
      d = JSON.parse(message);
    } catch {
      return;
    }
    listener.send(JSON.stringify({ call: id, d }));
  }
  async webSocketClose(ws: WebSocket) {
    const tags = this.state.getTags(ws);
    const id = tags.find((t) => t.startsWith("call:"))?.slice(5);
    if (id) {
      this.calls.delete(id);
      this.listener()?.send(JSON.stringify({ call: id, closed: true }));
    }
  }
  async webSocketError(ws: WebSocket) {
    await this.webSocketClose(ws);
  }
  // The newest listener. One a newer one replaced stays in the list until its connection ends, which takes many
  // minutes when its path died without a word, and the first in the list got every call: they went nowhere, and the
  // fxbot looked offline to every device until then.
  private listener() {
    let newest: WebSocket | undefined;
    let at = -1;
    for (const ws of this.state.getWebSockets("listener")) {
      const since = Number(this.state.getTags(ws).find((t) => t.startsWith("since:"))?.slice(6) ?? 0);
      if (since > at) (newest = ws), (at = since);
    }
    return newest;
  }
}

// Nameplates for typed codes: an fxbot holds a number from 1 to 999 for 10 minutes, as a tag on its socket, and a
// device that types the code reaches it by that number.
export class Plates {
  private state: DurableObjectState;
  constructor(state: DurableObjectState) {
    this.state = state;
    state.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }
  async fetch(request: Request) {
    const parts = new URL(request.url).pathname.split("/");
    const [client, server] = Object.values(new WebSocketPair());
    const now = Date.now();
    // Plates past their 10 minutes close.
    for (const ws of this.state.getWebSockets("plate")) {
      const since = Number(this.state.getTags(ws).find((t) => t.startsWith("since:"))?.slice(6));
      if (now - since > PLATE_LIFE_MS) ws.close(4001, "This code expired.");
    }
    if (parts[2] === "plate") {
      const taken = new Set(this.state.getWebSockets("plate").flatMap((ws) => this.state.getTags(ws).filter((t) => t.startsWith("plate:")).map((t) => Number(t.slice(6)))));
      const free = Array.from({ length: 999 }, (_, i) => i + 1).filter((n) => !taken.has(n));
      if (!free.length) return new Response("Every code is in use. Try again in a few minutes.", { status: 503 });
      const n = free[crypto.getRandomValues(new Uint32Array(1))[0] % free.length];
      this.state.acceptWebSocket(server, ["plate", `plate:${n}`, `since:${now}`]);
      server.send(JSON.stringify({ plate: n }));
    } else {
      const n = parts[4];
      const plate = this.state.getWebSockets(`plate:${n}`)[0];
      if (!plate) return new Response("No fxbot is waiting for that code. Check it, or ask for a new one.", { status: 404 });
      // One device for each code: a second gets nothing.
      if (this.state.getWebSockets(`to:${n}`).length) return new Response("That code is being used.", { status: 409 });
      this.state.acceptWebSocket(server, ["call", `call:${crypto.randomUUID()}`, `to:${n}`]);
    }
    return new Response(null, { status: 101, webSocket: client });
  }
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (typeof message !== "string" || message.length > MAX_MESSAGE) return ws.close(1009, "Messages are text, 16 KB at most.");
    const tags = this.state.getTags(ws);
    let m: any;
    try {
      m = JSON.parse(message);
    } catch {
      return;
    }
    if (tags.includes("plate")) {
      const n = tags.find((t) => t.startsWith("plate:"))!.slice(6);
      const call = this.state.getWebSockets(`to:${n}`).find((c) => this.state.getTags(c).includes(`call:${m.call}`));
      if (!call) return;
      if (m.close) return call.close(1000, "fxbot ended the call.");
      return call.send(JSON.stringify(m.d));
    }
    const n = tags.find((t) => t.startsWith("to:"))!.slice(3);
    const id = tags.find((t) => t.startsWith("call:"))!.slice(5);
    this.state.getWebSockets(`plate:${n}`)[0]?.send(JSON.stringify({ call: id, d: m }));
  }
  async webSocketClose(ws: WebSocket) {
    const tags = this.state.getTags(ws);
    const n = tags.find((t) => t.startsWith("to:"))?.slice(3);
    const id = tags.find((t) => t.startsWith("call:"))?.slice(5);
    if (n && id) this.state.getWebSockets(`plate:${n}`)[0]?.send(JSON.stringify({ call: id, closed: true }));
  }
}
