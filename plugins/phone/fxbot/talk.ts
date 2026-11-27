import type { PluginSocket } from "@fxbot/sdk";
import { pcmOf } from "./audio.ts";
import type { Input, Transport } from "./voice.ts";

// The app's call (docs/_completed/phases/phone-v2.md, the app's call): the page's socket at /talk/:bot, or /talk/room/:room. Up
// come the microphone, 16 kHz PCM16 in binary frames, `{"played": n}` as each sentence plays to its end, the page's
// own words as `{"heard": {"partial" | "final": text}}` when This device listens, `{"mute": true|false}`, and
// `{"end": true}`. Down go the bot's voice, binary, `{"mark": n}` after a sentence's audio, `{"say": n, "text", "voice"}`
// when This device speaks, `{"clear": true}` to drop what the page holds, and `{"state": …}` and `{"ended": how}`.

export function transport(socket: PluginSocket): Transport {
  return {
    // Audio the page can't take in time is dropped rather than queued without end: about 2 minutes of it.
    audio: (pcm) => void (socket.bufferedAmount < 4_000_000 && socket.send(new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength))),
    send: (message) => socket.send(JSON.stringify(message)),
    clear: () => socket.send(JSON.stringify({ clear: true })),
    close: () => socket.close(1000, "The call ended."),
  };
}

/** What the page sends, to the call's voice loop, until the page goes, which ends the call. */
export function listen(socket: PluginSocket, input: () => Input | null, end: (why: string) => void, log: (line: string) => void) {
  socket.onmessage = (data) => {
    const to = input();
    if (!to) return;
    if (typeof data !== "string") return to.audio(pcmOf(data));
    let m: { played?: unknown; heard?: { partial?: unknown; final?: unknown }; mute?: unknown; end?: unknown; why?: unknown };
    try {
      m = JSON.parse(data);
    } catch {
      return;
    }
    if (typeof m.played === "number") to.played(m.played);
    else if (typeof m.heard?.partial === "string") to.heard({ type: "partial", text: m.heard.partial.slice(0, 4000) });
    else if (typeof m.heard?.final === "string") to.heard({ type: "final", text: m.heard.final.slice(0, 4000) });
    else if (typeof m.mute === "boolean") to.muted(m.mute);
    // How the page ended the call goes in the log: End, or the app going to the background.
    else if (m.end === true) (log(`The app ended the call: ${typeof m.why === "string" ? m.why.slice(0, 100) : "End"}.`), end("hung up"));
  };
  socket.onclose = () => end("The app closed the call.");
}
