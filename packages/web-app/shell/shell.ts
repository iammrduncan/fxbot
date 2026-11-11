// The shell at web.fxbot.sh: it pairs this device with an fxbot, keeps each pairing's key, connects to each fxbot over
// WebRTC, and runs each fxbot's own UI in a frame on an origin of its own, which reaches fxbot only through this page.
// It holds the keys, and draws every screen that decides who gets in. Nothing it shows comes from fxbot.sh but itself.
import qrcode from "qrcode-generator";
import { b64u, base32, concat, dec, fromB64u, random, utf8, type Bytes } from "../protocol/bytes.ts";
import { isk, secret, share } from "../protocol/cpace.ts";
import { Cipher, Handshake, generateKeyPair, keyPairFromPrivate, privateBytes, type KeyPair } from "../protocol/noise.ts";
import * as wire from "../protocol/wire.ts";
import { addPasskey, recoverWithPasskey, passkeysSupported } from "./passkey.ts";

// --- Storage: one IndexedDB store of pairings. A device key is non-extractable: it signs handshakes, and its private
// half can't be read back out.
export type Pairing = { rid: string; I: string; relay: string; device: string; frame: string; name: string; key: KeyPair; seq: number; pairedAt: number; how: string; sealed?: Sealed };
type Sealed = { wrap: CryptoKey; iv: Uint8Array; data: ArrayBuffer; publicKey: Uint8Array };
// A browser that can't store an X25519 key, as WebKit's Linux build can't, keeps its bytes sealed under an AES-GCM key
// it can store, which is non-extractable too.
type Stored = Omit<Pairing, "key"> & { key?: KeyPair };
let storesX25519: Promise<boolean> | null = null;
const canStoreKeys = () =>
  (storesX25519 ??= generateKeyPair(false).then((k) => {
    try {
      structuredClone(k.privateKey);
      return true;
    } catch {
      return false;
    }
  }, () => false));
export const newDeviceKey = async () => generateKeyPair(!(await canStoreKeys()));
async function toStored(p: Pairing): Promise<Stored> {
  if (await canStoreKeys()) return p;
  // Sealed once, when the key is new; a key read back is non-extractable, and keeps its sealed bytes.
  if (p.sealed) {
    const { key: _, ...rest } = p;
    return rest;
  }
  const wrap = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  const iv = random(12);
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, wrap, await privateBytes(p.key.privateKey));
  const { key: _, ...rest } = p;
  return { ...rest, sealed: { wrap, iv, data, publicKey: p.key.publicKey } };
}
async function fromStored(s: Stored): Promise<Pairing> {
  if (s.key) return s as Pairing;
  const raw = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: s.sealed!.iv as Bytes }, s.sealed!.wrap, s.sealed!.data));
  return { ...s, key: await keyPairFromPrivate(raw) };
}
const db = new Promise<IDBDatabase>((resolve, reject) => {
  const open = indexedDB.open("fxbot-shell", 1);
  open.onupgradeneeded = () => open.result.createObjectStore("pairings", { keyPath: "rid" });
  open.onsuccess = () => resolve(open.result);
  open.onerror = () => reject(open.error);
});
async function store<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const tx = (await db).transaction("pairings", mode);
  const req = run(tx.objectStore("pairings"));
  return new Promise((resolve, reject) => ((tx.oncomplete = () => resolve(req.result as T)), (tx.onerror = () => reject(tx.error))));
}
const allPairings = async () => Promise.all((await store<Stored[]>("readonly", (s) => s.getAll())).map(fromStored));
const savePairing = async (p: Pairing) => {
  const stored = await toStored(p);
  return store("readwrite", (s) => s.put(stored));
};
const forget = (rid: string) => store("readwrite", (s) => s.delete(rid));

// Each connect's counter only goes up, across tabs too: a Web Lock holds it while it moves.
async function nextSeq(p: Pairing) {
  const bump = async () => {
    const [now] = (await allPairings()).filter((x) => x.rid === p.rid);
    const seq = Math.max((now?.seq ?? p.seq) + 1, Date.now());
    p.seq = seq;
    await savePairing({ ...(now ?? p), seq });
    return seq;
  };
  return navigator.locks ? navigator.locks.request(`fxbot-seq-${p.rid}`, bump) : bump();
}

// --- Where things are. A frame's origin is `<frame>.<base>`, where the shell is `web.<base>`.
const base = location.host.replace(/^web\./, "");
const frameOrigin = (p: Pairing) => `${location.protocol}//${p.frame}.${base}`;
const ownRelay = `${location.protocol === "http:" ? "ws" : "wss"}://${location.host}/signal`;
const defaultRelay = location.host === "web.fxbot.sh" ? wire.defaultRelay : ownRelay;

function deviceName() {
  const ua = navigator.userAgent;
  const what = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android phone" : /Mac/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows PC" : /Linux|CrOS/.test(ua) ? "Linux computer" : "Device";
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "";
  return { name: what, platform: [what, browser].filter(Boolean).join(", ") };
}
const standalone = () => matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
const iPhoneOutsideApp = () => /iPhone|iPad/.test(navigator.userAgent) && !standalone();

