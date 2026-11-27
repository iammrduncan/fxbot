// A phone line that carries the call's own audio (docs/_completed/phases/phone-v2.md, part 2): phone is a softphone on the
// carrier's SIP account. It connects out over TLS, registers, and calls the owner's number with SRTP, so nothing on the
// internet connects in. The call's audio goes through phone's voice loop, as an app call's does: the same listener, the
// same voice, the same rules. A carrier plugin, such as phone-signalwire, only gives the account.
//
// SIP over TLS (RFC 3261) with digest auth (RFC 2617), SDES-SRTP AES_CM_128_HMAC_SHA1_80 (RFC 3711), PCMU in 20 ms frames
// sent without a gap, and the RTP address from STUN (RFC 5389), as the proof on the owner's network ran it.
import crypto from "node:crypto";
import dgram from "node:dgram";
import tls from "node:tls";
import type { Outcome } from "./line.ts";
import type { Transport } from "./voice.ts";

/** A carrier's SIP account: its domain, a user and password, and the number calls come from. */
export type Account = { domain: string; username: string; password: string; from: string };

const rand = (n: number) => crypto.randomBytes(n).toString("hex");

// ---- μ-law (G.711 PCMU), and 8 kHz to 16 kHz and back ----
function ulaw(sample: number) {
  const sign = sample < 0 ? 0x80 : 0;
  const s = Math.min(Math.abs(sample), 32635) + 0x84;
  let exponent = 7;
  for (let mask = 0x4000; (s & mask) === 0 && exponent > 0; exponent--, mask >>= 1);
  return ~(sign | (exponent << 4) | ((s >> (exponent + 3)) & 0x0f)) & 0xff;
}
function linear(u: number) {
  u = ~u & 0xff;
  const s = ((((u & 0x0f) << 3) + 0x84) << ((u >> 4) & 7)) - 0x84;
  return u & 0x80 ? -s : s;
}
const silence = Buffer.alloc(160, 0xff);
// 16 kHz to 8 kHz: a 31-tap low-pass at 3.6 kHz (a Hamming-windowed sinc), then every other sample, so what's over 4 kHz
// doesn't fold back into the voice as hiss, as averaging each pair let it.
const taps = (() => {
  const n = 31;
  const fc = 3600 / 16000;
  const h = Array.from({ length: n }, (_, i) => {
    const m = i - (n - 1) / 2;
    const sinc = m === 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * m) / (Math.PI * m);
    return sinc * (0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (n - 1)));
  });
  const sum = h.reduce((a, b) => a + b, 0);
  return h.map((x) => x / sum);
})();
function halver() {
  const held = new Float64Array(taps.length);
  let at = 0;
  let odd = false;
  return (pcm: Int16Array, out: number[]) => {
    for (const sample of pcm) {
      held[at] = sample;
      at = (at + 1) % taps.length;
      if ((odd = !odd)) continue;
      let sum = 0;
      for (let k = 0; k < taps.length; k++) sum += taps[k] * held[(at + k) % taps.length];
      out.push(Math.max(-32768, Math.min(32767, Math.round(sum))));
    }
  };
}

