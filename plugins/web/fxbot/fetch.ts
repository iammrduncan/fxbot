import http from "node:http";
import https from "node:https";
import dns from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import zlib from "node:zlib";

// A page a bot asked for, fetched from fxbot's own process. The address comes from the model, which took it from
// whatever it read, so only the public internet is reached: every address a name resolves to is checked, the connection
// goes to the address that was checked (a second DNS answer can't swap in a private one), every redirect is checked the
// same way before it connects, and the body is capped. As embedded links planned, after fx0's lib/public-fetch.ts.

const version = "0.1.0";
const denied = new BlockList();
for (const [ip, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
  ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) denied.addSubnet(ip, prefix, "ipv4");
const globalV6 = new BlockList();
globalV6.addSubnet("2000::", 3, "ipv6");
for (const [ip, prefix] of [["2001::", 23], ["2001:db8::", 32], ["2002::", 16], ["3fff::", 20]] as const) denied.addSubnet(ip, prefix, "ipv6");

/** A public address: IPv4 outside the private, shared, and reserved ranges, or native global IPv6 unicast only, so a
 * mapped IPv4 address, NAT64, or another transition range can't reach a private network. */
export function isPublic(address: string) {
  const family = isIP(address);
  if (family === 4) return !denied.check(address, "ipv4");
  return family === 6 && globalV6.check(address, "ipv6") && !denied.check(address, "ipv6");
}

/** Why a page wasn't fetched, in words for the bot. */
export class Refused extends Error {}

type Resolve = (name: string) => Promise<{ address: string; family: number }[]>;
const lookup: Resolve = (name) => dns.lookup(name, { all: true, order: "ipv4first" });

/** The address a URL names, checked: http or https on its usual port, no user name, no local name, every address public. */
export async function destination(input: string, resolve: Resolve = lookup) {
  if (!URL.canParse(input)) throw new Refused(`${input} isn't an address.`);
  const url = new URL(input);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Refused(`Only http and https pages can be read, not ${url.protocol}.`);
  if (url.username || url.password) throw new Refused("An address with a user name or password can't be read.");
  if (url.port && url.port !== (url.protocol === "https:" ? "443" : "80")) throw new Refused(`Only the usual ports, 80 and 443, can be read, not ${url.port}.`);
  const name = url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (!name || /(?:^|\.)(?:localhost|local|internal|home|lan)$/i.test(name)) throw new Refused(`${url.hostname} is on this machine or its network, which bots can't reach.`);
  const literal = isIP(name);
  const addresses = literal ? [{ address: name, family: literal }] : await resolve(name).catch(() => [] as { address: string; family: number }[]);
  if (!addresses.length) throw new Refused(`${name} has no address.`);
  if (addresses.some(({ address }) => !isPublic(address))) throw new Refused(`${name} is on this machine or its network, which bots can't reach.`);
  return { url, address: addresses[0] };
}

export type Got = { status: number; url: string; type: string; charset: string; bytes: Buffer; remote: string };

/** A public page, following up to 5 redirects, each checked, within 20 seconds. `maxBytes` is what a type may be. */
export async function get(input: string, { accept, maxBytes, signal, resolve }: { accept?: string; maxBytes: (type: string) => number; signal?: AbortSignal; resolve?: Resolve }): Promise<Got> {
  const deadline = AbortSignal.timeout(20_000);
  const stop = signal ? AbortSignal.any([signal, deadline]) : deadline;
  let next = input;
  try {
    for (let hop = 0; hop <= 5; hop++) {
      stop.throwIfAborted();
      const { url, address } = await destination(next, resolve);
      const response = await new Promise<http.IncomingMessage>((done, fail) => {
        const request = (url.protocol === "https:" ? https : http).request(
          url,
          {
            signal: stop,
            agent: false,
            headers: {
              "user-agent": `Mozilla/5.0 (compatible; fxbot/${version}; +https://fxbot.sh)`,
              accept: accept ?? "text/markdown, text/html;q=0.9, */*;q=0.8",
              "accept-encoding": "gzip, deflate, br",
            },
            // The name stays the URL's, for Host and the certificate, and the connection goes to the address checked.
            lookup: (_name, options, callback) => (options.all ? (callback as any)(null, [address]) : callback(null, address.address, address.family)),
          },
          done,
        );
        request.on("error", fail);
        request.end();
      });
      try {
        const status = response.statusCode ?? 502;
        if ([301, 302, 303, 307, 308].includes(status) && response.headers.location) {
          if (hop === 5) throw new Refused("The page redirected more than 5 times.");
          next = new URL(response.headers.location, url).href;
          continue;
        }
        const [type = "", ...params] = String(response.headers["content-type"] ?? "").split(";").map((s) => s.trim());
        const charset = /^charset=["']?([^"']+)/i.exec(params.find((p) => /^charset=/i.test(p)) ?? "")?.[1] ?? "";
        const most = maxBytes(type.toLowerCase());
        if (Number(response.headers["content-length"]) > most) throw new Refused(`The page is over ${Math.round(most / 1e6)} MB.`);
        const encoding = String(response.headers["content-encoding"] ?? "identity").toLowerCase();
        const unpack = { gzip: zlib.createGunzip, "x-gzip": zlib.createGunzip, deflate: zlib.createInflate, br: zlib.createBrotliDecompress }[encoding];
        if (!unpack && encoding !== "identity") throw new Refused(`The page came encoded as ${encoding}, which fxbot can't read.`);
        const body = unpack ? response.pipe(unpack()) : response;
        const chunks: Buffer[] = [];
        let size = 0;
        for await (const chunk of body) {
          size += chunk.length;
          if (size > most) throw new Refused(`The page is over ${Math.round(most / 1e6)} MB.`);
          chunks.push(Buffer.from(chunk));
        }
        return { status, url: url.href, type: type.toLowerCase(), charset, bytes: Buffer.concat(chunks, size), remote: response.socket?.remoteAddress ?? address.address };
      } finally {
        response.destroy();
      }
    }
    throw new Refused("The page redirected more than 5 times.");
  } catch (error) {
    if (deadline.aborted && !signal?.aborted) throw new Refused("The page didn't answer in 20 seconds.");
    throw error;
  }
}
