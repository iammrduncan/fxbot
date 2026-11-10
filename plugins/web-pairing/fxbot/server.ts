import { hostname } from "node:os";
import type { PluginApi } from "@fxbot/sdk";
import { RTCPeerConnection, type RTCDataChannel } from "werift";
import { b64u, concat, dec, equal, fromB64u, random, utf8, type Bytes } from "../../../packages/web-app/protocol/bytes.ts";
import { isk, secret, share } from "../../../packages/web-app/protocol/cpace.ts";
import { Cipher, Handshake, generateKeyPair, keyPairFromPrivate, privateBytes, type KeyPair } from "../../../packages/web-app/protocol/noise.ts";
import * as wire from "../../../packages/web-app/protocol/wire.ts";
import { bridged, serve } from "./bridge.ts";
import { checkAssertion, checkNew } from "./passkey.ts";
import { Mapper, check, checkEntry, cloudflareStun, forWerift, freePort, globalV6, hostAddresses, iceServers, inContainer, shown, type IceEntry } from "./reach.ts";

// Web pairing: the owner's fxbot from their phone or any computer, over a WebRTC data channel, with nothing exposed.
// fxbot.sh's relay passes the sealed handshake and stores nothing; this plugin holds fxbot's keys and its devices, and
// passes each device's requests to fxbot's own API (docs/_completed/phases/web-pairing.md).

type Config = { on: boolean; relay: string; ice: IceEntry[]; ports: [number, number]; mapping: boolean };
type Passkey = { id: string; spki: Buffer; alg: number; added_by: string; added_at: Date; used_at: Date | null };
type Device = { id: string; name: string; platform: string; key: Buffer; paired_at: Date; paired_by: string; how: string; last_seen: Date | null; last_seq: string };
type Line = { ws: WebSocket; calls: Map<string, Call>; plate?: number; ticket?: Ticket };
type Call = {
  id: string;
  line: Line;
  queue: Promise<void>;
  stage: "new" | "code" | "confirm" | "compare" | "rtc" | "done";
  psk?: Bytes;
  tx?: Cipher;
  rx?: Cipher;
  hash?: Bytes;
  ticket?: Ticket;
  pc?: RTCPeerConnection;
  conn?: Conn;
};
type Ticket = {
  tid: Bytes;
  S: Bytes;
  digits: string;
  plate?: number;
  line?: Line;
  expires: number;
  by: { id: string | null; name: string };
  state: "open" | "pairing" | "compare" | "approved" | "denied" | "failed" | "expired";
  why?: string;
  sas?: string;
  pending?: { id: string; name: string; platform: string; key: Bytes; how: string };
  call?: Call;
  timer: ReturnType<typeof setTimeout>;
};
type Conn = { pc: RTCPeerConnection; device: string; control?: RTCDataChannel; ready: boolean; connected: boolean; route?: string; since?: number; answered?: number; found?: number };

const TICKET_MS = 10 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;
const SIX_HOURS = 6 * 60 * 60 * 1000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const refused = (text: string, status = 400) => Response.json({ error: text }, { status });
const tailnet = (ip: string) => /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(ip) || /^fd7a:115c:a1e0:/i.test(ip);
// Which way a connection went, from the candidate pair werift chose.
function routeOf(pc: RTCPeerConnection) {
  try {
    const pair = (pc.iceTransports[0] as any)?.connection?.nominated;
    if (!pair) return "";
    const [local, remote] = [pair.localCandidate, pair.remoteCandidate];
    if (local.type === "relay" || remote.type === "relay") return "through a TURN server";
    if (tailnet(local.host) && tailnet(remote.host)) return "over Tailscale";
    if (local.type === "host" && remote.type === "host" && !/\.local$/.test(remote.host)) return "on the same network";
    return "directly, across the internet";
  } catch {
    return "";
  }
}
const lasted = (ms: number) => (ms < 90_000 ? `${Math.round(ms / 1000)} seconds` : ms < 5_400_000 ? `${Math.round(ms / 60_000)} minutes` : `${(ms / 3_600_000).toFixed(1)} hours`);

