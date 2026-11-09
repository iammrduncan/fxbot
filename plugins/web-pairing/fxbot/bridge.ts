// The bridge: each data channel a device opens carries requests, or WebSockets, to fxbot's own API at fx.localUrl, one
// after another. A request goes without the device's Host, Origin, or Cookie, and with a header that marks it as
// bridged, which the plugin's own device routes refuse, so code in the device's frame can't pair or remove a device.
//
// A device that says `reuse` in its head keeps the channel when an exchange ends: closing one makes both ends reset its
// stream, and under packet loss werift's reset could land on the next channel to take that stream's number. So a
// request it gives up on says `{"abort":true}`, and a WebSocket closes with `{"close":true}`, answered `{"closed":…}`.
// A device that doesn't say it closes the channel, as before.
import type { RTCDataChannel } from "werift";
import type { Bytes } from "../../../packages/web-app/protocol/bytes.ts";
import { CHUNK, end, joiner, pieces, type AnswerHead, type HttpHead, type WsHead } from "../../../packages/web-app/protocol/wire.ts";

export const bridged = "x-fxbot-web-pairing";
const dropped = new Set(["host", "origin", "cookie", "referer", "connection", "keep-alive", "upgrade", "te", "trailer", "transfer-encoding", "content-length", "proxy-authorization", bridged]);
const droppedBack = new Set(["content-encoding", "content-length", "transfer-encoding", "connection", "keep-alive", "set-cookie"]);
const MiB = 1 << 20;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Sends when the channel has room: under 1 MiB queued.
async function send(dc: RTCDataChannel, data: string | Uint8Array) {
  while (dc.bufferedAmount > MiB) {
    if (dc.readyState !== "open") throw new Error("closed");
    await sleep(5);
  }
  if (dc.readyState !== "open") throw new Error("closed");
  dc.send(typeof data === "string" ? data : Buffer.from(data.buffer, data.byteOffset, data.byteLength));
}

// A path on fxbot's own server, never another host.
function target(localUrl: string, path: unknown) {
  if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//") || path.includes("\\") || path.length > 8192) return null;
  const url = new URL(path, localUrl);
  return url.origin === new URL(localUrl).origin ? url : null;
}

type Exchange =
  | { kind: "http"; head: HttpHead & { reuse?: boolean }; body: Buffer[]; size: number; abort: AbortController; started: boolean }
  | { kind: "ws"; head: WsHead & { reuse?: boolean }; ws: WebSocket | null; queued: (string | Bytes)[]; join: ReturnType<typeof joiner>; out: Promise<void>; over: boolean };

