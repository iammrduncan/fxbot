import type { PluginApi } from "@fxbot/sdk";
import { toBase64, type Adapter, type Added, type ListenOptions } from "../audio.ts";

// Mistral's Voxtral realtime, to listen with the owner's Mistral login: it ends turns itself (turn.end), and its words
// come as deltas that never change, which may still arrive just after a turn ends, so a turn's words close a moment
// after turn.end, or at the next turn.start (docs.mistral.ai, read 2026-11-25). Mistral's /audio/speech streams events,
// not audio, so Mistral only listens here.

const delay = 480;

async function listen(fx: PluginApi, p: Added, o: ListenOptions) {
  const base = (p.baseUrl ?? "https://api.mistral.ai/v1").replace(/^http/, "ws").replace(/\/+$/, "");
  const ws = await fx.providers.socket(p.id, `${base}/audio/transcriptions/realtime?model=${encodeURIComponent(o.model || "voxtral-mini-transcribe-realtime-3")}`);
  const silence = Math.min(3000, Math.max(300, Math.round(o.pause)));
  ws.send(
    JSON.stringify({
      type: "session.update",
      session: {
        audio_format: { encoding: "pcm_s16le", sample_rate: 16000 },
        target_streaming_delay_ms: delay,
        turn_detection: { min_silence_ms: silence, end_timeout_ms: Math.max(silence, Math.round(o.pause) + 1000) },
        ...(o.hints.length ? { context_bias: o.hints } : {}),
      },
    }),
  );
  let text = "";
  let closing: NodeJS.Timeout | undefined;
  const finish = () => {
    clearTimeout(closing);
    closing = undefined;
    if (text.trim()) o.heard({ type: "final", text: text.trim() });
    text = "";
  };
  ws.addEventListener("message", (m: MessageEvent) => {
    if (typeof m.data !== "string") return;
    const msg = JSON.parse(m.data);
    if (msg.type === "transcription.text.delta" && typeof msg.text === "string") {
      text += msg.text;
      if (!closing && text.trim()) o.heard({ type: "partial", text: text.trim() });
    } else if (msg.type === "turn.start" && closing) finish();
    else if (msg.type === "turn.end") closing = setTimeout(finish, delay);
    else if (msg.type === "error") o.failed(`Voxtral: ${msg.error?.message ?? "an error"}`);
  });
  ws.addEventListener("close", (e: CloseEvent) => e.code !== 1000 && e.code !== 1005 && o.failed(`Voxtral closed (${e.code}).`));
  return {
    write(pcm: Int16Array) {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "input_audio.append", audio: toBase64(pcm) }));
    },
    close() {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "input_audio.end" }));
      clearTimeout(closing);
      ws.close();
    },
  };
}

export const mistral: Adapter = {
  label: "Mistral",
  listen: { kinds: ["mistral"], turns: true, models: () => ["voxtral-mini-transcribe-realtime-3"], open: listen },
};