// --- The relay: one WebSocket for one call, with each message read in turn.
type Inbox = { send(e: wire.Envelope): void; next(ms: number): Promise<wire.Envelope & { bytes: Bytes }>; close(): void };
function openCall(url: string): Promise<Inbox> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    // A socket that neither opens nor fails, as one can after a computer wakes up, is given up after 10 seconds.
    const opening = setTimeout(() => (ws.close(), reject(new Error("The relay didn't answer."))), 10_000);
    const got: unknown[] = [];
    let wake: (() => void) | null = null;
    let closed = false;
    ws.onmessage = (e) => {
      try {
        got.push(JSON.parse(String(e.data)));
      } catch {}
      wake?.();
    };
    ws.onclose = () => ((closed = true), wake?.(), reject(new Error("The relay can't be reached, or nothing is waiting there. Check the code, and your connection.")));
    ws.onopen = () => (
      clearTimeout(opening),
      resolve({
        send: (e) => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify(e)),
        close: () => ws.close(1000),
        async next(ms) {
          const until = Date.now() + ms;
          while (!got.length) {
            if (closed) throw new Error("The relay closed the call.");
            if (Date.now() > until) throw new Error("Your fxbot didn't answer in time.");
            await new Promise<void>((r) => ((wake = r), setTimeout(r, Math.min(1000, until - Date.now()))));
            wake = null;
          }
          const e = wire.readEnvelope(got.shift());
          if (e.k === "err") throw new Error(wire.errors[e.e as keyof typeof wire.errors] ?? "Your fxbot stopped the call.");
          return e;
        },
      })
    );
  });
}

// --- A connection to one fxbot: Noise IK through the relay, then the WebRTC answer to fxbot's offer, then the control
// channel's checks. Requests and WebSockets from the frame each get a channel of their own.
type Status = "idle" | "connecting" | "connected" | "failed";
export class Link {
  status: Status = "idle";
  why = "";
  notice: { found: string[]; reach: wire.Reach | null } | null = null;
  reach: wire.Reach | null = null;
  pc: RTCPeerConnection | null = null;
  control: RTCDataChannel | null = null;
  iframe: HTMLIFrameElement | null = null;
  private waiters: (() => void)[] = [];
  private calls = new Map<number, (m: any) => void>();
  private callId = 0;
  private retry = 1000;
  private timer?: ReturnType<typeof setTimeout>;
  // Each attempt's number, and when the newest began: an older attempt that ends late changes nothing.
  private attempt = 0;
  private since = 0;
  // What fxbot tells every connected device: that a device was added, and that the list changed.
  onEvent = (m: any) => {
    if (m.event === "added") announce(`${this.p.name}: ${m.name ?? "A device"}${m.platform ? ` (${m.platform})` : ""} was paired${m.how === "passkey" ? " with a passkey" : ""}. If that wasn't you, remove it under Devices.`);
    if (devicesState.rid === this.p.rid && (m.event === "added" || m.event === "devices")) void loadDevices(this);
  };
  p: Pairing;
  constructor(p: Pairing) {
    this.p = p;
  }