// ---- SRTP, AES_CM_128_HMAC_SHA1_80 ----
const keystream = (key: Buffer, iv: Buffer, n: number) => crypto.createCipheriv("aes-128-ctr", key, iv).update(Buffer.alloc(n));
function derive(masterKey: Buffer, masterSalt: Buffer) {
  const prf = (label: number, n: number) => {
    const x = Buffer.from(masterSalt);
    x[7] ^= label;
    return keystream(masterKey, Buffer.concat([x, Buffer.alloc(2)]), n);
  };
  return { key: prf(0, 16), auth: prf(1, 20), salt: prf(2, 14) };
}
const headerLength = (p: Buffer) => {
  let n = 12 + 4 * (p[0] & 0x0f);
  if (p[0] & 0x10) n += 4 + 4 * p.readUInt16BE(n + 2);
  return n;
};
function srtp(keyAndSalt: Buffer) {
  const k = derive(keyAndSalt.subarray(0, 16), keyAndSalt.subarray(16, 30));
  let roc = 0;
  let last = -1;
  const iv = (ssrc: number, index: number) => {
    const v = Buffer.alloc(16);
    k.salt.copy(v, 0);
    for (let i = 0; i < 4; i++) v[7 - i] ^= (ssrc >>> (8 * i)) & 0xff;
    for (let i = 0; i < 6; i++) v[13 - i] ^= Number((BigInt(index) >> BigInt(8 * i)) & 0xffn);
    return v;
  };
  const crypt = (packet: Buffer, index: number) => {
    const h = headerLength(packet);
    const out = Buffer.from(packet);
    const ks = keystream(k.key, iv(packet.readUInt32BE(8), index), out.length - h);
    for (let i = h; i < out.length; i++) out[i] ^= ks[i - h];
    return out;
  };
  const tag = (data: Buffer, r: number) => {
    const b = Buffer.alloc(4);
    b.writeUInt32BE(r >>> 0);
    return crypto.createHmac("sha1", k.auth).update(data).update(b).digest().subarray(0, 10);
  };
  return {
    // Ours: the sender keeps its own rollover counter.
    protect(rtp: Buffer) {
      const seq = rtp.readUInt16BE(2);
      if (last === 65535 && seq === 0) roc++;
      last = seq;
      const enc = crypt(rtp, roc * 65536 + seq);
      return Buffer.concat([enc, tag(enc, roc)]);
    },
    // Theirs: the index guessed as RFC 3711 3.3.1 says, kept only once the tag checks.
    unprotect(packet: Buffer) {
      if (packet.length < 22) return null;
      const body = packet.subarray(0, packet.length - 10);
      const seq = body.readUInt16BE(2);
      let v = roc;
      if (last >= 0) v = last < 32768 ? (seq - last > 32768 ? roc - 1 : roc) : last - 32768 > seq ? roc + 1 : roc;
      if (v < 0 || !crypto.timingSafeEqual(tag(body, v), packet.subarray(packet.length - 10))) return null;
      if (last < 0 || v > roc || (v === roc && seq > last)) ((roc = v), (last = seq));
      return crypt(body, v * 65536 + seq);
    },
  };
}

// ---- STUN binding, for the address the carrier sends audio to ----
const COOKIE = 0x2112a442;
function stun(socket: dgram.Socket, host = "stun.cloudflare.com", port = 3478): Promise<{ address: string; port: number }> {
  const request = Buffer.alloc(20);
  request.writeUInt16BE(0x0001, 0);
  request.writeUInt32BE(COOKIE, 4);
  crypto.randomBytes(12).copy(request, 8);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => (socket.off("message", on), reject(new Error(`no STUN answer from ${host}`))), 4000);
    const on = (m: Buffer) => {
      if (m.length < 20 || m.readUInt16BE(0) !== 0x0101 || m.readUInt32BE(4) !== COOKIE || !m.subarray(8, 20).equals(request.subarray(8, 20))) return;
      for (let at = 20; at + 4 <= m.length; ) {
        const type = m.readUInt16BE(at);
        const len = m.readUInt16BE(at + 2);
        if ((type === 0x0020 || type === 0x0001) && m[at + 5] === 0x01) {
          const xor = type === 0x0020;
          const mapped = { address: [0, 1, 2, 3].map((i) => m[at + 8 + i] ^ (xor ? (COOKIE >>> (24 - 8 * i)) & 0xff : 0)).join("."), port: m.readUInt16BE(at + 6) ^ (xor ? COOKIE >>> 16 : 0) };
          return void (clearTimeout(timer), socket.off("message", on), resolve(mapped));
        }
        at += 4 + len + ((4 - (len % 4)) % 4);
      }
    };
    socket.on("message", on);
    // A name that doesn't resolve, offline or with no DNS, fails here, not on the socket.
    socket.send(request, port, host, (error) => error && (clearTimeout(timer), socket.off("message", on), reject(error)));
  });
}