export default async function webPairing(fx: PluginApi) {
  // --- Keys, made once and sealed: I, the Noise static key, and L, for listening at the relay.
  const keys = await (async () => {
    let saved = await fx.secrets.get("keys");
    if (!saved) {
      const I = await generateKeyPair(true);
      const L = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])) as CryptoKeyPair;
      saved = JSON.stringify({ I: b64u(await privateBytes(I.privateKey)), L: b64u(new Uint8Array(await crypto.subtle.exportKey("pkcs8", L.privateKey))) });
      await fx.secrets.set("keys", saved);
    }
    const k = JSON.parse(saved) as { I: string; L: string };
    const I = await keyPairFromPrivate(fromB64u(k.I));
    const open = await crypto.subtle.importKey("pkcs8", fromB64u(k.L), { name: "Ed25519" }, true, ["sign"]);
    const Lpub = fromB64u((await crypto.subtle.exportKey("jwk", open)).x!);
    const Lpriv = await crypto.subtle.importKey("pkcs8", fromB64u(k.L), { name: "Ed25519" }, false, ["sign"]);
    return { I, Lpub, Lpriv };
  })();
  const rid = await wire.ridOf(keys.Lpub, keys.I.publicKey);
  // Inside a container, the host name is the container's id, which changes with each update.
  const name = (!inContainer() && hostname().split(".")[0]) || "fxbot";

  // --- What the owner sets in the tab, sealed, since TURN credentials are in it.
  let config: Config = { on: true, relay: wire.defaultRelay, ice: [cloudflareStun], ports: [8790, 8799], mapping: true, ...JSON.parse((await fx.secrets.get("config")) ?? "{}") };
  const saveConfig = (next: Partial<Config>) => ((config = { ...config, ...next }), fx.secrets.set("config", JSON.stringify(config)));

  const devices = async () => fx.sql<Device[]>`select * from devices order by paired_at`;
  let deviceCount = (await devices()).length;
  const passkeys = async () => fx.sql<Passkey[]>`select * from passkeys order by added_at`;
  let passkeyCount = (await passkeys()).length;
  const challenges = new Map<string, { challenge: string; at: number }>();
  const nonces = new Map<string, number>();
  const tickets = new Map<string, Ticket>();
  const failures: number[] = [];
  let lockedUntil = 0;
  const conns = new Set<Conn>();
  const mapper = new Mapper();
  let reach: wire.Reach | null = null;
  let reachAt = 0;
  let reaching: Promise<wire.Reach> | null = null;
  const checkNow = () => (reaching ??= check(config.ice, mapper).then((r) => ((reach = r), (reachAt = Date.now()), r)).finally(() => (reaching = null)));

  // --- The listener: one socket to the relay while a pairing is open or a device is paired, and none otherwise.
  let listener: Line | null = null;
  let wanted = false;
  let retry = 1000;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let sixHourly: ReturnType<typeof setInterval> | undefined;
  const openTickets = () => [...tickets.values()].some((t) => ["open", "pairing", "compare"].includes(t.state));

  async function listenUrl() {
    const t = String(Date.now());
    const s = new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, keys.Lpriv, wire.listenProof(rid, t)));
    const q = new URLSearchParams({ l: b64u(keys.Lpub), i: b64u(keys.I.publicKey), t, s: b64u(s) });
    return `${config.relay}/listen/${rid}?${q}`;
  }
  function line(url: string, onOpen: (l: Line) => void, onClose: (l: Line, code: number) => void): Line {
    const l: Line = { ws: new WebSocket(url), calls: new Map() };
    let heard = Date.now();
    l.ws.onopen = () => onOpen(l);
    l.ws.onmessage = (e) => {
      heard = Date.now();
      if (e.data === "pong") return;
      let m: any;
      try {
        m = JSON.parse(String(e.data));
      } catch {
        return;
      }
      if (typeof m.plate === "number" && l.ticket) return void (l.plate = m.plate);
      if (typeof m.call !== "string") return;
      let call = l.calls.get(m.call);
      if (m.closed) {
        if (call) callClosed(call);
        return;
      }
      if (!call) l.calls.set(m.call, (call = { id: m.call, line: l, queue: Promise.resolve(), stage: "new" }));
      const c = call;
      c.queue = c.queue.then(() => onEnvelope(c, m.d)).catch((error) => {
        fx.log(`A call failed: ${error instanceof Error ? error.message : error}`);
        end(c);
      });
    };
    // Node's WebSocket fires only error when the relay refuses it, and close after error otherwise: once either way.
    let ended = false;
    const closed = (code: number) => {
      if (ended) return;
      ended = true;
      clearInterval(timer);
      for (const c of l.calls.values()) callClosed(c);
      onClose(l, code);
    };
    l.ws.onclose = (e) => closed(e.code);
    l.ws.onerror = () => (l.ws.readyState === WebSocket.OPEN ? undefined : closed(1006));
    // A small ping every 30 s, which the relay answers without waking; silence for 75 s means the line is dead.
    const timer = setInterval(() => {
      if (Date.now() - heard > 75_000) return l.ws.close();
      if (l.ws.readyState === WebSocket.OPEN) l.ws.send("ping");
    }, 30_000);
    return l;
  }
  async function connectListener() {
    if (!wanted || listener) return;
    let url: string;
    try {
      url = await listenUrl();
    } catch (error) {
      return fx.log(`Couldn't sign for the relay: ${error}`);
    }
    if (!wanted || listener) return;
    listener = line(url, () => {
      retry = 1000;
      fx.log(`Listening at ${config.relay} as ${rid}.`);
    }, (l) => {
      if (listener === l) listener = null;
      if (!wanted) return;
      // With jitter, since a deploy of the relay drops every fxbot at once.
      const wait = retry / 2 + Math.random() * retry;
      retry = Math.min(retry * 2, 60_000);
      retryTimer = setTimeout(connectListener, wait);
    });
  }
  function settle() {
    // A passkey keeps it listening too, so a wiped device can pair again with no other device.
    const want = config.on && (deviceCount > 0 || passkeyCount > 0 || openTickets());
    if (want === wanted) return;
    wanted = want;
    if (want) {
      void connectListener();
      if (config.mapping) void mapper.start(config.ports, fx.log).then(() => checkNow());
      clearInterval(sixHourly);
      sixHourly = setInterval(() => deviceCount > 0 && void checkNow(), SIX_HOURS);
    } else {
      clearTimeout(retryTimer);
      clearInterval(sixHourly);
      listener?.ws.close(1000);
      listener = null;
      void mapper.stop();
    }
  }
  fx.signal.addEventListener("abort", () => {
    wanted = false;
    clearTimeout(retryTimer);
    clearInterval(sixHourly);
    listener?.ws.close(1000);
    for (const t of tickets.values()) (clearTimeout(t.timer), t.line?.ws.close(1000));
    for (const c of conns) c.pc.close();
    void mapper.stop();
  });

  // --- Calls: what a device says through the relay, in order, one call at a time.
  const send = (c: Call, e: wire.Envelope) => c.line.ws.readyState === WebSocket.OPEN && c.line.ws.send(JSON.stringify({ call: c.id, d: e }));
  const end = (c: Call, linger = 0) => {
    if (c.stage === "done") return;
    c.stage = "done";
    setTimeout(() => c.line.ws.readyState === WebSocket.OPEN && c.line.ws.send(JSON.stringify({ call: c.id, close: true })), linger);
  };
  const stop = (c: Call, why: keyof typeof wire.errors) => (send(c, wire.failure(why)), end(c, 500));
  const sealed = async (c: Call, value: unknown) => send(c, await wire.seal(c.tx!, value));

  function callClosed(c: Call) {
    c.line.calls.delete(c.id);
    // A device that leaves a pairing midway ends that ticket: a wrong code, or a step it refused.
    if (c.ticket && ["pairing", "compare"].includes(c.ticket.state)) failTicket(c.ticket, "The device left before the pairing finished.");
    else if (c.stage === "code" && c.line.ticket) failTicket(c.line.ticket, "A code was tried, and the device stopped there: likely the wrong code.", true);
    if (c.stage !== "rtc") c.stage = "done";
  }

  async function onEnvelope(c: Call, raw: unknown) {
    if (c.stage === "done") return;
    const e = wire.readEnvelope(raw);
    if (e.k === "c1" && c.stage === "new" && c.line.ticket) return code(c, c.line.ticket, e.bytes);
    if (e.k === "p1" && (c.stage === "new" || c.stage === "code")) return pair(c, e.bytes);
    if (e.k === "k1" && c.stage === "new" && c.line === listener) return connect(c, e.bytes);
    if (e.k === "r1" && c.stage === "new" && c.line === listener) return byPasskey(c, e.bytes);
    if (e.k === "t" && c.rx) {
      let m: any;
      try {
        m = await wire.unseal(c.rx, e.bytes);
      } catch {
        if (c.ticket) failTicket(c.ticket, "A pairing message didn't decrypt.");
        return stop(c, "failed");
      }
      if (c.stage === "confirm" && m?.confirm === true && c.ticket) {
        c.stage = "compare";
        c.ticket.state = "compare";
        c.ticket.sas = await wire.sixDigits(c.hash!);
        c.ticket.call = c;
        return;
      }
      if (c.stage === "rtc" && c.pc) {
        if (typeof m?.answer === "string") {
          await c.pc.setRemoteDescription({ type: "answer", sdp: m.answer });
          if (c.conn) c.conn.answered = Date.now();
        }
        // Not awaited: werift waits up to 10 seconds to resolve a `.local` name, which a phone's first candidate often
        // is, and nobody here can answer for a phone elsewhere. Its usable candidates go in meanwhile.
        else if (m?.candidate) void c.pc.addIceCandidate(m.candidate).catch(() => {});
        return;
      }
      return;
    }
    if (e.k === "err") return end(c);
    return stop(c, "failed");
  }

  // C1: a typed code. One CPace run for each code; C2 says where to go next, sealed under the shared key.
  async function code(c: Call, t: Ticket, bytes: Bytes) {
    if (Date.now() < lockedUntil) return stop(c, "locked");
    if (t.state !== "open" || t.plate === undefined || t.line !== c.line || [...c.line.calls.values()].some((o) => o !== c && o.stage !== "new")) return stop(c, "expired");
    if (bytes.length !== 48) return stop(c, "failed");
    c.stage = "code";
    const [sid, Ya] = [bytes.slice(0, 16), bytes.slice(16)];
    const B = await share(utf8(t.digits), wire.codeCI(t.plate), sid);
    let K: Bytes;
    try {
      K = secret(B.y, Ya);
    } catch {
      failTicket(t, "A code was tried with a bad share.", true);
      return stop(c, "failed");
    }
    const ISK = await isk(sid, K, Ya, wire.ADa, B.Y, wire.ADb);
    c.psk = await wire.pairPsk(ISK);
    const said: wire.CodeTicket = { rid, I: b64u(keys.I.publicKey), tid: b64u(t.tid), name, relay: config.relay };
    const box = await (await Cipher.of(await wire.codeKey(ISK))).encrypt(new Uint8Array(0), utf8(JSON.stringify(said)));
    send(c, wire.envelope("c2", concat(B.Y, box)));
  }

  // P1 to P3: Noise IKpsk2 with the ticket's secret, or the code's key in its place. Then the six digits, and approval.
  async function pair(c: Call, bytes: Bytes) {
    if (Date.now() < lockedUntil) return stop(c, "locked");
    const t = tickets.get(b64u(bytes.slice(0, 16)));
    if (!t || t.state !== "open" || Date.now() > t.expires) return stop(c, "expired");
    // A call through a nameplate pairs with the code's key, and one to the address with the link's secret.
    if (c.line.ticket && (!c.psk || c.line.ticket !== t)) return stop(c, "failed");
    t.state = "pairing";
    c.ticket = t;
    const hs = await new Handshake({ pattern: "IKpsk2", initiator: false, prologue: wire.pairPrologue(rid, t.tid), s: keys.I, psk: c.psk ?? (await wire.pairPsk(t.S)) }).init();
    let hello: { name?: unknown; platform?: unknown };
    try {
      hello = JSON.parse(dec.decode(await hs.read(bytes.slice(16))));
    } catch {
      failTicket(t, c.psk ? "The code was wrong." : "A pairing message didn't decrypt.", Boolean(c.psk));
      return stop(c, "failed");
    }
    const id = b64u(random(9));
    t.pending = {
      id,
      name: typeof hello.name === "string" && hello.name.trim() ? hello.name.trim().slice(0, 64) : "A device",
      platform: typeof hello.platform === "string" ? hello.platform.slice(0, 64) : "",
      key: hs.rs!,
      how: c.psk ? "code" : "link",
    };
    send(c, wire.envelope("p2", await hs.write(utf8(JSON.stringify({ deviceId: id, name })))));
    const { send: tx, recv: rx } = await hs.split();
    Object.assign(c, { tx, rx, hash: hs.hash, stage: "confirm" });
  }

  function failTicket(t: Ticket, why: string, wrongCode = false) {
    if (!["open", "pairing", "compare"].includes(t.state)) return;
    t.state = "failed";
    t.why = why;
    finishTicket(t);
    if (wrongCode) countFailure();
  }
  // Three wrong codes, or refused passkeys, in 15 minutes lock pairing for 15 minutes.
  function countFailure() {
    const now = Date.now();
    failures.push(now);
    while (failures.length && now - failures[0] > LOCK_MS) failures.shift();
    if (failures.length < 3) return;
    lockedUntil = now + LOCK_MS;
    fx.log("Pairing is locked for 15 minutes after three wrong codes.");
    for (const o of tickets.values()) failTicket(o, "Pairing locked after three wrong codes.");
  }
  function finishTicket(t: Ticket) {
    clearTimeout(t.timer);
    const l = t.line;
    t.line = undefined;
    l?.ws.close(1000);
    // Kept a minute for the screens that show how it ended, then gone.
    setTimeout(() => (tickets.delete(b64u(t.tid)), settle()), 60_000);
    settle();
  }

  async function openTicket(by: Ticket["by"]) {
    if (Date.now() < lockedUntil) throw new Error(`Pairing is locked after three wrong codes, until ${new Date(lockedUntil).toLocaleTimeString()}.`);
    if (!config.on) throw new Error("Turn on remote access first.");
    if ([...tickets.values()].filter((t) => ["open", "pairing", "compare"].includes(t.state)).length >= 3) throw new Error("Three pairings are open already. Finish or cancel one.");
    // Eight digits, uniform: a draw over 4,000,000,000 is drawn again.
    let n = 0;
    do n = new DataView(random(4).buffer).getUint32(0);
    while (n >= 4_000_000_000);
    const t: Ticket = { tid: random(16), S: random(32), digits: String(n % 100_000_000).padStart(8, "0"), expires: Date.now() + TICKET_MS, by, state: "open", timer: setTimeout(() => {}, 0) };
    t.timer = setTimeout(() => t.state === "open" && ((t.state = "expired"), (t.why = "The code expired."), finishTicket(t)), TICKET_MS);
    tickets.set(b64u(t.tid), t);
    settle();
    // A new pairing doesn't wait out a backoff: the owner is watching.
    if (!listener) {
      clearTimeout(retryTimer);
      retry = 1000;
      void connectListener();
    }
    await claimPlate(t);
    return view(t);
  }
  // A nameplate for the code: a socket of its own, held while the ticket is open. When the relay drops it, the code
  // is gone with it, so an open ticket claims another, and the screen shows the new code.
  async function claimPlate(t: Ticket) {
    t.plate = undefined;
    await new Promise<void>((resolve) => {
      const l = line(`${config.relay}/plate`, () => {}, () => {
        resolve();
        if (t.line !== l) return;
        t.line = undefined;
        t.plate = undefined;
        if (t.state === "open") setTimeout(() => t.state === "open" && !t.line && void claimPlate(t), 2000 + Math.random() * 3000);
      });
      l.ticket = t;
      t.line = l;
      const wait = setInterval(() => (l.plate !== undefined || l.ws.readyState > 1) && (clearInterval(wait), resolve()), 50);
      setTimeout(() => (clearInterval(wait), resolve()), 10_000);
    });
    t.plate = t.line?.plate;
  }
  const view = (t: Ticket) => {
    const shell = wire.shellOf(config.relay);
    return {
      tid: b64u(t.tid),
      state: t.state,
      why: t.why,
      code: t.plate !== undefined && t.state === "open" ? wire.codeOf(t.plate, t.digits) : null,
      link: t.state === "open" ? wire.pairLink(shell, { rid, tid: t.tid, I: keys.I.publicKey, S: t.S, relay: config.relay }) : null,
      expires: t.expires,
      sas: t.state === "compare" ? t.sas : undefined,
      device: t.pending && ["compare", "approved"].includes(t.state) ? { name: t.pending.name, platform: t.pending.platform } : undefined,
      by: t.by,
    };
  };
  async function decide(t: Ticket, ok: boolean) {
    if (t.state !== "compare" || !t.call || !t.pending) throw new Error("This pairing isn't waiting for approval.");
    const c = t.call;
    if (ok) {
      const p = t.pending;
      await fx.sql`insert into devices (id, name, platform, key, paired_by, how) values (${p.id}, ${p.name}, ${p.platform}, ${Buffer.from(p.key)}, ${t.by.name}, ${p.how})
        on conflict (key) do update set name = excluded.name, platform = excluded.platform, paired_at = now(), paired_by = excluded.paired_by, how = excluded.how, last_seq = 0`;
      deviceCount = (await devices()).length;
      t.state = "approved";
      await sealed(c, { approved: true });
      fx.log(`Paired ${p.name}${p.platform ? ` (${p.platform})` : ""}, approved by ${t.by.name}.`);
      tell({ event: "added", name: p.name, platform: p.platform });
    } else {
      t.state = "denied";
      t.why = "Not approved.";
      await sealed(c, { approved: false });
    }
    // A linger, so the device gets the answer before the call closes.
    end(c, 3000);
    finishTicket(t);
  }

  // K1 and K2: Noise IK from a paired device, then the WebRTC offer from fxbot, sealed, and the device's answer.
  async function connect(c: Call, bytes: Bytes) {
    if (!config.on) return stop(c, "off");
    const hs = await new Handshake({ pattern: "IK", initiator: false, prologue: wire.connectPrologue(rid), s: keys.I }).init();
    let hello: { seq?: unknown };
    try {
      hello = JSON.parse(dec.decode(await hs.read(bytes)));
    } catch {
      return stop(c, "failed");
    }
    const [device] = await fx.sql<Device[]>`select * from devices where key = ${Buffer.from(hs.rs!)}`;
    if (!device) return stop(c, "unknown");
    const seq = Number(hello.seq);
    // Each connect's seq is greater than the last, as WireGuard keeps each peer's greatest timestamp, so a K1 seen once
    // can't be replayed.
    if (!Number.isSafeInteger(seq) || seq <= Number(device.last_seq)) return stop(c, "replay");
    const moved = await fx.sql`update devices set last_seq = ${seq}, last_seen = now() where id = ${device.id} and last_seq < ${seq}`;
    if (!moved.count) return stop(c, "replay");
    // A device that connects again is done with its attempts that never connected: they'd only hold ports.
    for (const old of [...conns]) if (old.device === device.id && !old.connected) (old.pc.close(), conns.delete(old));
    if (conns.size >= 20) return stop(c, "busy");
    const servers = await iceServers(config.ice, fetch, fx.log);
    if (!reach || Date.now() - reachAt > SIX_HOURS) await checkNow().catch(() => null);
    // `reuse`: this fxbot takes one request after another on a channel, which the app then keeps (see bridge.ts).
    send(c, wire.envelope("k2", await hs.write(utf8(JSON.stringify({ iceServers: servers, reach, device: device.id, name, reuse: true })))));
    const { send: tx, recv: rx } = await hs.split();
    Object.assign(c, { tx, rx, hash: hs.hash, stage: "rtc" });
    // The ICE ports, so a forwarded or mapped port holds; any port when every one is taken, as the log says.
    const inRange = await freePort(config.ports);
    if (!inRange) fx.log(`Every ICE port, ${config.ports.join("–")}, is in use, so this connection uses another, which a forwarded port doesn't cover.`);
    const pc = new RTCPeerConnection({ iceServers: forWerift(servers), icePortRange: inRange ? config.ports : undefined, iceUseIpv6: globalV6(), iceInterfaceAddresses: hostAddresses() as any });
    c.pc = pc;
    const conn: Conn = { pc, device: device.id, ready: false, connected: false };
    c.conn = conn;
    pc.iceConnectionStateChange.subscribe((state) => state === "connected" && !conn.found && (conn.found = Date.now()));
    conns.add(conn);
    const hash = hs.hash;
    const waiting: RTCDataChannel[] = [];
    const started = Date.now();
    // The device gives up at 15 seconds; an attempt that never connects ends soon after.
    let dropTimer = setTimeout(() => {
      if (!conn.connected) fx.log(`${device.name} found no path to this fxbot in 20 seconds.`);
      pc.close();
    }, 20_000);
    let ended = false;
    pc.connectionStateChange.subscribe((state) => {
      if (state === "connected") {
        clearTimeout(dropTimer);
        end(c, 1000);
        const back = conn.connected;
        conn.connected = true;
        conn.route = routeOf(pc);
        if (back) fx.log(`${device.name}'s connection came back.`);
        else {
          conn.since = Date.now();
          const at = (t?: number) => (t ? ((t - started) / 1000).toFixed(1) : "?");
          fx.log(`${device.name} connected${conn.route ? ` ${conn.route}` : ""}, in ${at(Date.now())} seconds: its answer at ${at(conn.answered)}, a path at ${at(conn.found)}.`);
        }
      }
      if (state === "failed" || state === "closed") {
        clearTimeout(dropTimer);
        conns.delete(conn);
        end(c);
        if (state === "failed") pc.close();
        if (conn.since && !ended) fx.log(`${device.name} disconnected after ${lasted(Date.now() - conn.since)}${state === "failed" ? ": its path stopped answering" : ""}.`);
        ended = true;
      }
      if (state === "disconnected") {
        if (conn.connected) fx.log(`${device.name}'s connection went quiet; it has 30 seconds to come back.`);
        dropTimer = setTimeout(() => pc.close(), 30_000);
      }
    });
    // The control channel, which fxbot makes, so the browser answers and is the DTLS client: the order werift works
    // with on every browser. Each side's first message on it proves it's the end of this handshake.
    const control = pc.createDataChannel("control");
    conn.control = control;
    control.stateChanged.subscribe(async (state) => {
      if (state === "open") control.send(JSON.stringify({ check: await wire.channelCheck(hash, "fxbot") }));
    });
    const deviceCheck = await wire.channelCheck(hash, "device");
    control.onMessage.subscribe(async (m: string | Buffer) => {
      let msg: any;
      try {
        msg = JSON.parse(String(m));
      } catch {
        return;
      }
      if (!conn.ready) {
        if (msg?.check !== deviceCheck) return pc.close();
        conn.ready = true;
        for (const dc of waiting.splice(0)) serve(dc, { localUrl: fx.localUrl, device: device.id, log: fx.log });
        return;
      }
      const reply = (value: unknown) => control.readyState === "open" && control.send(JSON.stringify({ id: msg.id, ...(value as object) }));
      try {
        reply({ ok: await rpc(device.id, msg) });
      } catch (error) {
        reply({ error: error instanceof Error ? error.message : String(error) });
      }
    });
    pc.onDataChannel.subscribe((dc) => {
      if (dc.label === "control") return;
      if (conn.ready) serve(dc, { localUrl: fx.localUrl, device: device.id, log: fx.log });
      else waiting.push(dc);
    });
    await pc.setLocalDescription(await pc.createOffer());
    // The whole offer at once, with its candidates: gathering takes werift a moment with one STUN server.
    await Promise.race([
      new Promise<void>((r) => (pc.iceGatheringState === "complete" ? r() : pc.iceGatheringStateChange.subscribe((s) => s === "complete" && r()))),
      sleep(5000),
    ]);
    await sealed(c, { offer: pc.localDescription!.sdp });
  }

  // R1 and R2: a wiped device pairs again with a passkey added earlier, its assertion over the device's new key.
  async function byPasskey(c: Call, bytes: Bytes) {
    if (!config.on) return stop(c, "off");
    if (Date.now() < lockedUntil) return stop(c, "locked");
    c.stage = "done";
    const hs = await new Handshake({ pattern: "IK", initiator: false, prologue: wire.passkeyPrologue(rid), s: keys.I }).init();
    let p: any;
    try {
      p = JSON.parse(dec.decode(await hs.read(bytes)));
      const [key] = await fx.sql<Passkey[]>`select * from passkeys where id = ${String(p?.passkey?.id)}`;
      if (!key) throw new Error("No such passkey here: it was removed, or is for another fxbot.");
      await checkAssertion(p, hs.rs!, key, wire.shellOf(config.relay), nonces);
      await fx.sql`update passkeys set used_at = now() where id = ${key.id}`;
    } catch (error) {
      fx.log(`A passkey was refused: ${error instanceof Error ? error.message : error}`);
      countFailure();
      send(c, wire.failure("failed"));
      return end(c, 500);
    }
    const id = b64u(random(9));
    const deviceName = typeof p.name === "string" && p.name.trim() ? p.name.trim().slice(0, 64) : "A device";
    const platform = typeof p.platform === "string" ? p.platform.slice(0, 64) : "";
    await fx.sql`insert into devices (id, name, platform, key, paired_by, how) values (${id}, ${deviceName}, ${platform}, ${Buffer.from(hs.rs!)}, ${"a passkey"}, ${"passkey"})
      on conflict (key) do nothing`;
    deviceCount = (await devices()).length;
    send(c, wire.envelope("r2", await hs.write(utf8(JSON.stringify({ deviceId: id, name })))));
    end(c, 3000);
    fx.log(`Paired ${deviceName} by passkey.`);
    tell({ event: "added", name: deviceName, platform, how: "passkey" });
    settle();
  }

  // What a paired device's shell asks over its control channel: its fxbot's devices, and pairing another.
  async function rpc(from: string, m: any): Promise<unknown> {
    const [me] = await fx.sql<Device[]>`select * from devices where id = ${from}`;
    if (!me) throw new Error("This device was removed.");
    if (m.op === "ping") return true;
    if (m.op === "devices") return { name, rid, devices: (await devices()).map((d) => listed(d, from)), reach };
    if (m.op === "passkey-start") {
      const challenge = b64u(random(32));
      challenges.set(from, { challenge, at: Date.now() });
      return { challenge };
    }
    if (m.op === "passkey-add") {
      const pending = challenges.get(from);
      challenges.delete(from);
      if (!pending || Date.now() - pending.at > 5 * 60_000) throw new Error("That took too long. Try again.");
      await checkNew(m, pending.challenge, wire.shellOf(config.relay));
      await fx.sql`insert into passkeys (id, spki, alg, added_by) values (${String(m.id)}, ${Buffer.from(fromB64u(m.spki))}, ${Number(m.alg)}, ${me.name}) on conflict (id) do nothing`;
      passkeyCount = (await passkeys()).length;
      fx.log(`${me.name} added a passkey.`);
      return true;
    }
    if (m.op === "rename") return renameDevice(String(m.device), m.name);
    if (m.op === "remove") return removeDevice(String(m.device));
    if (m.op === "pair") return openTicket({ id: from, name: me.name });
    const t = tickets.get(String(m.tid));
    if (!t || t.by.id !== from) throw new Error("No such pairing from this device.");
    if (m.op === "ticket") return view(t);
    if (m.op === "approve") return (await decide(t, m.ok === true), view(t));
    if (m.op === "cancel") return (failTicket(t, "Cancelled."), view(t));
    throw new Error("Not something a device can ask.");
  }
  const listed = (d: Device, you: string | null) => ({ id: d.id, name: d.name, platform: d.platform, pairedAt: d.paired_at, pairedBy: d.paired_by, how: d.how, lastSeen: d.last_seen, you: d.id === you, connected: [...conns].some((c) => c.device === d.id && c.ready), route: [...conns].find((c) => c.device === d.id && c.ready)?.route ?? null });
  // Tells every connected device something, such as that a device was added.
  const tell = (event: unknown) => {
    for (const c of conns) if (c.ready && c.control?.readyState === "open") c.control.send(JSON.stringify(event));
  };
  async function renameDevice(id: string, to: unknown) {
    if (typeof to !== "string" || !to.trim() || to.length > 64) throw new Error("A name is 1 to 64 characters.");
    await fx.sql`update devices set name = ${to.trim()} where id = ${id}`;
    tell({ event: "devices" });
    return true;
  }
  async function removeDevice(id: string) {
    const [gone] = await fx.sql<Device[]>`delete from devices where id = ${id} returning *`;
    if (!gone) throw new Error("No such device.");
    deviceCount = (await devices()).length;
    fx.log(`Removed ${gone.name}.`);
    tell({ event: "devices" });
    // Its connections close at once, and it can't connect again.
    for (const c of [...conns]) if (c.device === id) (c.control?.readyState === "open" && c.control.send(JSON.stringify({ event: "removed" })), setTimeout(() => c.pc.close(), 200));
    settle();
    return true;
  }

  // --- The tab's routes, for fxbot's own page on the machine or the tailnet. A request through the bridge is refused,
  // so code in a device's frame can't pair a device of its own: the web app's own screens do that.
  const local = (handler: (req: Request, params: Record<string, string>) => Promise<unknown>) => async (req: Request, params: Record<string, string>) => {
    if (req.headers.has(bridged)) return refused("Devices are managed from the web app's own Devices screen, not from fxbot's page inside it.", 403);
    try {
      const out = await handler(req, params);
      return out instanceof Response ? out : Response.json(out ?? { ok: true });
    } catch (error) {
      return refused(error instanceof Error ? error.message : String(error));
    }
  };
  const body = async (req: Request) => (await req.json().catch(() => ({}))) as Record<string, any>;
  fx.route("GET", "/state", local(async () => {
    if (Date.now() - reachAt > 60_000) void checkNow().catch(() => {});
    return {
      on: config.on,
      relay: config.relay,
      defaultRelay: wire.defaultRelay,
      shell: wire.shellOf(config.relay),
      rid,
      name,
      listening: Boolean(listener && listener.ws.readyState === WebSocket.OPEN),
      devices: (await devices()).map((d) => listed(d, null)),
      tickets: [...tickets.values()].filter((t) => t.by.id === null).map(view),
      ice: config.ice.map(shown),
      ports: config.ports,
      mapping: config.mapping,
      mapped: mapper.state,
      reach,
      reachAt: reachAt || null,
      locked: lockedUntil > Date.now() ? lockedUntil : null,
      passkeys: (await passkeys()).map((k) => ({ id: k.id, addedBy: k.added_by, addedAt: k.added_at, usedAt: k.used_at })),
    };
  }));
  fx.route("POST", "/reach", local(async () => checkNow()));
  fx.route("POST", "/config", local(async (req) => {
    const b = await body(req);
    const next: Partial<Config> = {};
    if (typeof b.on === "boolean") next.on = b.on;
    if (typeof b.mapping === "boolean") next.mapping = b.mapping;
    if (b.relay !== undefined) {
      const relay = String(b.relay).trim().replace(/\/+$/, "") || wire.defaultRelay;
      if (!/^wss?:\/\/[^/\s]+\/signal$/.test(relay)) throw new Error("A relay's address looks like wss://web.example.com/signal.");
      next.relay = relay;
    }
    if (b.ports !== undefined) {
      const [a, z] = Array.isArray(b.ports) ? b.ports.map(Number) : [];
      if (!Number.isInteger(a) || !Number.isInteger(z) || a < 1024 || z > 65535 || z <= a || z - a > 100) throw new Error("The ICE ports are a range of 2 to 100 ports, from 1024 up.");
      next.ports = [a, z];
    }
    const relayChanged = next.relay && next.relay !== config.relay;
    await saveConfig(next);
    if (relayChanged || next.on !== undefined) {
      // The listener starts again on the new relay, or stops; connections close when access goes off.
      wanted = false;
      listener?.ws.close(1000);
      listener = null;
      if (next.on === false) for (const c of conns) c.pc.close();
    }
    if (next.mapping !== undefined || next.ports) (wanted && config.mapping ? void mapper.start(config.ports, fx.log) : void mapper.stop());
    settle();
    return { ok: true };
  }));
  fx.route("POST", "/ice", local(async (req) => {
    const entry = checkEntry(await body(req));
    await saveConfig({ ice: [...config.ice, entry] });
    void checkNow().catch(() => {});
    return shown(entry);
  }));
  fx.route("POST", "/ice/:id/move", local(async (req, { id }) => {
    const by = (await body(req)).by === -1 ? -1 : 1;
    const list = [...config.ice];
    const at = list.findIndex((e) => e.id === id);
    if (at < 0) throw new Error("No such server.");
    const to = at + by;
    if (to < 0 || to >= list.length) return { ok: true };
    [list[at], list[to]] = [list[to], list[at]];
    await saveConfig({ ice: list });
    return { ok: true };
  }));
  fx.route("DELETE", "/ice/:id", local(async (_req, { id }) => {
    await saveConfig({ ice: config.ice.filter((e) => e.id !== id) });
    void checkNow().catch(() => {});
    return { ok: true };
  }));
  fx.route("POST", "/ice/cloudflare", local(async () => {
    if (!config.ice.some((e) => e.id === cloudflareStun.id)) await saveConfig({ ice: [...config.ice, cloudflareStun] });
    return { ok: true };
  }));
  fx.route("POST", "/pair", local(async () => openTicket({ id: null, name: "this fxbot's Settings" })));
  fx.route("GET", "/pair/:tid", local(async (_req, { tid }) => {
    const t = tickets.get(tid);
    if (!t || t.by.id !== null) throw new Error("No such pairing.");
    return view(t);
  }));
  fx.route("POST", "/pair/:tid", local(async (req, { tid }) => {
    const t = tickets.get(tid);
    if (!t || t.by.id !== null) throw new Error("No such pairing.");
    const b = await body(req);
    if (b.cancel) failTicket(t, "Cancelled.");
    else await decide(t, b.ok === true);
    return view(t);
  }));
  fx.route("PATCH", "/devices/:id", local(async (req, { id }) => renameDevice(id, (await body(req)).name)));
  fx.route("DELETE", "/devices/:id", local(async (_req, { id }) => removeDevice(id)));
  fx.route("DELETE", "/passkeys/:id", local(async (_req, { id }) => {
    await fx.sql`delete from passkeys where id = ${id}`;
    passkeyCount = (await passkeys()).length;
    settle();
    return { ok: true };
  }));

  settle();
}