  private set(status: Status, why = "") {
    this.status = status;
    this.why = why;
    if (status === "connected") for (const w of this.waiters.splice(0)) w();
    render();
  }
  async ready(ms = 20_000) {
    if (this.status === "connected") return;
    void this.connect();
    await new Promise<void>((resolve, reject) => {
      this.waiters.push(resolve);
      setTimeout(() => reject(new Error(this.why || "Not connected to your fxbot.")), ms);
    });
  }
  drop() {
    clearTimeout(this.timer);
    this.pc?.close();
    this.pc = null;
    this.control = null;
    this.set("idle");
  }
  async connect(): Promise<void> {
    // One attempt at a time, unless it has been going for 45 seconds: every step has its own limit, so one that old
    // is stuck, as a computer waking up can leave one, and a new one takes its place.
    if (this.status === "connecting" && Date.now() - this.since < 45_000) return;
    const mine = ++this.attempt;
    const stale = () => mine !== this.attempt;
    clearTimeout(this.timer);
    this.pc?.close();
    this.pc = null;
    this.since = Date.now();
    this.set("connecting");
    this.notice = null;
    let via: Inbox | null = null;
    let pc: RTCPeerConnection | null = null;
    try {
      const seq = await nextSeq(this.p);
      via = await openCall(`${this.p.relay}/call/${this.p.rid}`);
      const hs = await new Handshake({ pattern: "IK", initiator: true, prologue: wire.connectPrologue(this.p.rid), s: this.p.key, rs: fromB64u(this.p.I) }).init();
      via.send(wire.envelope("k1", await hs.write(utf8(JSON.stringify({ seq, v: wire.VERSION })))));
      const k2 = await via.next(15_000);
      const info = JSON.parse(dec.decode(await hs.read(k2.bytes))) as { iceServers: wire.IceServer[]; reach: wire.Reach | null; name: string; reuse?: boolean };
      if (stale()) throw new Error("A newer attempt took over.");
      this.reach = info.reach;
      this.reuse = info.reuse === true;
      this.idle = [];
      if (info.name && info.name !== this.p.name) await savePairing({ ...this.p, name: (this.p.name = info.name) });
      const { send: tx, recv: rx } = await hs.split();
      const hash = hs.hash;
      // Sealing keeps a counter, so messages go out one at a time, in order.
      let out = Promise.resolve();
      const v = via;
      const sealed = (value: unknown) => (out = out.then(async () => v.send(await wire.seal(tx, value))));
      pc = new RTCPeerConnection({ iceServers: info.iceServers });
      this.pc = pc;
      const candidates: RTCIceCandidate[] = [];
      const peer = pc;
      peer.onicecandidate = (e) => {
        if (!e.candidate) return;
        candidates.push(e.candidate);
        void sealed({ candidate: e.candidate.toJSON() });
      };
      const fxbotCheck = await wire.channelCheck(hash, "fxbot");
      const deviceCheck = await wire.channelCheck(hash, "device");
      const opened = new Promise<RTCDataChannel>((resolve, reject) => {
        peer.ondatachannel = (e) => {
          const dc = e.channel;
          if (dc.label !== "control") return dc.close();
          let checked = false;
          dc.onopen = () => dc.send(JSON.stringify({ check: deviceCheck }));
          if (dc.readyState === "open") dc.send(JSON.stringify({ check: deviceCheck }));
          dc.onmessage = (m) => {
            const msg = JSON.parse(String(m.data));
            if (!checked) {
              if (msg.check !== fxbotCheck) return reject(new Error("The channel didn't prove it's your fxbot's."));
              checked = true;
              dc.onclose = () => this.control === dc && this.lost("The connection to your fxbot dropped.");
              return resolve(dc);
            }
            if (msg.id !== undefined && this.calls.has(msg.id)) return this.calls.get(msg.id)!(msg);
            if (msg.event === "removed") return void this.removed();
            this.onEvent(msg);
          };
        };
      });
      const offer = await wire.unseal(rx, (await via.next(15_000)).bytes);
      await peer.setRemoteDescription({ type: "offer", sdp: offer.offer });
      await peer.setLocalDescription(await peer.createAnswer());
      await sealed({ answer: peer.localDescription!.sdp });
      peer.onconnectionstatechange = () => {
        if (this.pc !== peer) return;
        if (peer.connectionState === "failed" || peer.connectionState === "closed") this.lost("The connection to your fxbot dropped.");
        if (peer.connectionState === "disconnected") this.timer = setTimeout(() => this.pc === peer && peer.connectionState === "disconnected" && this.lost("The connection to your fxbot dropped."), 5000);
      };
      // No direct path within 15 seconds: say what each side found, and what would work.
      const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(Object.assign(new Error("no path"), { candidates })), 15_000));
      const control = await Promise.race([opened, timeout]);
      if (stale()) throw new Error("A newer attempt took over.");
      this.control = control;
      via.close();
      this.retry = 1000;
      this.set("connected");
    } catch (error: any) {
      via?.close();
      pc?.close();
      // A newer attempt is under way, and this one leaves it be.
      if (stale()) return;
      this.pc = null;
      if (error?.candidates) {
        this.notice = { found: deviceFindings(error.candidates), reach: this.reach };
        this.set("failed", "Your fxbot answered, but no direct path works between this network and it.");
      } else this.set("failed", error instanceof Error ? error.message : String(error));
      // Again later, with jitter, and at once when the page comes back or the network changes.
      if (document.visibilityState === "visible") this.timer = setTimeout(() => void this.connect(), this.retry / 2 + Math.random() * this.retry);
      this.retry = Math.min(this.retry * 2, 60_000);
    }
  }
  private lost(why: string) {
    this.pc?.close();
    this.pc = null;
    this.control = null;
    for (const answer of this.calls.values()) answer({ error: why });
    this.calls.clear();
    this.set("failed", why);
    this.timer = setTimeout(() => void this.connect(), 500);
  }
  // A connection that looks fine may have died while the page was frozen, as iOS does to an app in the background. A
  // ping with no answer in 3 seconds means connect again. One at a time, however many ask.
  private probing: Promise<void> | null = null;
  probe() {
    if (this.status !== "connected") return this.connect();
    return (this.probing ??= (async () => {
      const answered = await Promise.race([this.ask("ping").then(() => true, () => false), new Promise<boolean>((r) => setTimeout(() => r(false), 3000))]);
      if (!answered && this.status === "connected") this.lost("Your fxbot didn't answer, so the app is connecting again.");
    })().finally(() => (this.probing = null)));
  }
  private async removed() {
    this.drop();
    this.set("failed", wire.errors.unknown);
  }
  // A request on the control channel, such as the device list.
  async ask(op: string, args: Record<string, unknown> = {}): Promise<any> {
    await this.ready();
    const id = ++this.callId;
    return new Promise((resolve, reject) => {
      this.calls.set(id, (m) => (this.calls.delete(id), m.error ? reject(new Error(m.error)) : resolve(m.ok)));
      this.control!.send(JSON.stringify({ id, op, ...args }));
    });
  }
  // Channels are kept once open and used for one exchange after another, when fxbot says it can (`reuse`): closing a
  // channel makes both ends reset its stream, and under packet loss werift's reset could land on the next channel to
  // take that stream's number, whose answer then never came. A new connection starts with none.
  private reuse = false;
  private idle: RTCDataChannel[] = [];
  private channel(label: string) {
    while (this.idle.length) {
      const dc = this.idle.pop()!;
      if (dc.readyState === "open") return dc;
    }
    const dc = this.pc!.createDataChannel(label);
    dc.binaryType = "arraybuffer";
    return dc;
  }
  private release(dc: RTCDataChannel, pc: RTCPeerConnection | null) {
    dc.onmessage = dc.onclose = dc.onopen = null;
    if (this.reuse && pc === this.pc && dc.readyState === "open") this.idle.push(dc);
    else dc.close();
  }
  private whenOpen(dc: RTCDataChannel, go: () => void) {
    if (dc.readyState === "open") go();
    else dc.onopen = go;
  }
  // One request from the frame, on a channel of its own while it lasts. A read whose channel closes before its answer
  // starts is a sign the connection died: the app checks it, connects again if it must, and sends the read once more.
  // Giving up on a request says so on the channel, and its end still comes, after which the channel is free.
  request(head: wire.HttpHead, body: ArrayBuffer | null, on: { head(h: wire.AnswerHead): void; chunk(b: ArrayBuffer): void; end(): void; error(e: string): void }) {
    const again = head.method === "GET" || head.method === "HEAD";
    let dc: RTCDataChannel | null = null;
    let done = false;
    let cancel = () => {};
    const fail = (why: string) => !done && ((done = true), on.error(why));
    const attempt = (retry: boolean) =>
      void this.ready().then(() => {
        if (done) return;
        const pc = this.pc;
        let channel: RTCDataChannel;
        try {
          channel = dc = this.channel("http");
        } catch {
          return retry ? void this.probe().then(() => attempt(false)) : fail("The connection to your fxbot closed.");
        }
        let answered = false;
        let ended = false;
        cancel = () => {
          if (ended) return;
          if (this.reuse && channel.readyState === "open") channel.send(JSON.stringify({ abort: true }));
          else ((ended = true), channel.close());
        };
        this.whenOpen(channel, async () => {
          channel.send(JSON.stringify({ ...head, reuse: this.reuse }));
          if (body) for (let at = 0; at < body.byteLength; at += wire.CHUNK) {
            while (channel.bufferedAmount > 1 << 20) await new Promise((r) => setTimeout(r, 5));
            if (channel.readyState !== "open") return;
            channel.send(body.slice(at, at + wire.CHUNK));
          }
          channel.send(wire.end);
        });
        channel.onmessage = (e) => {
          if (typeof e.data === "string") {
            if (e.data === wire.end) {
              ended = true;
              if (!done) ((done = true), on.end());
              return this.release(channel, pc);
            }
            if (!answered) return void ((answered = true), !done && on.head(JSON.parse(e.data)));
            return;
          }
          if (!done) on.chunk(e.data);
        };
        channel.onclose = () => {
          if (ended || dc !== channel) return;
          ended = true;
          if (!done && !answered && retry && again) return void this.probe().then(() => attempt(false));
          fail("The connection to your fxbot closed.");
        };
      }, (error) => fail(error.message));
    attempt(true);
    return { abort: () => ((done = true), cancel()) };
  }
  // One WebSocket from the frame, on a channel of its own while it's open. Closing it says so on the channel, and fxbot
  // answers `closed`, after which the channel is free.
  socket(head: wire.WsHead, on: { open(protocol: string): void; message(d: string | ArrayBuffer): void; close(code: number, reason: string): void }) {
    let dc: RTCDataChannel | null = null;
    const queued: (string | ArrayBuffer)[] = [];
    let closed = false;
    let opened = false;
    const join = wire.joiner();
    const send = (data: string | ArrayBuffer) => {
      for (const piece of wire.pieces(typeof data === "string" ? data : new Uint8Array(data))) dc!.send(piece as Uint8Array<ArrayBuffer>);
    };
    const over = (code: number, reason: string) => !closed && ((closed = true), on.close(code, reason));
    void this.ready().then(() => {
      if (closed) return;
      const pc = this.pc;
      const channel = (dc = this.channel("ws"));
      const reuse = this.reuse;
      let answered = false;
      this.whenOpen(channel, () => channel.send(JSON.stringify({ ...head, reuse })));
      channel.onmessage = (e) => {
        if (typeof e.data === "string") {
          const m = JSON.parse(e.data);
          if (!answered) {
            answered = true;
            if (m.status !== 101) {
              over(1006, m.error ?? "refused");
              if (!reuse) channel.close();
              return;
            }
            opened = true;
            for (const q of queued.splice(0)) send(q);
            return on.open(m.protocol ?? "");
          }
          if (m.closed) {
            over(m.code ?? 1000, m.reason ?? "");
            return this.release(channel, pc);
          }
          return;
        }
        const whole = join(new Uint8Array(e.data));
        if (whole !== undefined) on.message(typeof whole === "string" ? whole : whole.buffer);
      };
      channel.onclose = () => over(1006, "");
    }, () => over(1006, "not connected"));
    return {
      send: (data: string | ArrayBuffer) => (opened && dc?.readyState === "open" ? send(data) : queued.push(data)),
      close: () => {
        if (closed) return;
        closed = true;
        if (!dc) return;
        if (this.reuse && dc.readyState === "open" && opened) dc.send(JSON.stringify({ close: true }));
        else dc.close();
      },
    };
  }
}