// ---- SIP over TLS ----
const md5 = (s: string) => crypto.createHash("md5").update(s).digest("hex");
const fieldsOf = (challenge: string) => Object.fromEntries([...challenge.matchAll(/(\w+)=(?:"([^"]*)"|([^,\s]+))/g)].map((m) => [m[1].toLowerCase(), m[2] ?? m[3]]));
// Of the challenges a server offers, MD5's (RFC 2617), or else SHA-256's (RFC 8760).
const algorithmOf = (challenge: string) => (fieldsOf(challenge).algorithm ?? "MD5").toUpperCase();
const pick = (challenges: string[]) => challenges.find((c) => algorithmOf(c) === "MD5") ?? challenges.find((c) => algorithmOf(c) === "SHA-256") ?? challenges[0] ?? "";
function digest(o: { user: string; password: string; method: string; uri: string; challenge: string }) {
  const p = fieldsOf(o.challenge);
  const algorithm = algorithmOf(o.challenge) === "SHA-256" ? "SHA-256" : "MD5";
  const hash = (s: string) => crypto.createHash(algorithm === "SHA-256" ? "sha256" : "md5").update(s).digest("hex");
  const qop = p.qop?.split(",").map((q) => q.trim()).includes("auth") ? "auth" : null;
  const cnonce = rand(8);
  const nc = "00000001";
  const ha1 = hash(`${o.user}:${p.realm}:${o.password}`);
  const ha2 = hash(`${o.method}:${o.uri}`);
  const response = qop ? hash(`${ha1}:${p.nonce}:${nc}:${cnonce}:${qop}:${ha2}`) : hash(`${ha1}:${p.nonce}:${ha2}`);
  return [`Digest username="${o.user}"`, `realm="${p.realm}"`, `nonce="${p.nonce}"`, `uri="${o.uri}"`, `response="${response}"`, `algorithm=${algorithm}`, ...(p.opaque ? [`opaque="${p.opaque}"`] : []), ...(qop ? [`qop=${qop}`, `nc=${nc}`, `cnonce="${cnonce}"`] : [])].join(", ");
}
// What a server asked for, for an error: its realm, algorithms, and qop, never a secret.
const asked = (challenges: string[]) => challenges.map((c) => { const f = fieldsOf(c); return `realm ${f.realm ?? "none"}, ${algorithmOf(c)}${f.qop ? `, qop ${f.qop}` : ""}`; }).join("; ");
type Message = { first: string; status: number; method: string | null; headers: Record<string, string[]>; h(name: string): string; body: string };
function parse(text: string): Message {
  const [head, ...rest] = text.split("\r\n\r\n");
  const lines = head.split("\r\n");
  const headers: Record<string, string[]> = {};
  for (const line of lines.slice(1)) {
    const i = line.indexOf(":");
    (headers[line.slice(0, i).trim().toLowerCase()] ??= []).push(line.slice(i + 1).trim());
  }
  const status = /^SIP\/2\.0 (\d{3})/.exec(lines[0]);
  return { first: lines[0], status: status ? Number(status[1]) : 0, method: status ? null : lines[0].split(" ")[0], headers, h: (n) => headers[n]?.[0] ?? "", body: rest.join("\r\n\r\n") };
}
function connection(host: string) {
  let buffer = "";
  const waiting = new Map<string, { provisional?: (m: Message) => void; resolve: (m: Message) => void; reject: (error: Error) => void }>();
  let onRequest: (m: Message) => void = () => {};
  const socket = tls.connect({ host, port: 5061, servername: host });
  socket.setEncoding("utf8");
  socket.on("data", (data: string) => {
    buffer += data;
    for (;;) {
      buffer = buffer.replace(/^(\r\n)+/, "");
      const end = buffer.indexOf("\r\n\r\n");
      if (end < 0) return;
      const head = buffer.slice(0, end + 2);
      const length = Number(/\r\n(?:content-length|l):\s*(\d+)/i.exec(head)?.[1] ?? 0);
      if (buffer.length < end + 4 + length) return;
      const m = parse(buffer.slice(0, end + 4 + length));
      buffer = buffer.slice(end + 4 + length);
      if (!m.status) onRequest(m);
      else {
        const key = `${m.h("call-id")} ${m.h("cseq")}`;
        const w = waiting.get(key);
        if (w && m.status < 200) w.provisional?.(m);
        else if (w) (waiting.delete(key), w.resolve(m));
      }
    }
  });
  // A port the network drops never answers: after 10 seconds, the call says so.
  const ready = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => (socket.destroy(), reject(new Error(`${host} didn't answer on port 5061 in 10 seconds: this machine's network may block outbound SIP`))), 10_000);
    socket.once("secureConnect", () => (clearTimeout(timer), socket.authorized ? resolve() : reject(new Error(`${host}'s certificate didn't verify: ${socket.authorizationError}`))));
    socket.once("error", (error) => (clearTimeout(timer), reject(error)));
  });
  socket.on("error", () => {});
  // A request still waiting when the line closes, as when a call is ended while it signs in, fails at once.
  socket.on("close", () => {
    for (const [key, w] of waiting) (waiting.delete(key), w.reject(new Error("the line to the carrier closed")));
  });
  const send = (text: string) => void (!socket.destroyed && socket.write(text));
  return {
    socket,
    ready,
    send,
    get local() {
      return `${socket.localAddress}:${socket.localPort}`;
    },
    set onRequest(f: (m: Message) => void) {
      onRequest = f;
    },
    request(lines: string[], body = "", provisional?: (m: Message) => void, ms = 32_000): Promise<Message> {
      const text = lines.join("\n");
      const key = `${/^Call-ID: (.*)$/m.exec(text)![1]} ${/^CSeq: (.*)$/m.exec(text)![1]}`;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => (waiting.delete(key), reject(new Error(`no answer to ${lines[0]}`))), ms);
        waiting.set(key, { provisional, resolve: (m) => (clearTimeout(timer), resolve(m)), reject: (error) => (clearTimeout(timer), reject(error)) });
        send([...lines, `Content-Length: ${Buffer.byteLength(body)}`, "", body].join("\r\n"));
      });
    },
    reply(m: Message, status: string, extra: string[] = [], body = "") {
      const keep = ["via", "from", "to", "call-id", "cseq"].flatMap((n) => (m.headers[n] ?? []).map((v) => `${n === "call-id" ? "Call-ID" : n === "cseq" ? "CSeq" : n[0].toUpperCase() + n.slice(1)}: ${v}`));
      send([`SIP/2.0 ${status}`, ...keep, ...extra, `Content-Length: ${Buffer.byteLength(body)}`, "", body].join("\r\n"));
    },
  };
}

