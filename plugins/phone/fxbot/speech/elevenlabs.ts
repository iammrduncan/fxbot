import type { PluginApi } from "@fxbot/sdk";
import { json, pcmOf, toBase64, type Adapter, type Added, type ListenOptions, type SpeakOptions } from "../audio.ts";

// ElevenLabs, the owner's favorite: Scribe realtime to listen, committing a stretch after the owner's pause, and Flash
// over the multi-context WebSocket to speak, one context a reply, so its voice carries from sentence to sentence
// (elevenlabs.io/docs, read 2026-11-25). A sentence's mark comes once its last characters have been voiced, counted from
// the timing ElevenLabs sends with its audio.

// ElevenLabs' addresses, at the origin the provider was added with.
const origin = (p: Added) => new URL(p.baseUrl ?? "https://api.elevenlabs.io/v1").origin;
const socketOrigin = (p: Added) => origin(p).replace(/^http/, "ws");

async function listen(fx: PluginApi, p: Added, o: ListenOptions) {
  const secs = Math.min(5, Math.max(0.3, o.pause / 1000)).toFixed(1);
  const query = `model_id=${encodeURIComponent(o.model || "scribe_v2_realtime")}&audio_format=pcm_16000&commit_strategy=vad&vad_silence_threshold_secs=${secs}`;
  const ws = await fx.providers.socket(p.id, `${socketOrigin(p)}/v1/speech-to-text/realtime?${query}`);
  ws.addEventListener("message", (m: MessageEvent) => {
    if (typeof m.data !== "string") return;
    const msg = JSON.parse(m.data);
    const text = String(msg.text ?? "").trim();
    if (msg.message_type === "partial_transcript" && text) o.heard({ type: "partial", text });
    else if (msg.message_type === "committed_transcript" && text) o.heard({ type: "final", text });
    else if (typeof msg.error === "string") o.failed(`Scribe: ${msg.error}`);
  });
  ws.addEventListener("close", (e: CloseEvent) => e.code !== 1000 && e.code !== 1005 && o.failed(`Scribe closed (${e.code}${e.reason ? `: ${e.reason}` : ""}).`));
  return {
    write(pcm: Int16Array) {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ message_type: "input_audio_chunk", audio_base_64: toBase64(pcm), commit: false, sample_rate: 16000 }));
    },
    close: () => ws.close(),
  };
}

const letters = (text: string) => text.replace(/\s+/g, "").length;

async function speak(fx: PluginApi, p: Added, o: SpeakOptions) {
  const query = `model_id=${encodeURIComponent(o.model || "eleven_flash_v2_5")}&output_format=pcm_16000&sync_alignment=true&inactivity_timeout=180`;
  const ws = await fx.providers.socket(p.id, `${socketOrigin(p)}/v1/text-to-speech/${encodeURIComponent(o.voice)}/multi-stream-input?${query}`);
  const send = (msg: object) => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify(msg));
  // The context of the reply being said, and its sentences' marks, each with the letters voiced once it's done.
  let n = 0;
  let context = "";
  let ends: { mark: number; at: number }[] = [];
  let sent = 0;
  let voiced = 0;
  const open = () => {
    context = `reply-${++n}`;
    ends = [];
    sent = voiced = 0;
    send({ text: " ", context_id: context });
  };
  const done = (all = false) => {
    while (ends.length && (all || voiced >= ends[0].at)) o.mark(ends.shift()!.mark);
  };
  ws.addEventListener("message", (m: MessageEvent) => {
    if (typeof m.data !== "string") return;
    const msg = JSON.parse(m.data);
    if ((msg.contextId ?? msg.context_id) !== context) return;
    if (msg.audio) {
      o.audio(pcmOf(Buffer.from(msg.audio, "base64")));
      voiced += letters((msg.alignment?.chars ?? []).join(""));
      done();
    }
    if (msg.isFinal) done(true);
    if (msg.error || msg.message) o.failed(`ElevenLabs: ${msg.error ?? msg.message}`);
  });
  ws.addEventListener("close", (e: CloseEvent) => e.code !== 1000 && e.code !== 1005 && o.failed(`ElevenLabs closed (${e.code}${e.reason ? `: ${e.reason}` : ""}).`));
  open();
  return {
    say(text: string, mark: number) {
      sent += letters(text);
      ends.push({ mark, at: sent });
      send({ text: `${text} `, context_id: context, flush: true });
    },
    clear() {
      send({ context_id: context, close_context: true });
      open();
    },
    close() {
      send({ close_socket: true });
      ws.close();
    },
  };
}

export const elevenlabs: Adapter = {
  label: "ElevenLabs",
  listen: { kinds: ["elevenlabs"], turns: true, models: () => ["scribe_v2_realtime"], open: listen },
  speak: {
    kinds: ["elevenlabs"],
    models: () => ["eleven_flash_v2_5", "eleven_turbo_v2_5", "eleven_multilingual_v2"],
    async voices(fx, p) {
      const body = await json(await fx.providers.fetch(p.id, `${origin(p)}/v1/voices`), "ElevenLabs' voices");
      return (Array.isArray(body?.voices) ? body.voices : []).map((v: { voice_id: string; name: string; category?: string }) => ({
        value: v.voice_id,
        label: v.name,
        group: v.category === "premade" ? "ElevenLabs' voices" : "Your voices",
      }));
    },
    open: speak,
  },
};
