// Checking passkeys: one added from a paired device, and one that pairs a wiped device. fxbot checks the origin, the
// rpId, user verification, the signature, the time, and the nonce.
import { b64u, concat, fromB64u, sha256, utf8, type Bytes } from "../../../packages/web-app/protocol/bytes.ts";
import * as wire from "../../../packages/web-app/protocol/wire.ts";

const algs: Record<number, { import: EcKeyImportParams | RsaHashedImportParams | Algorithm; verify: EcdsaParams | Algorithm }> = {
  [-7]: { import: { name: "ECDSA", namedCurve: "P-256" }, verify: { name: "ECDSA", hash: "SHA-256" } },
  [-8]: { import: { name: "Ed25519" }, verify: { name: "Ed25519" } },
  [-257]: { import: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, verify: { name: "RSASSA-PKCS1-v1_5" } },
};
export const importPasskey = (spki: Uint8Array, alg: number) => {
  const a = algs[alg];
  if (!a) throw new Error("That passkey's algorithm isn't one fxbot checks.");
  return crypto.subtle.importKey("spki", spki as Bytes, a.import, false, ["verify"]);
};

type ClientData = { type: string; challenge: string; origin: string; crossOrigin?: boolean };
function clientData(bytes: Bytes, type: string, origin?: string): ClientData {
  const c = JSON.parse(new TextDecoder().decode(bytes)) as ClientData;
  if (c.type !== type) throw new Error("Not a passkey answer of the right kind.");
  const url = new URL(c.origin);
  if (!["https:", "http:"].includes(url.protocol) || url.origin !== c.origin || c.crossOrigin) throw new Error("The passkey's origin isn't a valid web origin.");
  if (origin !== undefined && c.origin !== origin) throw new Error(`The passkey was used on ${c.origin}, not ${origin}.`);
  return c;
}

// A new passkey, from a paired device, for a challenge fxbot gave it.
export async function checkNew(m: { spki: string; alg: number; clientData: string }, challenge: string) {
  const c = clientData(fromB64u(m.clientData), "webauthn.create");
  if (c.challenge !== challenge) throw new Error("That passkey answered another challenge.");
  await importPasskey(fromB64u(m.spki), Number(m.alg));
  return c.origin;
}

// ECDSA signatures come DER-encoded; Web Crypto takes r and s, 32 bytes each.
function derToRaw(der: Bytes): Bytes {
  let at = 2;
  const read = () => {
    if (der[at] !== 0x02) throw new Error("bad signature");
    const len = der[at + 1];
    let v = der.slice(at + 2, at + 2 + len);
    at += 2 + len;
    while (v.length > 32 && v[0] === 0) v = v.slice(1);
    return concat(new Uint8Array(32 - v.length), v);
  };
  return concat(read(), read());
}

// An assertion that pairs a wiped device: its new key D, the time within two minutes, a nonce not seen before.
export async function checkAssertion(
  p: { passkey: { id: string; clientData: string; authData: string; sig: string }; time: number; nonce: string },
  D: Bytes,
  key: { spki: Buffer; alg: number },
  origin: string | undefined,
  seen: Map<string, number>,
) {
  const now = Date.now();
  for (const [n, at] of seen) if (now - at > 5 * 60_000) seen.delete(n);
  if (!Number.isSafeInteger(p.time) || Math.abs(now - p.time) > 120_000) throw new Error("That passkey answer is too old.");
  if (seen.has(p.nonce)) throw new Error("That passkey answer was used already.");
  const nonce = fromB64u(p.nonce);
  if (nonce.length !== 16) throw new Error("bad nonce");
  const cd = fromB64u(p.passkey.clientData);
  const c = clientData(cd, "webauthn.get", origin);
  if (c.challenge !== b64u(await wire.passkeyChallenge(D, p.time, nonce))) throw new Error("That passkey answered for another key.");
  const auth = fromB64u(p.passkey.authData);
  if (auth.length < 37 || b64u(auth.slice(0, 32)) !== b64u(await sha256(utf8(new URL(c.origin).hostname)))) throw new Error("That passkey is for another site.");
  if ((auth[32] & 0x05) !== 0x05) throw new Error("The passkey didn't check it was you.");
  let sig = fromB64u(p.passkey.sig);
  if (key.alg === -7) sig = derToRaw(sig);
  const pub = await importPasskey(new Uint8Array(key.spki), key.alg);
  const ok = await crypto.subtle.verify(algs[key.alg].verify, pub, sig, concat(auth, await sha256(cd)));
  if (!ok) throw new Error("The passkey's signature didn't check.");
  seen.set(p.nonce, now);
  return c.origin;
}
