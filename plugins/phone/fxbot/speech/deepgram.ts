import type { PluginApi } from "@fxbot/sdk";
import { pcmOf, type Adapter, type Added, type ListenOptions, type SpeakOptions } from "../audio.ts";

// Deepgram: Flux to listen, which ends the owner's turns itself (/v2/listen, TurnInfo events), and Aura-2 to speak, a
// socket a call keeps, one Speak and Flush a sentence, and Clear to stop (developers.deepgram.com, read 2026-11-25).
// Cloudflare's Workers AI hosts Flux too, behind the owner's Cloudflare token, at its own address (not checked on a
// real account).

const auraVoices = ["thalia", "andromeda", "helena", "apollo", "arcas", "aries", "asteria", "athena", "luna", "orion", "zeus"];
const clamp = (n: number, low: number, high: number) => Math.min(high, Math.max(low, Math.round(n)));

// Deepgram's sockets, at the origin of the address the provider was added with.
const socketOrigin = (p: Added) => new URL(p.baseUrl ?? "https://api.deepgram.com/v1").origin.replace(/^http/, "ws");
// Where Flux listens: Deepgram's own, or Cloudflare's for an account, from the address the owner added.
function fluxUrl(p: Added, o: ListenOptions) {
  const query = `encoding=linear16&sample_rate=16000&eot_timeout_ms=${clamp(o.pause, 500, 60_000)}`;
  if (p.kind === "cloudflare") return `${(p.baseUrl ?? "").replace(/^http/, "ws").replace(/\/ai\/v1\/?$/, "/ai/run/@cf/deepgram/flux")}?${query}`;
  return `${socketOrigin(p)}/v2/listen?model=${encodeURIComponent(o.model || "flux-general-en")}&${query}`;
}

async function listen(fx: PluginApi, p: Added, o: ListenOptions) {
  const ws = await fx.providers.socket(p.id, fluxUrl(p, o));
  // About 80 ms a message, as Flux asks.
  let held: Int16Array[] = [];
  let count = 0;
  ws.addEventListener("message", (m: MessageEvent) => {
    if (typeof m.data !== "string") return;
    const msg = JSON.parse(m.data);
    const event = msg.event ?? msg.type;
    const text = String(msg.transcript ?? "").trim();
    if (event === "EndOfTurn") o.heard({ type: "final", text });
    else if (["StartOfTurn", "Update", "EagerEndOfTurn", "TurnResumed"].includes(event) && text) o.heard({ type: "partial", text });
    else if (event === "Error" || msg.type === "Error") o.failed(String(msg.description ?? msg.message ?? "Flux answered with an error."));
  });
  ws.addEventListener("close", (e: CloseEvent) => e.code !== 1000 && e.code !== 1005 && o.failed(`Flux closed (${e.code}${e.reason ? `: ${e.reason}` : ""}).`));
  return {
    write(pcm: Int16Array) {
      held.push(pcm);
      count += pcm.length;
      if (count < 1280 || ws.readyState !== WebSocket.OPEN) return;
      const out = new Int16Array(count);
      let at = 0;
      for (const part of held) (out.set(part, at), (at += part.length));
      ws.send(out.buffer);
      held = [];
      count = 0;
    },
    close() {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "CloseStream" }));
      ws.close();
    },
  };
}

async function speak(fx: PluginApi, p: Added, o: SpeakOptions) {
  const ws = await fx.providers.socket(p.id, `${socketOrigin(p)}/v1/speak?model=${encodeURIComponent(o.voice || o.model || "aura-2-thalia-en")}&encoding=linear16&sample_rate=16000`);
  // Each Flush answers Flushed in order: the marks wait for theirs.
  const marks: number[] = [];
  ws.addEventListener("message", (m: MessageEvent) => {
    if (typeof m.data !== "string") return void o.audio(pcmOf(m.data as ArrayBuffer));
    const msg = JSON.parse(m.data);
    if (msg.type === "Flushed" && marks.length) o.mark(marks.shift()!);
    else if (msg.type === "Warning") o.failed(String(msg.description ?? "Aura warned."));
  });
  ws.addEventListener("close", (e: CloseEvent) => e.code !== 1000 && e.code !== 1005 && marks.length && o.failed(`Aura closed (${e.code}).`));
  const send = (msg: object) => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify(msg));
  return {
    say(text: string, mark: number) {
      marks.push(mark);
      send({ type: "Speak", text });
      send({ type: "Flush" });
    },
    clear() {
      marks.length = 0;
      send({ type: "Clear" });
    },
    close() {
      send({ type: "Close" });
      ws.close();
    },
  };
}

export const deepgram: Adapter = {
  label: "Deepgram",
  listen: { kinds: ["deepgram", "cloudflare"], turns: true, models: (kind) => (kind === "cloudflare" ? ["flux"] : ["flux-general-en", "flux-general-multi"]), open: listen },
  speak: {
    kinds: ["deepgram"],
    models: () => ["aura-2"],
    async voices() {
      return auraVoices.map((v) => ({ value: `aura-2-${v}-en`, label: v[0].toUpperCase() + v.slice(1) }));
    },
    open: speak,
  },
};
