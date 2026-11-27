import { randomBytes } from "node:crypto";
import type { PluginApi } from "@fxbot/sdk";
import type { Provider, SipAccount } from "../../phone/fxbot/line.ts";

// phone-signalwire: SignalWire for phone (docs/_completed/phases/phone-signalwire.md, and phone-v2.md's part 2). It's
// only the line: a SIP account on the owner's SignalWire space, which phone's own softphone signs in to and rings their
// phone from. Everything else about a call is phone's, the same as a call in the app: the voice, the listening, the
// conversation, and its rules. Every connection goes out, and nothing ever connects in.

const number = /^\+[1-9]\d{6,14}$/;

export default async function setup(fx: PluginApi) {
  const setting = (name: string) => (fx.settings[name] ?? "").trim();
  // The space's name, from what the owner typed: a name, or its address. Only a name that can be one, letters, digits
  // and dashes, so the project's token goes only to the owner's space.
  const space = () => {
    const name = setting("space").replace(/^https?:\/\//, "").replace(/\.signalwire\.com.*$/, "");
    return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(name) ? name : "";
  };
  function missing() {
    const out = ["space", "project", "token"].filter((name) => !(name === "space" ? space() : setting(name)));
    if (!number.test(setting("from"))) out.push("from");
    return out;
  }

  // SignalWire's REST API on the owner's space, with the project and its token.
  async function rest(method: string, path: string, body?: unknown) {
    const res = await fetch(`https://${space()}.signalwire.com${path}`, {
      method,
      headers: { authorization: `Basic ${Buffer.from(`${setting("project")}:${setting("token")}`).toString("base64")}`, "content-type": "application/json", accept: "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15_000),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`SignalWire answered ${res.status} to ${method} ${path}: ${text.slice(0, 200)}`);
    return text ? JSON.parse(text) : null;
  }

  // The SIP endpoint phone signs in to: made once on the owner's space, calling as their number, with encryption
  // required, and passed straight through to the phone network. Its password is kept sealed. It's made again when the
  // space, the project, or the number changes, and the old one deleted.
  type Kept = { space: string; project?: string; from: string; id: string; username: string; password: string; domain?: string };
  let making: Promise<Kept> | null = null;
  async function sip(): Promise<SipAccount | null> {
    if (missing().length) return null;
    const kept = JSON.parse((await fx.secrets.get("sip")) ?? "null") as Kept | null;
    const same = kept && kept.space === space() && kept.from === setting("from") && (kept.project ?? setting("project")) === setting("project");
    const ours = same ? kept : await (making ??= make(kept).finally(() => (making = null)));
    if (!ours.domain) await fx.secrets.set("sip", JSON.stringify(Object.assign(ours, { domain: await domain() })));
    return { domain: ours.domain!, username: ours.username, password: ours.password, from: ours.from };
  }
  // Where an endpoint signs in: the space's SIP domain, from its SIP profile, such as <space>-<12 characters>.sip.signalwire.com.
  // The plain <space>.sip.signalwire.com refused every sign-in (2026-11-27).
  async function domain() {
    const profile = await rest("GET", "/api/relay/rest/sip_profile");
    if (typeof profile?.domain !== "string" || !profile.domain) throw new Error("SignalWire's SIP profile has no domain.");
    return profile.domain as string;
  }
  async function make(old: Kept | null): Promise<Kept> {
    if (old?.id && old.space === space() && (old.project ?? setting("project")) === setting("project"))
      await rest("DELETE", `/api/relay/rest/endpoints/sip/${old.id}`).catch((error) => fx.log(`The old SIP endpoint wasn't deleted: ${error.message}`));
    const username = `fxbot-${randomBytes(4).toString("hex")}`;
    // Letters and digits only, as SignalWire's own examples are.
    const password = randomBytes(16).toString("hex");
    const made = await rest("POST", "/api/relay/rest/endpoints/sip", {
      username,
      password,
      caller_id: setting("from"),
      send_as: setting("from"),
      encryption: "required",
      codecs: ["PCMU"],
      ciphers: ["AES_CM_128_HMAC_SHA1_80"],
      call_handler: "passthrough",
    });
    const kept: Kept = { space: space(), project: setting("project"), from: setting("from"), id: String(made?.id ?? ""), username: String(made?.username ?? username), password, domain: await domain() };
    await fx.secrets.set("sip", JSON.stringify(kept));
    fx.log(`Made the SIP endpoint ${kept.username} on SignalWire, calling as ${kept.from}.`);
    return kept;
  }

  const provider: Provider = { label: "SignalWire", missing, sip };
  fx.provide(provider);
}
