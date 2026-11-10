// What fxbot can tell about its own network, before a device tries: whether UDP gets out, how its NAT maps, a mapped
// port, IPv6, and a container. And the ICE servers, with TURN credentials minted fresh from the owner's own.
import { createHmac, randomBytes } from "node:crypto";
import { createSocket, type Socket } from "node:dgram";
import { lookup } from "node:dns/promises";
import { existsSync, readFileSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { pmpNat, upnpNat, type Gateway } from "@achingbrain/nat-port-mapper";
import { docs, type Finding, type IceServer, type Reach } from "../../../packages/web-app/protocol/wire.ts";

// One entry in the owner's ordered list. Credentials stay sealed, and the page sees them only as set or not.
export type IceEntry =
  | { id: string; kind: "stun"; urls: string }
  | { id: string; kind: "turn"; urls: string; username: string; credential: string }
  | { id: string; kind: "cloudflare"; keyId: string; token: string }
  | { id: string; kind: "secret"; urls: string; secret: string };
export const cloudflareStun: IceEntry = { id: "cloudflare", kind: "stun", urls: "stun:stun.cloudflare.com:3478" };

const urlPattern = /^(stuns?|turns?):[^\s?#]+(\?transport=(udp|tcp))?$/;
export function checkEntry(e: any): IceEntry {
  const text = (v: unknown, what: string, max = 512) => {
    if (typeof v !== "string" || !v.trim() || v.length > max) throw new Error(`${what} is missing.`);
    return v.trim();
  };
  const urls = (v: unknown, kinds: string[]) => {
    const list = text(v, "The server's address").split(/[\s,]+/);
    for (const u of list) if (!urlPattern.test(u) || !kinds.includes(u.split(":")[0])) throw new Error(`${u} isn't a ${kinds.join(" or ")} address, such as ${kinds[0]}:example.com:3478.`);
    return list.join(" ");
  };
  const id = randomBytes(6).toString("hex");
  if (e?.kind === "stun") return { id, kind: "stun", urls: urls(e.urls, ["stun", "stuns"]) };
  if (e?.kind === "turn") return { id, kind: "turn", urls: urls(e.urls, ["turn", "turns"]), username: text(e.username, "The username"), credential: text(e.credential, "The password") };
  if (e?.kind === "cloudflare") return { id, kind: "cloudflare", keyId: text(e.keyId, "The TURN key's id", 128), token: text(e.token, "The TURN key's API token", 256) };
  if (e?.kind === "secret") return { id, kind: "secret", urls: urls(e.urls, ["turn", "turns"]), secret: text(e.secret, "The shared secret") };
  throw new Error("An ICE server is stun, turn, cloudflare, or secret.");
}
// What the page sees of an entry.
export const shown = (e: IceEntry) =>
  e.kind === "cloudflare" ? { id: e.id, kind: e.kind, urls: "turn:turn.cloudflare.com", keyId: e.keyId } : { id: e.id, kind: e.kind, urls: e.urls, ...(e.kind === "turn" ? { username: e.username } : {}) };

// The list as ICE servers, in order, with TURN credentials minted: 24 hours from a shared secret, as coturn and eturnal
// take them, and from Cloudflare's API with the owner's own key. Minted ones are kept for half their life.
const minted = new Map<string, { at: number; servers: IceServer[] }>();
const day = 24 * 60 * 60;
export async function iceServers(list: IceEntry[], fetcher: typeof fetch, log: (...parts: unknown[]) => void): Promise<IceServer[]> {
  const out: IceServer[] = [];
  for (const e of list) {
    if (e.kind === "stun") out.push(...e.urls.split(" ").map((urls) => ({ urls })));
    else if (e.kind === "turn") out.push(...e.urls.split(" ").map((urls) => ({ urls, username: e.username, credential: e.credential })));
    else if (e.kind === "secret") {
      const username = `${Math.floor(Date.now() / 1000) + day}:fxbot`;
      const credential = createHmac("sha1", e.secret).update(username).digest("base64");
      out.push(...e.urls.split(" ").map((urls) => ({ urls, username, credential })));
    } else {
      const kept = minted.get(e.id);
      if (kept && Date.now() - kept.at < (day / 2) * 1000) {
        out.push(...kept.servers);
        continue;
      }
      try {
        const res = await fetcher(`https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(e.keyId)}/credentials/generate-ice-servers`, {
          method: "POST",
          headers: { authorization: `Bearer ${e.token}`, "content-type": "application/json" },
          body: JSON.stringify({ ttl: day }),
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) throw new Error(`Cloudflare answered ${res.status}`);
        const body = (await res.json()) as { iceServers?: { urls: string | string[]; username?: string; credential?: string }[] };
        // Only its TURN addresses: the list's own STUN entries say which STUN servers are used.
        const servers = (body.iceServers ?? []).flatMap((s) => [s.urls].flat().filter((u) => /^turns?:/.test(u)).map((urls) => ({ urls, username: s.username, credential: s.credential })));
        minted.set(e.id, { at: Date.now(), servers });
        out.push(...servers);
      } catch (error) {
        log(`Cloudflare TURN credentials: ${error instanceof Error ? error.message : error}`);
      }
    }
  }
  return out;
}

// werift uses the first STUN and the first TURN server it's given, and Google's STUN when given none. With no STUN
// server in the owner's list, it gets a loopback address instead, so it contacts nobody it wasn't told to.
export function forWerift(servers: IceServer[]) {
  const stun = servers.find((s) => /^stuns?:/.test(s.urls));
  const turn = servers.find((s) => /^turns?:/.test(s.urls));
  return [stun ?? { urls: "stun:127.0.0.1:9" }, ...(turn ? [turn] : [])];
}

// A STUN binding request, and the address the server saw: RFC 8489's XOR-MAPPED-ADDRESS, or the older MAPPED-ADDRESS.
const cookie = 0x2112a442;
function bind(socket: Socket, host: string, port: number, ms = 1500): Promise<{ address: string; port: number } | null> {
  const id = randomBytes(12);
  const request = Buffer.alloc(20);
  request.writeUInt16BE(0x0001, 0);
  request.writeUInt32BE(cookie, 4);
  id.copy(request, 8);
  return new Promise((resolve) => {
    let tries = 0;
    const done = (value: { address: string; port: number } | null) => {
      clearInterval(timer);
      socket.off("message", onMessage);
      resolve(value);
    };
    const onMessage = (msg: Buffer) => {
      if (msg.length < 20 || msg.readUInt16BE(0) !== 0x0101 || !msg.subarray(8, 20).equals(id)) return;
      for (let at = 20; at + 4 <= msg.length; ) {
        const type = msg.readUInt16BE(at), len = msg.readUInt16BE(at + 2), v = msg.subarray(at + 4, at + 4 + len);
        if ((type === 0x0020 || type === 0x0001) && len >= 8) {
          const xor = type === 0x0020;
          const p = v.readUInt16BE(2) ^ (xor ? cookie >>> 16 : 0);
          if (v[1] === 1) return done({ address: Array.from(v.subarray(4, 8), (b, i) => b ^ (xor ? (cookie >>> (24 - 8 * i)) & 255 : 0)).join("."), port: p });
          if (v[1] === 2 && len >= 20) {
            const mask = Buffer.concat([Buffer.from([0x21, 0x12, 0xa4, 0x42]), id]);
            const raw = Array.from(v.subarray(4, 20), (b, i) => b ^ (xor ? mask[i] : 0));
            return done({ address: Array.from({ length: 8 }, (_, i) => ((raw[2 * i] << 8) | raw[2 * i + 1]).toString(16)).join(":"), port: p });
          }
        }
        at += 4 + len + ((4 - (len % 4)) % 4);
      }
    };
    socket.on("message", onMessage);
    const send = () => (tries++ < 3 ? socket.send(request, port, host, () => {}) : done(null));
    const timer = setInterval(send, ms / 3);
    send();
  });
}

const stunTargets = (list: IceEntry[]) =>
  list.flatMap((e) => (e.kind === "cloudflare" ? ["stun:turn.cloudflare.com:3478"] : e.urls.split(" ")))
    .map((u) => /^(?:stun|turn):([^?:\s]+|\[[^\]]+\])(?::(\d+))?(?:\?transport=udp)?$/i.exec(u))
    .filter((m): m is RegExpExecArray => Boolean(m))
    .map((m) => ({ host: m[1].replace(/^\[|\]$/g, ""), port: Number(m[2] ?? 3478) }));

export const inContainer = () => existsSync("/.dockerenv") || existsSync("/run/.containerenv");
const isCgnat = (ip: string) => {
  const [a, b] = ip.split(".").map(Number);
  return a === 100 && b >= 64 && b <= 127;
};
const isPrivate = (ip: string) => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|127\.|169\.254\.)/.test(ip) || isCgnat(ip);
export const globalV6 = () => Object.values(networkInterfaces()).flat().some((i) => i && i.family === "IPv6" && !i.internal && /^[23]/.test(i.address));
const publicV4 = () => Object.values(networkInterfaces()).flat().filter((i) => i && i.family === "IPv4" && !i.internal && !isPrivate(i.address)).map((i) => i!.address);

// The machine's addresses a device might reach, less containers' bridges and the like: none of those leads anywhere
// from outside, and each would take a port and a round of ICE checks. werift keeps the addresses it's given by name.
const virtual = /^(podman|docker|br-|cni|virbr|veth|lxc|lxd|flannel|cali|weave|vnet|kube|cilium|vmnet)/;
export function hostAddresses() {
  const keep = Object.entries(networkInterfaces())
    .filter(([name]) => !virtual.test(name))
    .flatMap(([, list]) => (list ?? []).filter((i) => !i.internal && !/^(fe80:|169\.254\.)/i.test(i.address)).map((i) => i.address));
  return Object.fromEntries(keep.map((address, i) => [`host${i}`, address]));
}

// Whether a UDP port in the range is free, as werift will look for one.
export async function freePort([min, max]: [number, number]) {
  for (let port = min; port <= max; port++) {
    const socket = createSocket("udp4");
    const free = await new Promise<boolean>((r) => (socket.once("error", () => r(false)), socket.once("listening", () => r(true)), socket.bind(port)));
    await new Promise<void>((r) => (free ? socket.close(() => r()) : r()));
    if (free) return true;
  }
  return false;
}

// The default IPv4 gateway on Linux, for NAT-PMP, which talks to the router directly.
function gatewayV4() {
  try {
    for (const line of readFileSync("/proc/net/route", "utf8").split("\n").slice(1)) {
      const [, dest, gw] = line.trim().split(/\s+/);
      if (dest === "00000000" && gw && gw !== "00000000") return Buffer.from(gw, "hex").reverse().join(".");
    }
  } catch {}
  return null;
}

// The ICE ports, mapped on the router by NAT-PMP or UPnP, and renewed by the library while fxbot listens.
export class Mapper {
  gateway: Gateway | null = null;
  state: { how?: "NAT-PMP" | "UPnP"; external?: string; ports?: [number, number]; error?: string; container?: boolean } = {};
  async start(ports: [number, number], log: (...parts: unknown[]) => void) {
    await this.stop();
    if (inContainer()) return void (this.state = { container: true });
    const host = Object.values(networkInterfaces()).flat().find((i) => i && i.family === "IPv4" && !i.internal && isPrivate(i.address))?.address;
    if (!host) return void (this.state = { error: "This machine has no private IPv4 address to map a port to." });
    const map = async (gateway: Gateway, how: "NAT-PMP" | "UPnP") => {
      for (let port = ports[0]; port <= ports[1]; port++) await gateway.map(port, host, { externalPort: port, protocol: "udp", description: "fxbot web pairing", signal: AbortSignal.timeout(5000) });
      this.gateway = gateway;
      this.state = { how, ports, external: await gateway.externalIp({ signal: AbortSignal.timeout(5000) }).catch(() => undefined) };
    };
    const gw = gatewayV4();
    try {
      if (gw) return await map(pmpNat(gw, { autoRefresh: true }), "NAT-PMP");
    } catch {}
    try {
      for await (const gateway of upnpNat({ autoRefresh: true }).findGateways({ signal: AbortSignal.timeout(5000) })) return await map(gateway, "UPnP");
    } catch {}
    this.state = { error: "The router didn't map a port by NAT-PMP or UPnP. It may have both off, which is common." };
    log("Port mapping: none");
  }
  async stop() {
    const g = this.gateway;
    this.gateway = null;
    this.state = {};
    await g?.stop().catch(() => {});
  }
}

// The checks, and a line that sums them up.
export async function check(list: IceEntry[], mapper: Mapper): Promise<Reach> {
  const findings: Finding[] = [];
  const targets = stunTargets(list);
  const answers: { address: string; port: number }[] = [];
  const socket = createSocket("udp4");
  await new Promise<void>((r) => socket.bind(0, r));
  try {
    // Each server at each of its addresses, so one server at two addresses can still tell how the NAT maps.
    for (const t of targets.slice(0, 4)) {
      const addresses = await lookup(t.host, { all: true, family: 4 }).catch(() => []);
      for (const a of addresses.slice(0, 2)) {
        const got = await bind(socket, a.address, t.port);
        if (got) answers.push(got);
        if (answers.length >= 2) break;
      }
      if (answers.length >= 2) break;
    }
  } finally {
    socket.close();
  }
  const turn = list.some((e) => e.kind !== "stun");
  if (!targets.length) findings.push({ check: "udp", result: "unknown", text: "There's no STUN server in the list, so fxbot can't check its network. Add one under ICE servers.", docs: docs.noStun });
  else if (!answers.length) findings.push({ check: "udp", result: "bad", text: "This network blocks UDP, so devices can't connect directly. Use Tailscale or WireGuard, or a TURN server of your own over TLS.", docs: docs.udp });
  else findings.push({ check: "udp", result: "good", text: "UDP gets out, and a STUN server answered." });

  const external = answers[0]?.address;
  const own = publicV4();
  const mapped = mapper.state;
  const cgnat = Boolean(external && (isCgnat(external) || (mapped.external && mapped.external !== external) || (mapped.external && isCgnat(mapped.external))));
  if (external && own.includes(external)) findings.push({ check: "address", result: "good", text: `This machine has a public address, ${external}, with no NAT in front of it.` });
  else if (cgnat) findings.push({ check: "address", result: "bad", text: "This fxbot is behind carrier-grade NAT. Devices on other networks likely can't reach it directly, and forwarding a port won't help. TURN, Tailscale, or WireGuard will.", docs: docs.cgnat });
  else if (external) findings.push({ check: "address", result: "good", text: `Its public address is ${external}.` });

  let symmetric = false;
  if (answers.length >= 2) {
    symmetric = answers[0].port !== answers[1].port;
    findings.push(symmetric
      ? { check: "nat", result: "bad", text: "This network's NAT maps ports per destination (a symmetric NAT), so phones on many carriers can't reach it directly. A mapped port, TURN, or Tailscale will.", docs: docs.symmetric }
      : { check: "nat", result: "good", text: "This network's NAT keeps one port for every destination, which most devices can reach." });
  } else if (answers.length === 1) findings.push({ check: "nat", result: "unknown", text: "Only one STUN answer, so fxbot can't tell how its NAT maps ports. Add a second STUN server to find out.", docs: docs.secondStun });

  const container = inContainer();
  if (container) findings.push({ check: "container", result: "warn", text: "fxbot runs in a container, so port mapping can't work from inside it. To forward a port, publish 8790–8799/udp, as the docs show.", docs: docs.container });
  else if (mapped.how) findings.push({ check: "mapping", result: "good", text: `The router mapped UDP ${mapped.ports?.join("–")} by ${mapped.how}${mapped.external ? `, at ${mapped.external}` : ""}. Devices on any network that allows UDP can likely reach this fxbot.` });
  else if (mapped.error) findings.push({ check: "mapping", result: "warn", text: `${mapped.error} A port forwarded by hand can't be seen from inside, so if you forwarded one, this is expected.`, docs: docs.unmapped });

  const v6 = globalV6();
  findings.push(v6 ? { check: "ipv6", result: "good", text: "This machine has IPv6. Devices with IPv6 can likely connect directly." } : { check: "ipv6", result: "unknown", text: "This machine has no global IPv6 address." });

  const direct = Boolean(mapped.how) || Boolean(external && own.includes(external));
  const summary = !answers.length && targets.length
    ? "Not reachable directly from outside this network"
    : cgnat || symmetric
      ? direct ? "Reachable from many networks, but not from phones on some carriers" : "Not reachable directly from outside this network"
      : direct ? "Likely reachable from most networks" : "Reachable from many networks, but not from phones on some carriers";
  return { summary: turn ? `${summary}. Your TURN server covers the rest.` : summary, findings };
}