// Signing in to the account: REGISTER, and again with the digest the server asks for.
function registrar(sip: ReturnType<typeof connection>, account: Account) {
  const { domain, username: user, password } = account;
  const call = `${rand(10)}@fxbot`;
  const tag = rand(6);
  let seq = 0;
  const contact = () => `<sip:${user}@${sip.local};transport=tls;ob>`;
  return {
    contact,
    async register(expires: number) {
      const lines = (auth?: string) => [
        `REGISTER sip:${domain} SIP/2.0`,
        `Via: SIP/2.0/TLS ${sip.local};branch=z9hG4bK${rand(8)};rport`,
        "Max-Forwards: 70",
        `From: <sip:${user}@${domain}>;tag=${tag}`,
        `To: <sip:${user}@${domain}>`,
        `Call-ID: ${call}`,
        `CSeq: ${++seq} REGISTER`,
        `Contact: ${contact()}`,
        `Expires: ${expires}`,
        "User-Agent: fxbot",
        ...(auth ? [`Authorization: ${auth}`] : []),
      ];
      let res = await sip.request(lines());
      let challenges: string[] = [];
      if (res.status === 401) {
        challenges = res.headers["www-authenticate"] ?? [];
        res = await sip.request(lines(digest({ user, password, method: "REGISTER", uri: `sip:${domain}`, challenge: pick(challenges) })));
      }
      if (res.status !== 200) throw new Error(`${domain} refused the sign-in as ${user}: ${res.first}${challenges.length ? ` (it asked for ${asked(challenges)})` : ""}`);
    },
  };
}