export function serve(dc: RTCDataChannel, ctx: { localUrl: string; device: string; log: (...parts: unknown[]) => void }) {
  let now: Exchange | null = null;

  dc.stateChanged.subscribe((state) => {
    if (state !== "closed" || !now) return;
    if (now.kind === "http") now.abort.abort();
    else now.ws?.close();
  });
  dc.onMessage.subscribe((m: string | Buffer) => {
    if (!now) {
      if (typeof m !== "string") return;
      let head: (HttpHead | WsHead) & { reuse?: boolean };
      try {
        head = JSON.parse(m);
      } catch {
        return void dc.close();
      }
      if (head?.kind === "http") now = { kind: "http", head, body: [], size: 0, abort: new AbortController(), started: false };
      else if (head?.kind === "ws") openSocket((now = { kind: "ws", head, ws: null, queued: [], join: joiner(), out: Promise.resolve(), over: false }));
      else dc.close();
      return;
    }
    const x = now;
    if (x.kind === "http") {
      if (typeof m === "string") {
        if (m === end) {
          if (!x.started) ((x.started = true), void request(x));
        } else if (/"abort"/.test(m)) x.abort.abort();
        return;
      }
      x.size += m.length;
      // What one request may carry, well past the library's own limit.
      if (x.size > 256 * MiB) return void (x.abort.abort(), finish(x, 413, "That's too big to send."));
      x.body.push(m);
      return;
    }
    if (typeof m === "string") {
      if (/"close"/.test(m)) x.ws ? x.ws.close() : socketOver(x, 1000, "");
      return;
    }
    const whole = x.join(new Uint8Array(m));
    if (whole === undefined) return;
    if (x.ws?.readyState === WebSocket.OPEN) x.ws.send(whole);
    else x.queued.push(whole);
  });

  // Ends an exchange: its end, and the channel is ready for the next head.
  const done = (x: Exchange) => {
    if (now === x) now = null;
  };
  // An answer that never got going: its head with the reason, then its end.
  const finish = async (x: Exchange, status: number, error: string) => {
    try {
      await send(dc, JSON.stringify({ status, headers: [], error } satisfies AnswerHead));
      await send(dc, end);
    } catch {}
    done(x);
  };

  async function request(x: Extract<Exchange, { kind: "http" }>) {
    const h = x.head;
    const url = target(ctx.localUrl, h.path);
    if (!url || typeof h.method !== "string" || !/^[A-Z]{3,7}$/.test(h.method)) return finish(x, 400, "Not a path on this fxbot.");
    const headers = new Headers();
    for (const [k, v] of Array.isArray(h.headers) ? h.headers : []) if (typeof k === "string" && typeof v === "string" && !dropped.has(k.toLowerCase())) headers.append(k, v);
    headers.set(bridged, ctx.device);
    let res: Response;
    try {
      res = await fetch(url, { method: h.method, headers, body: h.method === "GET" || h.method === "HEAD" ? undefined : Buffer.concat(x.body), signal: x.abort.signal, redirect: "manual" });
    } catch (error) {
      return finish(x, x.abort.signal.aborted ? 499 : 502, x.abort.signal.aborted ? "Cancelled." : `fxbot didn't answer: ${error instanceof Error ? error.message : error}`);
    }
    try {
      await send(dc, JSON.stringify({ status: res.status, headers: [...res.headers].filter(([k]) => !droppedBack.has(k)) } satisfies AnswerHead));
      if (res.body) for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) for (let at = 0; at < chunk.length; at += CHUNK) await send(dc, chunk.subarray(at, at + CHUNK));
    } catch {
      // Cancelled by the device, or the channel closed: what was sent stands, and the end follows.
      x.abort.abort();
    }
    try {
      await send(dc, end);
    } catch {}
    done(x);
  }

  // A WebSocket's end: the device hears `closed`, with its code, and the channel is free; a device that doesn't reuse
  // channels has it closed instead.
  function socketOver(x: Extract<Exchange, { kind: "ws" }>, code: number, reason: string) {
    if (x.over) return;
    x.over = true;
    x.out = x.out.then(async () => {
      if (x.head.reuse) await send(dc, JSON.stringify({ closed: true, code, reason })).catch(() => {});
      else dc.close();
      done(x);
    });
  }

  function openSocket(x: Extract<Exchange, { kind: "ws" }>) {
    const url = target(ctx.localUrl, x.head.path);
    if (!url) {
      x.out = x.out.then(() => send(dc, JSON.stringify({ status: 400, headers: [], error: "Not a path on this fxbot." } satisfies AnswerHead))).catch(() => {});
      return socketOver(x, 1008, "");
    }
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    const protocols = Array.isArray(x.head.protocols) ? x.head.protocols.filter((p) => typeof p === "string") : [];
    // Node's WebSocket takes headers as undici's own option.
    const ws = (x.ws = new (WebSocket as any)(url, { protocols, headers: { [bridged]: ctx.device } }) as WebSocket);
    ws.binaryType = "arraybuffer";
    let opened = false;
    ws.onopen = () => {
      opened = true;
      x.out = x.out.then(() => send(dc, JSON.stringify({ status: 101, headers: [], protocol: ws.protocol } satisfies AnswerHead))).catch(() => ws.close());
      for (const m of x.queued.splice(0)) ws.send(m);
    };
    ws.onmessage = (e) => {
      const data = typeof e.data === "string" ? e.data : new Uint8Array(e.data as ArrayBuffer);
      x.out = x.out.then(async () => {
        for (const piece of pieces(data)) await send(dc, piece);
      }).catch(() => ws.close());
    };
    ws.onclose = (e) => {
      if (!opened) x.out = x.out.then(() => send(dc, JSON.stringify({ status: 502, headers: [], error: "fxbot refused the WebSocket." } satisfies AnswerHead))).catch(() => {});
      socketOver(x, e.code, e.reason);
    };
  }
}