// What this device's own candidates say about its network.
function deviceFindings(candidates: RTCIceCandidate[]) {
  const found: string[] = [];
  const srflx = candidates.filter((c) => c.type === "srflx");
  if (!srflx.length) found.push("This network blocks UDP, or no STUN server answered.");
  const ports = new Set(srflx.filter((c) => !c.address?.includes(":")).map((c) => c.port));
  if (ports.size > 1) found.push("This network maps ports per destination (a symmetric NAT), as many phone carriers do.");
  if (candidates.some((c) => c.address?.includes(":") && c.type !== "host")) found.push("This network has IPv6.");
  return found;
}

// --- The port each frame talks through: requests and WebSockets, by id, to the frame's fxbot.
function servePort(port: MessagePort, link: Link) {
  const live = new Map<number, { abort?: () => void; send?: (d: string | ArrayBuffer) => void; close?: () => void }>();
  port.onmessage = (e) => {
    const m = e.data;
    if (m.t === "req")
      live.set(m.id, link.request(m.head, m.body ?? null, {
        head: (head) => port.postMessage({ t: "head", id: m.id, head }),
        chunk: (data) => port.postMessage({ t: "chunk", id: m.id, data }, [data]),
        end: () => (live.delete(m.id), port.postMessage({ t: "end", id: m.id })),
        error: (error) => (live.delete(m.id), port.postMessage({ t: "error", id: m.id, error })),
      }));
    else if (m.t === "abort") (live.get(m.id)?.abort?.(), live.delete(m.id));
    else if (m.t === "ws")
      live.set(m.id, link.socket(m.head, {
        open: (protocol) => port.postMessage({ t: "open", id: m.id, protocol }),
        message: (data) => port.postMessage({ t: "msg", id: m.id, data }),
        close: (code, reason) => (live.delete(m.id), port.postMessage({ t: "close", id: m.id, code, reason })),
      }));
    else if (m.t === "send") live.get(m.id)?.send?.(m.data);
    else if (m.t === "close") (live.get(m.id)?.close?.(), live.delete(m.id));
  };
  port.start();
}
// A frame, or its service worker through it, asks for a port. Each frame origin belongs to one pairing.
addEventListener("message", (e) => {
  if (e.data?.fxbot !== "port" || !e.source) return;
  const link = [...links.values()].find((l) => frameOrigin(l.p) === e.origin);
  if (!link) return;
  const channel = new MessageChannel();
  servePort(channel.port1, link);
  (e.source as Window).postMessage({ fxbot: "port" }, { targetOrigin: e.origin, transfer: [channel.port2] });
});

