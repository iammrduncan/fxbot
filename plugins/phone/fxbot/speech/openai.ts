import type { PluginApi } from "@fxbot/sdk";
import { fromWav, json, wav, type Adapter, type Added, type SpeakOptions } from "../audio.ts";

// OpenAI's audio shape, /audio/transcriptions and /audio/speech, which many serve: OpenAI itself until its models shut
// down (2027-01-06 for speech, 2027-02-26 for its transcribers), Azure OpenAI, Groq, Together, DeepInfra, OpenRouter,
// LiteLLM, vLLM, a custom server, and phone's speech server: Speaches, LocalAI, Kokoro-FastAPI, or whisper.cpp's.
// Listening takes one stretch at a time, as phone's voice detector cuts them; speaking, one sentence at a time, since
// this shape has no context to stream a reply into.

const listens = ["openai", "azure", "groq", "mistral", "together", "deepinfra", "openrouter", "litellm", "vllm", "custom", "speech-server"];
const speaks = ["openai", "azure", "groq", "together", "deepinfra", "openrouter", "litellm", "custom", "speech-server"];
const heard: Record<string, string[]> = {
  openai: ["gpt-4o-mini-transcribe", "gpt-transcribe", "whisper-1"],
  azure: ["gpt-4o-mini-transcribe"],
  groq: ["whisper-large-v3-turbo", "whisper-large-v3"],
  mistral: ["voxtral-mini-latest"],
  together: ["openai/whisper-large-v3"],
  deepinfra: ["openai/whisper-large-v3-turbo"],
  "speech-server": ["Systran/faster-whisper-small"],
};
const said: Record<string, string[]> = {
  openai: ["gpt-4o-mini-tts", "tts-1"],
  azure: ["gpt-4o-mini-tts"],
  groq: ["canopylabs/orpheus-v1-english"],
  together: ["hexgrad/Kokoro-82M"],
  deepinfra: ["hexgrad/Kokoro-82M"],
  "speech-server": ["speaches-ai/Kokoro-82M-v1.0-ONNX", "kokoro", "tts-1"],
};
const openaiVoices = ["alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer", "verse"];
const kokoroVoices = ["af_heart", "af_bella", "af_nicole", "am_adam", "am_michael", "bf_emma", "bm_george"];
const voicesOf: Record<string, string[]> = { openai: openaiVoices, azure: openaiVoices, groq: ["troy", "hannah", "austin"], together: kokoroVoices, deepinfra: kokoroVoices, "speech-server": kokoroVoices };
const base = (p: Added) => (p.baseUrl ?? "").replace(/\/+$/, "");

export const openai: Adapter = {
  label: "OpenAI's audio shape",
  transcribe: {
    kinds: listens,
    models: (kind) => heard[kind] ?? [],
    async run(fx, p, model, pcm, hints) {
      const form = new FormData();
      form.append("file", new Blob([wav(pcm)], { type: "audio/wav" }), "speech.wav");
      form.append("model", model);
      if (hints.length) form.append("prompt", hints.join(", "));
      const body = await json(await fx.providers.fetch(p.id, `${base(p)}/audio/transcriptions`, { method: "POST", body: form }), `${p.name}'s transcription`);
      return String(body?.text ?? "").trim();
    },
  },
  speak: {
    kinds: speaks,
    models: (kind) => said[kind] ?? [],
    async voices(_fx, p) {
      return (voicesOf[p.kind] ?? []).map((v) => ({ value: v, label: v }));
    },
    async open(fx: PluginApi, p: Added, o: SpeakOptions) {
      // One sentence at a time, in order: a clear drops what waits and aborts the one being made.
      const waiting: { text: string; mark: number }[] = [];
      let running = false;
      let closed = false;
      let abort = new AbortController();
      async function next() {
        if (running || closed) return;
        running = true;
        try {
          while (waiting.length && !closed) {
            const { text, mark } = waiting.shift()!;
            const signal = abort.signal;
            const res = await fx.providers.fetch(p.id, `${base(p)}/audio/speech`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ model: o.model, voice: o.voice, input: text, response_format: "wav" }),
              signal,
            });
            if (!res.ok) throw new Error(`${p.name}'s speech answered ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
            const pcm = fromWav(new Uint8Array(await res.arrayBuffer()));
            if (signal.aborted) continue;
            o.audio(pcm);
            o.mark(mark);
          }
        } catch (error) {
          if (!abort.signal.aborted) o.failed(error instanceof Error ? error.message : String(error));
        } finally {
          running = false;
        }
        if (waiting.length && !closed) void next();
      }
      return {
        say(text, mark) {
          waiting.push({ text, mark });
          void next();
        },
        clear() {
          waiting.length = 0;
          abort.abort();
          abort = new AbortController();
        },
        close() {
          closed = true;
          waiting.length = 0;
          abort.abort();
        },
      };
    },
  },
};