/** Signs in to the account and out again, placing no call: whether the carrier takes it. */
export async function checkSignIn(account: Account) {
  const sip = connection(account.domain);
  try {
    await sip.ready;
    const r = registrar(sip, account);
    await r.register(60);
    await r.register(0);
  } finally {
    sip.socket.end();
  }
}

// What a final answer to the call means.
const outcomeOf = (status: number): Outcome => (status === 486 || status === 600 ? "busy" : status === 603 ? "declined" : [408, 480, 487].includes(status) ? "missed" : "failed");

/**
 * One call on a carrier's SIP account. `transport` is what phone's voice loop speaks into, and `heard` gets the owner's
 * audio as 16 kHz PCM16 in 20 ms frames, and `played` each mark once the audio before it went out. `ended` says when
 * the carrier ended it.
 */
export function sipCall(o: {
  account: () => Promise<Account>;
  log(line: string): void;
  heard(pcm: Int16Array): void;
  played(mark: number): void;
  ended(how: string): void;
}) {
  type Queued = Buffer | number;
  const queue: Queued[] = [];
  let over = false;
  let teardown: () => Promise<void> = async () => {};
  // 16 kHz in: halved to 8 kHz, then μ-law, in 20 ms frames.
  let carry: number[] = [];
  const halve = halver();
  const transport: Transport = {
    audio(pcm) {
      if (over) return;
      const half: number[] = [];
      halve(pcm, half);
      const samples = [...carry, ...half.map(ulaw)];
      let i = 0;
      for (; i + 160 <= samples.length; i += 160) queue.push(Buffer.from(samples.slice(i, i + 160)));
      carry = samples.slice(i);
    },
    // A mark goes once the audio queued before it has gone out.
    send(message) {
      const mark = (message as { mark?: number }).mark;
      if (typeof mark === "number" && !over) {
        if (carry.length) queue.push(Buffer.concat([Buffer.from(carry), silence]).subarray(0, 160)), (carry = []);
        queue.push(mark);
      }
    },
    clear() {
      queue.length = 0;
      carry = [];
    },
    close() {
      void hangUp();
    },
  };
  async function hangUp() {
    if (over) return;
    over = true;
    queue.length = 0;
    await teardown().catch((error) => o.log(`Ending the SIP call failed: ${error.message}`));
  }

  async function dial(to: string, ringSeconds = 45): Promise<{ outcome: Outcome; error?: string }> {
    const account = await o.account();
    const { domain, username: user, password } = account;
    const rtp = dgram.createSocket("udp4");
    // An error on the call's audio, such as a send that fails, is logged: unheard, it would end fxbot.
    rtp.on("error", (error) => o.log(`The SIP call's audio failed: ${error.message}`));
    const closeRtp = () => {
      try {
        rtp.close();
      } catch {}
    };
    await new Promise<void>((resolve) => rtp.bind(0, resolve));
    const mapped = await stun(rtp).catch((error) => (o.log(`STUN didn't answer, so the call gives this machine's own address: ${error.message}`), null));
    if (over) return (closeRtp(), { outcome: "failed", error: "The call was ended before it rang." });
    const sip = connection(domain);
    let registered = false;
    let timers: NodeJS.Timeout[] = [];
    let bye: (() => Promise<void>) | null = null;
    // While the owner's phone rings, ending the call sends a CANCEL, and the call's answer to it ends the rest.
    let ringing: (() => void) | null = null;
    const signIn = registrar(sip, account);
    const contact = signIn.contact;
    const register = async (expires: number) => {
      await signIn.register(expires);
      registered = expires > 0;
    };
    teardown = async () => {
      if (ringing) return ringing();
      timers.forEach((t) => clearInterval(t));
      timers = [];
      // What went out last plays on the phone before the call ends.
      if (bye) await new Promise((resolve) => setTimeout(resolve, 500)).then(() => bye?.()).catch(() => {});
      if (registered) await register(0).catch(() => {});
      sip.socket.end();
      closeRtp();
    };
    try {
      await sip.ready;
      await register(120);
      timers.push(setInterval(() => sip.send("\r\n\r\n"), 25_000));
      timers.push(setInterval(() => void register(120).catch((error) => o.log(`Signing in again failed: ${error.message}`)), 60_000));
      // Ended while it signed in: signed out again, and nothing left open.
      if (over) return (await teardown(), { outcome: "failed", error: "The call was ended before it rang." });

      // The call, with our key in the offer, and the carrier's in its answer.
      const ourKey = crypto.randomBytes(30);
      const send = srtp(ourKey);
      const address = mapped ?? { address: sip.socket.localAddress ?? "0.0.0.0", port: rtp.address().port };
      const sdp = [
        "v=0",
        `o=fxbot ${Date.now()} 1 IN IP4 ${address.address}`,
        "s=fxbot",
        `c=IN IP4 ${address.address}`,
        "t=0 0",
        `m=audio ${address.port} RTP/SAVP 0 101`,
        "a=rtpmap:0 PCMU/8000",
        "a=rtpmap:101 telephone-event/8000",
        "a=fmtp:101 0-15",
        "a=ptime:20",
        "a=sendrecv",
        "a=rtcp-mux",
        `a=crypto:1 AES_CM_128_HMAC_SHA1_80 inline:${ourKey.toString("base64")}`,
        "",
      ].join("\r\n");
      const callId = `${rand(10)}@fxbot`;
      const tag = rand(6);
      const target = `sip:${to}@${domain}`;
      let cseq = 0;
      let branch = "";
      const invite = (auth?: string, header = "Proxy-Authorization") => (
        (branch = `z9hG4bK${rand(8)}`),
        [
          `INVITE ${target} SIP/2.0`,
          `Via: SIP/2.0/TLS ${sip.local};branch=${branch};rport`,
          "Max-Forwards: 70",
          `From: "fxbot" <sip:${user}@${domain}>;tag=${tag}`,
          `To: <${target}>`,
          `Call-ID: ${callId}`,
          `CSeq: ${++cseq} INVITE`,
          `Contact: ${contact()}`,
          "Allow: INVITE, ACK, BYE, CANCEL, OPTIONS, NOTIFY",
          "Content-Type: application/sdp",
          "User-Agent: fxbot",
          ...(auth ? [`${header}: ${auth}`] : []),
        ]
      );
      const ack = (res: Message, uri = target, routes: string[] = []) =>
        sip.send(
          [
            `ACK ${uri} SIP/2.0`,
            `Via: SIP/2.0/TLS ${sip.local};branch=${res.status >= 300 ? branch : `z9hG4bK${rand(8)}`};rport`,
            "Max-Forwards: 70",
            `From: "fxbot" <sip:${user}@${domain}>;tag=${tag}`,
            `To: ${res.h("to")}`,
            `Call-ID: ${callId}`,
            `CSeq: ${cseq} ACK`,
            ...routes.map((r) => `Route: ${r}`),
            "Content-Length: 0",
            "",
            "",
          ].join("\r\n"),
        );
      let remote: { address: string; port: number } | null = null;
      let receive: ReturnType<typeof srtp> | null = null;
      const answer = (m: Message) => {
        if (!m.body.includes("m=audio")) return;
        const theirs = /^a=crypto:\d+ AES_CM_128_HMAC_SHA1_80 inline:([A-Za-z0-9+/=]+)/m.exec(m.body)?.[1];
        remote = { address: /^c=IN IP4 (\S+)/m.exec(m.body)?.[1] ?? "", port: Number(/^m=audio (\d+)/m.exec(m.body)?.[1]) };
        if (theirs && !receive) receive = srtp(Buffer.from(theirs, "base64"));
      };
      // Rings until it's answered, or for ringSeconds, or until the call is ended, then the call is cancelled.
      const stopRinging = () =>
        sip.send(
          [`CANCEL ${target} SIP/2.0`, `Via: SIP/2.0/TLS ${sip.local};branch=${branch};rport`, "Max-Forwards: 70", `From: "fxbot" <sip:${user}@${domain}>;tag=${tag}`, `To: <${target}>`, `Call-ID: ${callId}`, `CSeq: ${cseq} CANCEL`, "Content-Length: 0", "", ""].join("\r\n"),
        );
      const cancel = setTimeout(stopRinging, ringSeconds * 1000);
      ringing = () => (clearTimeout(cancel), stopRinging());
      let res = await sip.request(invite(), sdp, answer, (ringSeconds + 20) * 1000);
      if ((res.status === 401 || res.status === 407) && !over) {
        ack(res);
        const challenge = pick(res.headers[res.status === 407 ? "proxy-authenticate" : "www-authenticate"] ?? []);
        res = await sip.request(invite(digest({ user, password, method: "INVITE", uri: target, challenge }), res.status === 401 ? "Authorization" : "Proxy-Authorization"), sdp, answer, (ringSeconds + 20) * 1000);
      }
      ringing = null;
      clearTimeout(cancel);
      if (res.status >= 300) {
        ack(res);
        await teardown();
        return { outcome: outcomeOf(res.status), ...(outcomeOf(res.status) === "failed" ? { error: `The call didn't go through: ${res.first}` } : {}) };
      }
      answer(res);
      const remoteTarget = /<([^>]+)>/.exec(res.h("contact"))?.[1] ?? target;
      const routes = (res.headers["record-route"] ?? []).flatMap((r) => r.split(/,(?=\s*<)/).map((x) => x.trim())).reverse();
      ack(res, remoteTarget, routes);
      bye = async () => {
        bye = null;
        await sip.request([`BYE ${remoteTarget} SIP/2.0`, `Via: SIP/2.0/TLS ${sip.local};branch=z9hG4bK${rand(8)};rport`, "Max-Forwards: 70", `From: "fxbot" <sip:${user}@${domain}>;tag=${tag}`, `To: ${res.h("to")}`, `Call-ID: ${callId}`, `CSeq: ${++cseq} BYE`, ...routes.map((r) => `Route: ${r}`)], "", undefined, 5000);
      };
      // Answered just as the call was ended: it hangs up at once.
      if (over) return (await teardown(), { outcome: "failed", error: "The call was ended as it was answered." });
      const theirsEnded = (how: string) => {
        if (over) return;
        bye = null;
        over = true;
        void teardown();
        o.ended(how);
      };
      sip.onRequest = (m) => {
        if (m.method === "BYE") return void (sip.reply(m, "200 OK"), o.log(`The owner's phone ended the call${m.h("reason") ? `, saying ${m.h("reason")}` : ""}.`), theirsEnded("hung up"));
        if (m.method === "INVITE") return void (sip.reply(m, "200 OK", [`Contact: ${contact()}`, "Content-Type: application/sdp"], sdp), answer(m));
        if (m.method !== "ACK") sip.reply(m, "200 OK");
      };
      sip.socket.on("close", () => theirsEnded("the line to the carrier closed"));

      // What the line did, for the log: when it's answered, and when it ends.
      const stats = { out: 0, in: 0, bad: 0, other: 0, from: new Set<string>(), firstMs: 0, late: 0, worst: 0 };
      const answeredAt = Date.now();
      const media = remote as { address: string; port: number } | null;
      o.log(`The SIP call is answered: their audio at ${media ? `${media.address}:${media.port}` : "no address"}, ${receive ? "with" : "without"} an SRTP key, formats ${/^m=audio \d+ \S+ ([\d ]+)/m.exec(res.body)?.[1] ?? "none"}; ours at ${address.address}:${address.port}.`);
      const report = teardown;
      teardown = async () => {
        o.log(`The SIP call's audio: ${stats.out} frames out, ${stats.late} of them sent over 40 ms late (the worst ${Math.round(stats.worst)} ms); ${stats.in} in${stats.firstMs ? `, the first ${stats.firstMs} ms after the answer` : ""}, ${stats.bad} not decrypted, ${stats.other} of other kinds, from ${[...stats.from].join(", ") || "nowhere"}.`);
        await report();
      };
      // The owner's audio: SRTP in, μ-law to 16 kHz PCM16.
      let heldLast = 0;
      rtp.on("message", (m, from) => {
        if (over || m.length < 12 || (m[0] & 0xc0) !== 0x80) return;
        stats.from.add(`${from.address}:${from.port}`);
        const pt = m[1] & 0x7f;
        if (pt !== 0) return void stats.other++;
        const plain = receive?.unprotect(m);
        if (!plain) return void stats.bad++;
        if (!stats.in++) stats.firstMs = Date.now() - answeredAt;
        const payload = plain.subarray(headerLength(plain));
        const pcm = new Int16Array(payload.length * 2);
        for (let i = 0; i < payload.length; i++) {
          const s = linear(payload[i]);
          pcm[2 * i] = (heldLast + s) >> 1;
          pcm[2 * i + 1] = s;
          heldLast = s;
        }
        o.heard(pcm);
      });
      // The bot's audio: 20 ms of PCMU every 20 ms, silence between, so the carrier's path stays open.
      const ssrc = crypto.randomBytes(4).readUInt32BE();
      let seq = crypto.randomInt(0, 30000);
      let ts = crypto.randomInt(0, 2 ** 31);
      let next = performance.now();
      const tick = () => {
        if (over) return;
        // A frame sent late goes out with the ones after it at once, which a phone network's buffer may play faster to
        // catch up: the log counts them.
        const behind = performance.now() - next;
        if (behind > 40) (stats.late++, (stats.worst = Math.max(stats.worst, behind)));
        while (typeof queue[0] === "number") o.played(queue.shift() as number);
        const frame = (queue.shift() as Buffer | undefined) ?? silence;
        while (typeof queue[0] === "number") o.played(queue.shift() as number);
        const to = remote as { address: string; port: number } | null;
        if (to?.port) {
          const header = Buffer.alloc(12);
          header[0] = 0x80;
          header.writeUInt16BE(seq, 2);
          header.writeUInt32BE(ts >>> 0, 4);
          header.writeUInt32BE(ssrc, 8);
          rtp.send(send.protect(Buffer.concat([header, frame])), to.port, to.address);
          stats.out++;
          seq = (seq + 1) % 65536;
          ts = (ts + 160) % 2 ** 32;
        }
        next += 20;
        setTimeout(tick, Math.max(0, next - performance.now()));
      };
      tick();
      return { outcome: "answered" };
    } catch (error) {
      await teardown().catch(() => {});
      return { outcome: "failed", error: error instanceof Error ? error.message : String(error) };
    }
  }

  return { transport, dial, hangUp };
}

/** The same code as the proof checked against published vectors, for a check of its own. */
export const forChecks = { ulaw, linear, srtp, digest, parse };