// --- Pairing: by the link's secret, or by a typed code through CPace first. Then Noise IKpsk2, the six digits, and the
// owner's approval on the side that showed the code.
type Progress = { step: "working" | "compare" | "done" | "failed"; text: string; sas?: string; rid?: string };
let progress: Progress | null = null;
// Notes that stay until dismissed, such as a device added elsewhere.
let notices: string[] = [];
const announce = (text: string) => ((notices = [...notices, text]), render());
const setProgress = (p: Progress | null) => ((progress = p), render());

async function pairWith(t: { rid: string; tid: Bytes; I: Bytes; relay: string }, via: Inbox, psk: Bytes, how: string) {
  const D = await newDeviceKey();
  const me = deviceName();
  const hs = await new Handshake({ pattern: "IKpsk2", initiator: true, prologue: wire.pairPrologue(t.rid, t.tid), s: D, rs: t.I, psk }).init();
  via.send(wire.envelope("p1", concat(t.tid, await hs.write(utf8(JSON.stringify(me))))));
  const p2 = await via.next(20_000);
  let hello: { deviceId: string; name: string };
  try {
    hello = JSON.parse(dec.decode(await hs.read(p2.bytes)));
  } catch {
    throw new Error(wire.errors.failed);
  }
  const { send: tx, recv: rx } = await hs.split();
  via.send(await wire.seal(tx, { confirm: true }));
  setProgress({ step: "compare", text: `Check that ${hello.name} shows these six digits, then approve it there.`, sas: await wire.sixDigits(hs.hash) });
  const p4 = await via.next(10 * 60_000);
  const answer = await wire.unseal(rx, p4.bytes);
  via.close();
  if (!answer.approved) throw new Error(wire.errors.denied);
  const pairing: Pairing = { rid: t.rid, I: b64u(t.I), relay: t.relay, device: hello.deviceId, frame: base32(random(10)), name: hello.name, key: D, seq: 0, pairedAt: Date.now(), how };
  await savePairing(pairing);
  links.set(pairing.rid, new Link(pairing));
  await keepStorage();
  setProgress({ step: "done", text: `Paired with ${hello.name}.`, rid: pairing.rid });
}
async function pairByLink(fragment: string) {
  setProgress({ step: "working", text: "Reaching your fxbot…" });
  try {
    const t = wire.readPairLink(fragment);
    const via = await openCall(`${t.relay}/call/${t.rid}`);
    await pairWith(t, via, await wire.pairPsk(t.S), "link");
  } catch (error) {
    setProgress({ step: "failed", text: error instanceof Error ? error.message : String(error) });
  }
}
async function pairByCode(text: string, relay: string) {
  setProgress({ step: "working", text: "Checking the code…" });
  let via: Inbox | null = null;
  try {
    const { plate, digits } = wire.readCode(text);
    via = await openCall(`${relay}/call/plate/${plate}`);
    const sid = random(16);
    const A = await share(utf8(digits), wire.codeCI(plate), sid);
    via.send(wire.envelope("c1", concat(sid, A.Y)));
    const c2 = await via.next(15_000);
    const Yb = c2.bytes.slice(0, 32);
    const ISK = await isk(sid, secret(A.y, Yb), A.Y, wire.ADa, Yb, wire.ADb);
    let said: wire.CodeTicket;
    try {
      said = JSON.parse(dec.decode(await (await Cipher.of(await wire.codeKey(ISK))).decrypt(new Uint8Array(0), c2.bytes.slice(32))));
    } catch {
      // Each code allows one try: fxbot ends this one when the call closes.
      throw new Error("That code didn't match. Each code allows one try: ask your fxbot for a new one.");
    }
    await pairWith({ rid: said.rid, tid: fromB64u(said.tid), I: fromB64u(said.I), relay: said.relay }, via, await wire.pairPsk(ISK), "code");
  } catch (error) {
    via?.close();
    setProgress({ step: "failed", text: error instanceof Error ? error.message : String(error) });
  }
}

// Asks the browser to keep this site's storage, which holds the pairing. Chrome decides by itself, Firefox asks, and
// Safari grants it to a Home Screen app.
// Firefox asks the person, so the answer may come long after; pairing doesn't wait for it.
let persisted: boolean | null = null;
async function keepStorage() {
  const ask = (async () => (await navigator.storage?.persisted?.()) || (await navigator.storage?.persist?.()) || false)().catch(() => false);
  void ask.then((granted) => ((persisted = granted), render()));
  await Promise.race([ask, new Promise((r) => setTimeout(r, 1500))]);
}
// A private window keeps a small quota and forgets everything when it closes.
let privateWindow = false;
void navigator.storage?.estimate?.().then((e) => ((privateWindow = (e.quota ?? Infinity) < 150 * 1024 * 1024), render())).catch(() => {});

// --- Screens, drawn with the DOM alone, so the CSP can stay strict.
type Kid = Node | string | null | undefined | false | Kid[];
function h(tag: string, props: Record<string, any> = {}, ...kids: Kid[]): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k === "class") el.className = v;
    else if (v !== false && v != null) el.setAttribute(k, v === true ? "" : String(v));
  }
  const add = (kid: Kid) => (Array.isArray(kid) ? kid.forEach(add) : kid !== null && kid !== undefined && kid !== false && el.append(kid));
  kids.forEach(add);
  return el;
}
function qr(text: string) {
  const q = qrcode(0, "M");
  q.addData(text);
  q.make();
  const box = h("div", { class: "qr", role: "img", "aria-label": "QR code of the pairing link" });
  box.append(new DOMParser().parseFromString(q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }), "image/svg+xml").documentElement);
  return box;
}
const ago = (t: string | number | null) => {
  if (!t) return "never";
  const s = (Date.now() - new Date(t).getTime()) / 1000;
  return s < 90 ? "just now" : s < 5400 ? `${Math.round(s / 60)} minutes ago` : s < 129600 ? `${Math.round(s / 3600)} hours ago` : `${Math.round(s / 86400)} days ago`;
};

