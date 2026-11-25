// Talk: a call in the app, over the page's own socket to phone (docs/phases/phone-v2.md, the app's call). The page
// carries the audio: the microphone, echo-cancelled by the browser, as 16 kHz PCM16, and the bot's voice, played as it
// comes and dropped at once when the owner cuts in. Or the browser's own speech, This device. One call at a time.
import { useEffect, useState, useSyncExternalStore } from "react";
import { openBeside, ui, useBots } from "@fxbot/app";

const store = { now: null, listeners: new Set() };
const set = (next) => ((store.now = next && { ...(store.now ?? {}), ...next }), store.listeners.forEach((listen) => listen()));
export const useTalk = () =>
  useSyncExternalStore(
    (listen) => (store.listeners.add(listen), () => store.listeners.delete(listen)),
    () => store.now,
  );
const on = () => store.now && store.now.status !== "ended";

// The microphone and the player, made at the tap, as a phone needs, before the socket opens.
async function audio(socket, quiet) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  const context = new AudioContext();
  // A browser with no way to play sound leaves this waiting, so the call says so rather than starting forever.
  await Promise.race([context.resume(), new Promise((resolve) => setTimeout(resolve, 3000))]);
  if (context.state !== "running") {
    stream.getTracks().forEach((t) => t.stop());
    void context.close().catch(() => {});
    throw Object.assign(new Error("The browser didn't start its audio for this page."), { said: true });
  }
  await context.audioWorklet.addModule("/api/plugins/phone/worklet.js");
  const mic = new AudioWorkletNode(context, "fxbot-mic");
  const player = new AudioWorkletNode(context, "fxbot-player");
  context.createMediaStreamSource(stream).connect(mic);
  player.connect(context.destination);
  let muted = false;
  mic.port.onmessage = (e) => !muted && socket.readyState === WebSocket.OPEN && socket.send(e.data);
  // Each sentence's mark sits where its audio ends; once the player passes it, phone hears it played.
  let queued = 0;
  let marks = [];
  player.port.onmessage = (e) => {
    const { played, cleared } = e.data;
    if (cleared) ((marks = []), (queued = played));
    while (marks.length && played >= marks[0].at) socket.readyState === WebSocket.OPEN && socket.send(JSON.stringify({ played: marks.shift().n }));
    const busy = Boolean(e.data.busy);
    if (store.now?.speaking && !busy) quiet();
    if (store.now && store.now.speaking !== busy) set({ speaking: busy });
  };
  return {
    track: stream.getAudioTracks()[0],
    play(buffer) {
      queued += buffer.byteLength / 2;
      player.port.postMessage(buffer, [buffer]);
    },
    mark: (n) => marks.push({ n, at: queued }),
    clear: () => player.port.postMessage("clear"),
    mute(on) {
      muted = on;
      stream.getAudioTracks().forEach((t) => (t.enabled = !on));
    },
    stop() {
      stream.getTracks().forEach((t) => t.stop());
      if (context.state !== "closed") void context.close().catch(() => {});
    },
  };
}

// This device listening: the browser's own SpeechRecognition, given the echo-cancelled track where it takes one. Chrome
// listens on the device when its language is there, and through Google only when phone's googleListening allows it.
async function deviceEars(socket, track, google, speaking) {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) return { error: "This browser has no speech recognition: pick a voice provider in phone's tab." };
  const r = new Recognition();
  r.continuous = true;
  r.interimResults = true;
  r.lang = navigator.language || "en-US";
  if (typeof Recognition.available === "function") {
    const here = await Recognition.available({ langs: [r.lang], processLocally: true }).catch(() => "unavailable");
    if (here === "available") r.processLocally = true;
    else if (!google) return { error: "Chrome would send what you say to Google. Turn on googleListening in phone's settings, or pick a voice provider." };
  }
  let alive = true;
  let withTrack = true;
  const send = (heard) => socket.readyState === WebSocket.OPEN && socket.send(JSON.stringify({ heard }));
  r.onresult = (e) => {
    for (let i = e.resultIndex; i < e.results.length; i++) send({ [e.results[i].isFinal ? "final" : "partial"]: e.results[i][0].transcript });
  };
  const start = () => {
    if (!alive || (!withTrack && speaking())) return;
    try {
      if (withTrack) r.start(track);
      else r.start();
    } catch {
      if (!withTrack) return;
      withTrack = false;
      start();
    }
  };
  r.onend = () => alive && setTimeout(start, 100);
  start();
  return {
    // Without the track, it would hear the bot: it waits while the bot speaks, so the owner can't cut in.
    hush: () => !withTrack && r.abort(),
    resume: () => !withTrack && start(),
    stop: () => ((alive = false), r.abort()),
  };
}

