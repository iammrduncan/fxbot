import type { PluginApi } from "@fxbot/sdk";

// Listening and speaking, from the voice providers the owner added (docs/phases/phone-v2.md, listeners, speakers, and
// adapters). An adapter serves providers by their catalog entry, the kind: the voice services phone brings, and the
// chat logins that also speak. phone's voice loop (voice.ts) holds a call's listener and speaker; this names no call.
// Audio is 16 kHz mono PCM16 throughout, and each adapter asks its provider for that, or converts.

export const rate = 16_000;
/** A provider the owner added, as fx.providers lists it. */
export type Added = { id: string; kind: string; name: string; label: string; baseUrl: string | null };
export type Voice = { value: string; label: string; group?: string };
/** What a listener heard: the words so far, which may change, or a stretch that's finished. */
export type Heard = { type: "partial"; text: string } | { type: "final"; text: string };
export type Listener = { write(pcm: Int16Array): void; close(): void };
export type ListenOptions = {
  model: string;
  /** How long the owner may go quiet, in ms, for a listener that ends turns itself. */
  pause: number;
  hints: string[];
  heard(h: Heard): void;
  failed(why: string): void;
};
/** A reply's voice, kept open while the bot speaks: each sentence's audio, then its mark once its audio is all out. */
export type Speaking = { say(text: string, mark: number): void; clear(): void; close(): void };
export type SpeakOptions = { model: string; voice: string; audio(pcm: Int16Array): void; mark(n: number): void; failed(why: string): void };
// Each part says which kinds it serves, and the models it suggests for one, the first its default. The owner may type
// another.
export type Adapter = {
  label: string;
  /** A listener that streams, with `turns` when it ends the owner's turns itself. */
  listen?: { kinds: string[]; turns: boolean; models(kind: string): string[]; open(fx: PluginApi, p: Added, o: ListenOptions): Promise<Listener> };
  /** A listener that takes one stretch at a time, which phone's voice detector cuts. */
  transcribe?: { kinds: string[]; models(kind: string): string[]; run(fx: PluginApi, p: Added, model: string, pcm: Int16Array, hints: string[]): Promise<string> };
  speak?: {
    kinds: string[];
    models(kind: string): string[];
    voices(fx: PluginApi, p: Added, model: string): Promise<Voice[]>;
    open(fx: PluginApi, p: Added, o: SpeakOptions): Promise<Speaking>;
  };
};

// Audio helpers.
export const toBase64 = (pcm: Int16Array) => Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength).toString("base64");
export const pcmOf = (bytes: ArrayBuffer | Uint8Array | Buffer) => {
  const b = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes;
  const copy = new Uint8Array(b.byteLength - (b.byteLength % 2));
  copy.set(b.subarray(0, copy.byteLength));
  return new Int16Array(copy.buffer);
};
/** Linear resampling, which is enough for speech. */
export function resample(pcm: Int16Array, from: number, to: number) {
  if (from === to || !pcm.length) return pcm;
  const out = new Int16Array(Math.floor((pcm.length * to) / from));
  const step = from / to;
  for (let i = 0; i < out.length; i++) {
    const at = i * step;
    const j = Math.floor(at);
    const next = pcm[Math.min(j + 1, pcm.length - 1)];
    out[i] = Math.round(pcm[j] + (next - pcm[j]) * (at - j));
  }
  return out;
}
/** A WAV file of 16 kHz PCM16, for a provider that takes a file. */
export function wav(pcm: Int16Array, sampleRate = rate) {
  const head = Buffer.alloc(44);
  const size = pcm.byteLength;
  head.write("RIFF", 0);
  head.writeUInt32LE(36 + size, 4);
  head.write("WAVEfmt ", 8);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20);
  head.writeUInt16LE(1, 22);
  head.writeUInt32LE(sampleRate, 24);
  head.writeUInt32LE(sampleRate * 2, 28);
  head.writeUInt16LE(2, 32);
  head.writeUInt16LE(16, 34);
  head.write("data", 36);
  head.writeUInt32LE(size, 40);
  return Buffer.concat([head, Buffer.from(pcm.buffer, pcm.byteOffset, size)]);
}
/** A WAV's samples at 16 kHz, mono: its own rate is read from its header. */
export function fromWav(bytes: Uint8Array) {
  const b = Buffer.from(bytes);
  if (b.toString("ascii", 0, 4) !== "RIFF") return pcmOf(b);
  const channels = b.readUInt16LE(22);
  const sampleRate = b.readUInt32LE(24);
  let at = 12;
  while (at + 8 <= b.length && b.toString("ascii", at, at + 4) !== "data") at += 8 + b.readUInt32LE(at + 4);
  const all = pcmOf(b.subarray(at + 8));
  const mono = channels > 1 ? all.filter((_, i) => i % channels === 0) : all;
  return resample(mono, sampleRate, rate);
}
export const fail = (message: string) => Object.assign(new Error(message), { status: 400 });
export async function json(res: Response, what: string) {
  if (!res.ok) throw fail(`${what} answered ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  return res.json();
}