const links = new Map<string, Link>();
type View = { name: "home" } | { name: "pair" } | { name: "open"; rid: string } | { name: "devices"; rid: string } | { name: "recover" };
let view: View = { name: "home" };
function go(next: View, push = true) {
  view = next;
  if (push) history.pushState(null, "", next.name === "pair" ? "/pair" : "/");
  render();
}
addEventListener("popstate", () => ((view = { name: "home" }), (progress = null), render()));

const app = document.getElementById("app")!;
const frames = document.getElementById("frames")!;
function render() {
  // Frames stay alive behind the screens, so going back and opening again is instant.
  for (const link of links.values()) link.iframe?.classList.toggle("shown", view.name === "open" && view.rid === link.p.rid);
  document.body.classList.toggle("framed", view.name === "open");
  app.replaceChildren(screen(), ...notices.map((text, i) => h("div", { class: "announce", role: "status" }, h("span", {}, text), h("button", { class: "ghost small", onclick: () => ((notices = notices.filter((_, j) => j !== i)), render()) }, "OK"))));
}
function screen(): HTMLElement {
  if (progress) return pairingScreen(progress);
  if (view.name === "pair") return pairScreen();
  if (view.name === "recover") return recoverScreen();
  if (view.name === "open") return openBar(links.get(view.rid)!);
  if (view.name === "devices") return devicesScreen(links.get(view.rid)!);
  return home();
}
const notes = () => [
  privateWindow && h("p", { class: "note warn" }, "This looks like a private window. A pairing made here is lost when the window closes."),
  iPhoneOutsideApp() && h("p", { class: "note warn" }, "On an iPhone or iPad, add this app to your Home Screen first: tap Share, then Add to Home Screen. Then open it from there, and pair in it. Safari and the Home Screen app keep separate storage."),
];
const dot = (s: Status) => h("span", { class: `dot ${s}`, "aria-label": s });

function home() {
  const list = [...links.values()];
  return h("section", { class: "screen" },
    h("header", {}, h("h1", {}, "fxbot"), h("p", { class: "muted" }, "Your own fxbot, from anywhere, peer to peer.")),
    notes(),
    list.length
      ? h("ul", { class: "list" }, list.map((l) =>
          h("li", { class: "row" },
            h("button", { class: "grow", onclick: () => open(l) }, dot(l.status), h("span", { class: "name" }, l.p.name), h("span", { class: "muted small" }, l.status === "connected" ? "Connected" : l.status === "connecting" ? "Connecting…" : l.status === "failed" ? "Can't connect" : "")),
            h("button", { class: "ghost", onclick: () => go({ name: "devices", rid: l.p.rid }) }, "Devices"))))
      : h("p", { class: "muted" }, "No fxbot is paired with this device yet. In your fxbot, open Settings › Web pairing, and choose Pair a device."),
    h("div", { class: "actions" },
      h("button", { class: "primary", onclick: () => go({ name: "pair" }) }, "Pair a device"),
      passkeysSupported() && h("button", { class: "ghost", onclick: () => go({ name: "recover" }) }, "Use a passkey")),
    h("p", { class: "muted small" }, h("a", { href: wire.docs.phone, target: "_blank", rel: "noreferrer" }, "How web pairing works")));
}