// This device speaking: the browser's own voices, local ones first.
function deviceMouth(socket, done) {
  const voice = () => speechSynthesis.getVoices().find((v) => v.localService && v.lang?.startsWith((navigator.language || "en").slice(0, 2))) ?? null;
  return {
    say(n, text) {
      const u = new SpeechSynthesisUtterance(text);
      const v = voice();
      if (v) u.voice = v;
      u.onend = () => (socket.readyState === WebSocket.OPEN && socket.send(JSON.stringify({ played: n })), done());
      speechSynthesis.speak(u);
    },
    clear: () => speechSynthesis.cancel(),
  };
}

// Starts a call, from the tap: for a bot, or a room's bots.
export async function talk(target, label) {
  if (on()) return;
  set(null);
  set({ target, label, status: "starting", at: Date.now(), muted: false, speaking: false, who: "", error: "" });
  // A phone speaks only after a tap: an empty utterance now lets This device speak later.
  if ("speechSynthesis" in window) speechSynthesis.speak(new SpeechSynthesisUtterance(""));
  const path = target.room !== undefined ? `talk/room/${target.room}` : `talk/${target.bot}`;
  const socket = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/api/plugins/phone/${path}`);
  socket.binaryType = "arraybuffer";
  let sound = null;
  let ears = null;
  let mouth = null;
  let lock = null;
  // What phone sends while the microphone opens waits here, in order, so the call's start and its first audio aren't lost.
  const early = [];
  let ready = false;
  const end = (why) => {
    if (!store.now || store.now.status === "ended") return;
    set({ status: "ended", error: why && why !== "hung up" ? why : "" });
    ears?.stop();
    mouth?.clear();
    sound?.stop();
    void lock?.release?.().catch(() => {});
    document.removeEventListener("visibilitychange", hidden);
    if (socket.readyState === WebSocket.OPEN) (socket.send(JSON.stringify({ end: true })), socket.close());
  };
  // A phone takes the microphone from an app in the background, so the call ends there.
  const hidden = () => document.visibilityState === "hidden" && end("The app went to the background.");
  document.addEventListener("visibilitychange", hidden);
  set({ end, mute: (muted) => (set({ muted }), sound?.mute(muted), socket.send(JSON.stringify({ mute: muted }))) });
  socket.onmessage = (e) => (ready ? void handle(e.data) : early.push(e.data));
  socket.onclose = (e) => end(store.now?.status === "starting" && e.reason ? e.reason : "");
  const over = () => store.now?.socket !== socket || store.now.status === "ended";
  set({ socket });
  try {
    sound = await audio(socket, () => ears?.resume());
  } catch (error) {
    return end(error?.name === "NotAllowedError" ? "The microphone isn't allowed for this page." : error?.said ? error.message : `The microphone didn't open: ${error?.message ?? error}`);
  }
  // The call ended while the microphone opened.
  if (over()) return sound.stop();
  // The screen stays on during the call, where the browser allows it. It isn't waited for: Firefox can leave it pending.
  void navigator.wakeLock?.request("screen").then((l) => (over() ? void l.release().catch(() => {}) : (lock = l)), () => {});
  const handle = async (message) => {
    // Once the call is over, here or on the server, what's still coming changes nothing.
    if (over()) return;
    if (typeof message !== "string") return (ears?.hush(), sound.play(message));
    const m = JSON.parse(message);
    if (m.state === "starting") {
      if (typeof m.open === "string") set({ open: m.open });
      if (m.speak === "device") mouth = deviceMouth(socket, () => ears?.resume());
      if (m.listen === "device") {
        const got = await deviceEars(socket, sound.track, m.google, () => store.now?.speaking);
        if (got.error) return end(got.error);
        ears = got;
      }
    } else if (m.state === "on") set({ status: "on", at: Date.now() });
    else if (typeof m.mark === "number") sound.mark(m.mark);
    else if (typeof m.say === "number") (ears?.hush(), mouth?.say(m.say, m.text));
    else if (m.clear) (sound.clear(), mouth?.clear(), ears?.resume());
    else if (typeof m.who === "string") set({ who: m.who });
    else if (m.ended) end(m.ended === true ? "" : m.ended);
  };
  while (early.length && !over()) await handle(early.shift());
  ready = true;
}