function pairScreen() {
  const input = h("input", { id: "code", inputmode: "numeric", autocomplete: "off", placeholder: "47-3816-0925", "aria-label": "Pairing code" }) as HTMLInputElement;
  const relay = h("input", { id: "relay", value: defaultRelay, "aria-label": "Relay" }) as HTMLInputElement;
  const scan = "BarcodeDetector" in window && "mediaDevices" in navigator ? h("button", { class: "ghost", onclick: () => scanQr() }, "Scan the QR code") : null;
  return h("section", { class: "screen" },
    h("header", {}, h("button", { class: "back", onclick: () => history.back() }, "‹ Back"), h("h1", {}, "Pair this device")),
    notes(),
    h("p", {}, "In your fxbot, open Settings › Web pairing and choose Pair a device. Then type the code it shows, or scan its QR code."),
    h("form", { class: "stack", onsubmit: (e: Event) => (e.preventDefault(), void pairByCode(input.value, relay.value.trim() || defaultRelay)) },
      h("label", { for: "code" }, "Code"), input,
      h("details", {}, h("summary", {}, "Relay"), h("label", { for: "relay", class: "small muted" }, "Only if your fxbot uses a relay of its own."), relay),
      h("button", { class: "primary", type: "submit" }, "Pair")),
    scan,
    h("video", { id: "camera", class: "camera", playsinline: true, muted: true }));
}
async function scanQr() {
  const video = document.getElementById("camera") as HTMLVideoElement;
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
  video.srcObject = stream;
  video.classList.add("on");
  await video.play();
  const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
  const stopAll = () => stream.getTracks().forEach((t) => t.stop());
  for (let i = 0; i < 600 && video.isConnected; i++) {
    const [found] = await detector.detect(video).catch(() => []);
    const text: string | undefined = found?.rawValue;
    if (text) {
      const url = new URL(text);
      stopAll();
      if (url.pathname === "/pair" && url.hash) return void pairByLink(url.hash);
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  stopAll();
}

function pairingScreen(p: Progress) {
  return h("section", { class: "screen" },
    h("header", {}, h("h1", {}, p.step === "done" ? "Paired" : p.step === "failed" ? "Not paired" : "Pairing")),
    p.sas && h("p", { class: "sas", "aria-label": "Six digits" }, `${p.sas.slice(0, 3)} ${p.sas.slice(3)}`),
    h("p", { class: p.step === "failed" ? "note bad" : "" }, p.text),
    p.step === "compare" && h("p", { class: "muted small" }, "If the digits don't match, don't approve: someone else may be pairing."),
    p.step === "done" && persisted === false && h("p", { class: "note warn" }, "The browser didn't promise to keep this site's storage, so it may clear the pairing when space runs low."),
    p.step === "done" && h("p", { class: "muted small" }, "Pair a second device too, or add a passkey, so a device that loses its storage can pair again from anywhere."),
    p.step === "done" && persisted === true && h("p", { class: "muted small" }, "The browser will keep this pairing."),
    h("div", { class: "actions" },
      p.step === "done" && h("button", { class: "primary", onclick: () => ((progress = null), open(links.get(p.rid!)!)) }, "Open"),
      p.step === "done" && passkeysSupported() && h("button", { class: "ghost", onclick: () => void passkeyFor(links.get(p.rid!)!) }, "Add a passkey"),
      (p.step === "done" || p.step === "failed") && h("button", { class: p.step === "failed" ? "primary" : "ghost", onclick: () => ((progress = null), go({ name: "home" })) }, "Done")));
}

function open(link: Link) {
  if (!link.iframe) {
    // Camera and microphone for the UI's own uses; clipboard for its copy buttons.
    link.iframe = h("iframe", { src: `${frameOrigin(link.p)}/__fxbot/start?path=/`, allow: "camera; microphone; clipboard-read; clipboard-write; fullscreen", title: link.p.name }) as HTMLIFrameElement;
    frames.append(link.iframe);
  }
  if (link.status !== "connected") void link.connect();
  go({ name: "open", rid: link.p.rid });
}
function openBar(link: Link) {
  return h("nav", { class: "bar" },
    h("button", { class: "back", onclick: () => history.back(), "aria-label": "All fxbots" }, "‹"),
    dot(link.status),
    h("span", { class: "name" }, link.p.name),
    link.status !== "connected" && h("span", { class: "small muted" }, link.status === "connecting" ? "Connecting…" : link.why),
    h("button", { class: "ghost small", onclick: () => go({ name: "devices", rid: link.p.rid }) }, "Devices"),
    link.notice && noticePanel(link));
}
// The notice when no direct path works: what happened, what each side found, and what would, in order.
function noticePanel(link: Link) {
  const n = link.notice!;
  const ways: [string, string][] = [
    ["Try another network, such as Wi-Fi instead of cellular.", wire.docs.other],
    ["Map or forward a port at home.", wire.docs.port],
    ["Add a TURN server of your own.", wire.docs.turn],
    ["Use Tailscale.", wire.docs.tailscale],
    ["Use WireGuard.", wire.docs.wireguard],
  ];
  return h("div", { class: "notice", role: "alert" },
    h("p", {}, h("strong", {}, "Your fxbot answered, but no direct path works between this network and it.")),
    h("ul", {}, n.found.map((f) => h("li", {}, f)), (n.reach?.findings ?? []).filter((f) => f.result === "bad" || f.result === "warn").map((f) => h("li", {}, `Your fxbot: ${f.text}`))),
    h("p", {}, "What would work:"),
    h("ol", {}, ways.map(([text, href]) => h("li", {}, h("a", { href, target: "_blank", rel: "noreferrer" }, text)))),
    h("button", { class: "ghost small", onclick: () => void link.connect() }, "Try again"));
}

// The devices of one fxbot, from its control channel, and pairing another device from this one.
let devicesState: { rid: string; list?: any[]; error?: string; ticket?: any } = { rid: "" };
function devicesScreen(link: Link) {
  if (devicesState.rid !== link.p.rid) {
    devicesState = { rid: link.p.rid };
    void loadDevices(link);
  }
  const s = devicesState;
  const t = s.ticket;
  return h("section", { class: "screen" },
    h("header", {}, h("button", { class: "back", onclick: () => history.back() }, "‹ Back"), h("h1", {}, link.p.name)),
    h("p", { class: "muted small" }, dot(link.status), " ", link.status === "connected" ? "Connected, peer to peer." : link.why || "Connecting…"),
    link.notice && noticePanel(link),
    s.error && h("p", { class: "note bad" }, s.error),
    h("h2", {}, "Devices"),
    s.list ? h("ul", { class: "list" }, s.list.map((d) => h("li", { class: "row" },
      h("div", { class: "grow" },
        h("div", {}, dot(d.connected ? "connected" : "idle"), " ", h("span", { class: "name" }, d.name), d.you && h("span", { class: "badge" }, "This device")),
        h("div", { class: "muted small" }, [d.platform, `paired ${ago(d.pairedAt)} by ${d.how === "code" ? "code" : d.how === "passkey" ? "passkey" : "link"}, approved on ${d.pairedBy}`, `seen ${ago(d.lastSeen)}`].filter(Boolean).join(" · "))),
      h("button", { class: "ghost small", onclick: () => rename(link, d) }, "Rename"),
      h("button", { class: "ghost small danger", onclick: () => removeDevice(link, d) }, "Remove")))) : h("p", { class: "muted" }, "Loading…"),
    h("h2", {}, "Pair another device"),
    t && t.state === "open" ? h("div", { class: "stack" },
      h("p", {}, "On the new device, open ", h("strong", {}, location.host), " and type this code, or scan the QR code."),
      t.code && h("p", { class: "code" }, t.code),
      qr(t.link),
      h("button", { class: "ghost small", onclick: () => navigator.clipboard?.writeText(t.link) }, "Copy the link"),
      h("p", { class: "muted small" }, "The code works once, for 10 minutes.")) :
    t && t.state === "compare" ? h("div", { class: "stack" },
      h("p", {}, `${t.device?.name ?? "A device"} wants to pair. Check it shows these six digits:`),
      h("p", { class: "sas" }, `${t.sas.slice(0, 3)} ${t.sas.slice(3)}`),
      h("div", { class: "actions" },
        h("button", { class: "primary", onclick: () => decide(link, true) }, "Approve"),
        h("button", { class: "ghost", onclick: () => decide(link, false) }, "Deny"))) :
    h("div", { class: "stack" },
      t && h("p", { class: t.state === "approved" ? "muted" : "note bad" }, t.state === "approved" ? `Paired ${t.device?.name ?? "the device"}.` : t.why ?? "That pairing ended."),
      h("button", { class: "primary", onclick: () => startTicket(link) }, "Pair another device")),
    h("h2", {}, "This device"),
    h("p", { class: "muted small" }, persisted === null ? "" : persisted ? "The browser will keep this device's pairing." : "The browser may clear this device's pairing when space runs low: pair a second device, or add a passkey."),
    h("div", { class: "actions" },
      passkeysSupported() && h("button", { class: "ghost", onclick: () => void passkeyFor(link) }, "Add a passkey"),
      h("button", { class: "ghost danger", onclick: () => forgetHere(link) }, "Forget on this device")),
    h("p", { class: "muted small" }, `Key fingerprint: ${link.p.rid.match(/.{1,4}/g)!.join(" ")}. Settings › Web pairing on your fxbot shows the same.`));
}
async function loadDevices(link: Link) {
  try {
    const out = await link.ask("devices");
    devicesState.list = out.devices;
    devicesState.error = undefined;
  } catch (error) {
    devicesState.error = error instanceof Error ? error.message : String(error);
  }
  render();
}
async function startTicket(link: Link) {
  try {
    devicesState.ticket = await link.ask("pair");
    render();
    // Until it's approved or ends.
    while (view.name === "devices" && ["open", "pairing", "compare"].includes(devicesState.ticket?.state)) {
      await new Promise((r) => setTimeout(r, 1500));
      devicesState.ticket = await link.ask("ticket", { tid: devicesState.ticket.tid });
      render();
    }
    void loadDevices(link);
  } catch (error) {
    devicesState.error = error instanceof Error ? error.message : String(error);
    render();
  }
}
async function decide(link: Link, ok: boolean) {
  try {
    devicesState.ticket = await link.ask("approve", { tid: devicesState.ticket.tid, ok });
  } catch (error) {
    devicesState.error = error instanceof Error ? error.message : String(error);
  }
  void loadDevices(link);
}
async function rename(link: Link, d: any) {
  const name = prompt("Name this device", d.name);
  if (!name) return;
  await link.ask("rename", { device: d.id, name }).catch((e) => (devicesState.error = e.message));
  void loadDevices(link);
}
async function removeDevice(link: Link, d: any) {
  if (!confirm(d.you ? "Remove this device? It won't reach your fxbot again until it pairs again." : `Remove ${d.name}? It won't reach your fxbot again until it pairs again.`)) return;
  await link.ask("remove", { device: d.id }).catch((e) => (devicesState.error = e.message));
  void loadDevices(link);
}
async function forgetHere(link: Link) {
  if (!confirm(`Forget ${link.p.name} on this device? Your fxbot keeps the device in its list until you remove it there.`)) return;
  link.drop();
  link.iframe?.remove();
  links.delete(link.p.rid);
  await forget(link.p.rid);
  go({ name: "home" });
}

// --- Passkeys (opt-in): one per fxbot, kept by the browser's password manager, which pairs a wiped device again.
async function passkeyFor(link: Link) {
  try {
    await addPasskey(link);
    alert("Passkey added. On a new or wiped device, choose Use a passkey to pair it again.");
  } catch (error) {
    alert(error instanceof Error ? error.message : String(error));
  }
}
function recoverScreen() {
  const relay = h("input", { id: "relay", value: defaultRelay, "aria-label": "Relay" }) as HTMLInputElement;
  return h("section", { class: "screen" },
    h("header", {}, h("button", { class: "back", onclick: () => history.back() }, "‹ Back"), h("h1", {}, "Pair with a passkey")),
    notes(),
    h("p", {}, "If you added a passkey for your fxbot on another device, it pairs this one again, with no code. Every paired device is told."),
    h("details", {}, h("summary", {}, "Relay"), relay),
    h("button", { class: "primary", onclick: () => void recover(relay.value.trim() || defaultRelay) }, "Use a passkey"));
}
async function recover(relay: string) {
  setProgress({ step: "working", text: "Waiting for your passkey…" });
  try {
    const pairing = await recoverWithPasskey(relay, deviceName(), base32(random(10)));
    await savePairing(pairing);
    links.set(pairing.rid, new Link(pairing));
    await keepStorage();
    setProgress({ step: "done", text: `Paired with ${pairing.name}, by passkey.`, rid: pairing.rid });
  } catch (error) {
    setProgress({ step: "failed", text: error instanceof Error ? error.message : String(error) });
  }
}

// --- Start: the pairings, a link in the address if there is one, and reconnecting when the page or network comes back.
for (const p of await allPairings()) links.set(p.rid, new Link(p));
void navigator.storage?.persisted?.().then((v) => ((persisted = v), render()));
if (location.pathname === "/pair" && location.hash.length > 1) {
  const fragment = location.hash;
  // The link's secret leaves the address bar at once.
  history.replaceState(null, "", "/pair");
  view = { name: "pair" };
  void pairByLink(fragment);
} else if (location.pathname === "/pair") view = { name: "pair" };
render();
// Coming back to the app, or to a network: each open fxbot checks its connection, and connects again if it must.
const revive = () => {
  for (const l of links.values()) if (l.iframe) void l.probe();
};
document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && revive());
addEventListener("online", revive);
(navigator as any).connection?.addEventListener?.("change", revive);
if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js").catch(() => {});