export const Mic = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" x2="12" y1="19" y2="22" />
  </svg>
);
const clock = (from) => {
  const s = Math.max(0, Math.floor((Date.now() - from) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const mine = (now, target) => now && (target.room !== undefined ? now.target.room === target.room : now.target.bot === target.bot);

// The subagents working for the call's bots, by name, from the subagents plugin's list, if it's added: what's under way.
function useWorking(bots) {
  const [names, setNames] = useState([]);
  const key = bots.join(",");
  useEffect(() => {
    let alive = true;
    const look = () =>
      Promise.all(bots.map((bot) => fetch(`/api/plugins/subagents/bots/${bot}`).then((r) => (r.ok ? r.json() : { subagents: [] }), () => ({ subagents: [] })))).then(
        (lists) => alive && setNames(lists.flatMap((l) => (l.subagents ?? []).filter((s) => s.state === "working").map((s) => s.name))),
      );
    void look();
    const timer = setInterval(look, 3000);
    return () => ((alive = false), clearInterval(timer));
  }, [key]);
  return names;
}

// The call's bar: who it's with, how long, what's happening, what's under way in the background, Mute, and End.
function Bar({ now, title, bots = [] }) {
  const [, tick] = useState(0);
  const working = useWorking(bots);
  useEffect(() => {
    const timer = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  const doing = now.status === "starting" ? "Starting…" : now.speaking ? `${now.whoName || now.label} is speaking` : now.muted ? "Muted" : "Listening";
  return (
    <section className="flex min-w-0 items-center gap-2 rounded-lg border bg-background p-2 pl-3 text-sm" aria-label={title}>
      <span className="text-muted-foreground">
        <Mic />
      </span>
      <span className="min-w-0 flex-1 truncate">
        {title} · {clock(now.at)} · <span className="text-muted-foreground">{doing}</span>
        {working.length > 0 && <span className="text-muted-foreground"> · {working.join(", ")} {working.length === 1 ? "is" : "are"} working</span>}
      </span>
      {/* The call's own chat, as it goes, beside the chat (phone-v3): the main chat doesn't hold the call. */}
      {now.open && (
        <ui.Button type="button" size="icon-sm" variant="ghost" aria-label="Open the call's chat" title="Open the call's chat" onClick={() => openBeside(now.open)}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path d="M15 3v18" />
          </svg>
        </ui.Button>
      )}
      <ui.Button type="button" size="sm" variant="outline" aria-pressed={now.muted} onClick={() => now.mute(!now.muted)}>
        {now.muted ? "Unmute" : "Mute"}
      </ui.Button>
      <ui.Button type="button" size="sm" variant="destructive" onClick={() => now.end("hung up")}>
        End
      </ui.Button>
    </section>
  );
}

// Above the bot's message box while its call in the app is on, and why the last one ended, if it failed.
export function TalkBar({ bot }) {
  const now = useTalk();
  if (!mine(now, { bot: bot.id })) return null;
  if (now.status === "ended") return now.error ? <p className="rounded-lg border p-2 text-sm text-destructive">The call ended: {now.error}</p> : null;
  return <Bar now={now} title={`Talking with ${bot.name}`} bots={[bot.id]} />;
}

// Above a room's message box while its call is on: who's speaking, with the call's bar, or why the last one ended.
export function RoomTalkBar({ room }) {
  const now = useTalk();
  const bots = useBots() ?? [];
  if (!room || !mine(now, { room: room.id })) return null;
  if (now.status === "ended") return now.error ? <p className="rounded-lg border p-2 text-sm text-destructive">The call ended: {now.error}</p> : null;
  const who = bots.find((b) => b.id === now.who);
  return (
    <div className="flex min-w-0 items-center gap-2">
      {who && <ui.Blob {...who} size={28} busy={now.speaking} className="shrink-0" />}
      <div className="grid min-w-0 flex-1">
        <Bar now={{ ...now, whoName: who?.name }} title={`A call with ${room.name}`} bots={room.members} />
      </div>
    </div>
  );
}
