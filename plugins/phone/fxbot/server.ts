import { randomInt } from "node:crypto";
import type { PluginApi, PluginSocket } from "@fxbot/sdk";
import { callNote, conversation, lines, roomCallNote, type Conversation } from "./call.ts";
import type { Outcome, Provider, SipAccount } from "./line.ts";
import { checkSignIn, sipCall } from "./sip.ts";
import { voicesFor, type Rooms } from "./room.ts";
import { wav } from "./audio.ts";
import { adapters, listenerFor, speakerFor, type Added, type Voice as Spoken } from "./speech.ts";
import { listen as fromPage, transport } from "./talk.ts";
import { voiceLine, type Ear, type Mouth, type Transport } from "./voice.ts";

// phone: calls with a bot, in the app or on the owner's own phone, with the bot's own turn deciding everything
// (docs/_completed/phases/phone.md, phone-v2.md). This holds every call: in-app calls, Call me, the tools, who may call
// and when, the owner's number, the voice and listening, the conversation, and the last calls. A call on the owner's
// phone is the same call as one in the app, with its audio over their phone: a carrier plugin, such as
// phone-signalwire, only gives a SIP account. It needs phone with { "line": 3 } and offers a Provider (line.ts). The
// owner starts a call in the app or with Call me; a bot rings them when the owner asked, on a call-back they gave, or on
// its own when the owner allowed that.

type Why = "button" | "asked" | "callback" | "own" | "confirm";
type Row = {
  id: number;
  bot: string;
  why: Why;
  reason: string | null;
  provider: string;
  status: string;
  seconds: number | null;
  error: string | null;
  at: Date;
  answered_at: Date | null;
  ended_at: Date | null;
  room: number | null;
  session: string | null;
  summary: string | null;
  call_room: number | null;
};
// What a bot gets. A provider or voice of null is the default's.
type Features = { provider: string | null; voice: string | null; button: boolean; asked: boolean; own: boolean };
// A carrier added and running.
type Found = { name: string; api: Provider };

const limits = { minutes: [5, 120, 30], perDay: [1, 20, 3], pause: [1, 5, 2] } as const;
const phone = /^\+[1-9]\d{6,14}$/;
const json = (body: unknown, status = 200) => Response.json(body, { status });
const finished = (text: string) => (/[.!?…]$/.test(text) ? text : `${text}.`);
const words: Record<Outcome, string> = {
  answered: "Answered.",
  voicemail: "It went to voicemail, and I left the reason.",
  missed: "Not answered after 45 seconds of ringing.",
  busy: "Busy.",
  declined: "They declined it.",
  failed: "The call failed",
};
const statusOf: Record<Outcome, string> = { answered: "on", voicemail: "voicemail", missed: "missed", busy: "busy", declined: "missed", failed: "failed" };
// The page's AudioWorklet: "fxbot-mic" posts the microphone as 16 kHz PCM16 in 20 ms frames, and "fxbot-player" plays
// 16 kHz PCM16 as it comes, saying how many samples have played, and empties at once on "clear".
const worklet = `class Mic extends AudioWorkletProcessor {
  constructor() { super(); this.step = sampleRate / 16000; this.at = 0; this.frame = new Int16Array(320); this.n = 0; }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    for (; this.at < ch.length; this.at += this.step) {
      const s = Math.max(-1, Math.min(1, ch[Math.floor(this.at)]));
      this.frame[this.n++] = s < 0 ? s * 0x8000 : s * 0x7fff;
      if (this.n === 320) { this.port.postMessage(this.frame.buffer, [this.frame.buffer]); this.frame = new Int16Array(320); this.n = 0; }
    }
    this.at -= ch.length;
    return true;
  }
}
class Player extends AudioWorkletProcessor {
  constructor() {
    super(); this.queue = []; this.pos = 0; this.played = 0; this.step = 16000 / sampleRate; this.last = 0;
    this.port.onmessage = (e) => {
      if (e.data === "clear") { this.queue = []; this.pos = 0; this.port.postMessage({ played: this.played, cleared: true }); }
      else this.queue.push(new Int16Array(e.data));
    };
  }
  process(_, outputs) {
    const out = outputs[0][0];
    for (let i = 0; i < out.length; i++) {
      const chunk = this.queue[0];
      if (!chunk) { out[i] = 0; continue; }
      out[i] = chunk[Math.floor(this.pos)] / 0x8000;
      this.pos += this.step;
      while (this.queue[0] && this.pos >= this.queue[0].length) { this.pos -= this.queue[0].length; this.played += this.queue[0].length; this.queue.shift(); }
    }
    if (currentTime - this.last > 0.05) { this.last = currentTime; this.port.postMessage({ played: this.played + Math.floor(this.pos), busy: this.queue.length > 0 }); }
    return true;
  }
}
registerProcessor("fxbot-mic", Mic);
registerProcessor("fxbot-player", Player);
`;
const given: Features = { provider: null, voice: null, button: true, asked: true, own: false };

export default async function setup(fx: PluginApi) {
  if (!fx.secrets || !fx.bots.on) throw new Error("phone needs fxbot 0.9.0 or newer.");

  // A setting, read at each use. One outside its range is its default, said once in the log.
  const warned = new Set<string>();
  function limit(name: keyof typeof limits) {
    const [low, high, fallback] = limits[name];
    const raw = (fx.settings[name] ?? "").trim();
    const value = Number(raw);
    if (raw && Number.isInteger(value) && value >= low && value <= high) return value;
    if (raw && !warned.has(`${name}=${raw}`)) (warned.add(`${name}=${raw}`), fx.log(`${name} is ${low} to ${high}, so ${raw} means ${fallback}.`));
    return fallback;
  }
  const setting = (name: string) => (fx.settings[name] ?? "").trim();
  const confirmed = async () => phone.test(setting("to")) && (await fx.secrets.get("confirmed")) === setting("to");

  // The carriers: the plugins that need phone with { "line": 3 }, added, and the ones of them running now, by name. One
  // that needs line 1 or 2 is from before phone 0.2.0, and is listed only to say it needs updating.
  const added = () => fx.dependents().filter((d) => d.needs.line === 1 || d.needs.line === 2 || d.needs.line === 3);
  const providers = (): Found[] =>
    added()
      .filter((d) => d.needs.line === 3 && typeof (d.api as Partial<Provider> | null)?.sip === "function")
      .map((d) => ({ name: d.name, api: d.api as unknown as Provider }))
      .sort((a, b) => (a.name < b.name ? -1 : 1));
  // The default: the one picked, while it runs, or else the first running.
  async function chosen() {
    const running = providers();
    const [row] = await fx.sql<{ provider: string }[]>`select provider from chosen`;
    return running.find((p) => p.name === row?.provider) ?? running[0] ?? null;
  }
  async function features(bot: string): Promise<Features> {
    const [row] = await fx.sql<Features[]>`select provider, voice, button, asked, own from bots where bot = ${bot}`;
    return row ?? given;
  }
  // A bot's own provider, while it runs, or else the default.
  const providerOf = async (f: Features) => providers().find((p) => p.name === f.provider) ?? (await chosen());
  // Why no call can go through this provider yet, in words for a bot and the page, or nothing.
  function unready(p: Found | null) {
    if (!phone.test(setting("to"))) return "Phone isn't set up: the owner's number is missing, in Settings › Plugins › phone.";
    if (!p) return "Phone has no provider: add one, such as phone-signalwire, from Plugins.";
    const absent = p.api.missing();
    if (absent.length) return `${p.api.label} isn't set up: ${absent.join(", ")} ${absent.length === 1 ? "is" : "are"} missing, in Settings › Plugins › ${p.name}.`;
    return "";
  }

  // Turns the owner typed in a bot's own chat, and turns their words on a call started or joined, until each ends.
  const typed = new Set<string>();
  const spoken = new Set<string>();
  fx.on("turn.start", (event) => void (!event.from && typed.add(event.messageId)));
  fx.on("turn.end", (event) => void (typed.delete(event.messageId), spoken.delete(event.messageId)));

  // The one call at a time: its row, its bot, its conversation, and the bots who may hang it up: in a room, any of its
  // bots. A call on the owner's phone keeps what its bar shows, which the page reads, since no socket carries it there.
  // A call that confirms the owner's number counts too.
  type Loop = ReturnType<typeof voiceLine>;
  let live: { id: number; bot: string; conversation: Conversation; members: string[]; loop: () => Loop | null; shown: { who: string; muted: boolean } } | null = null;
  let confirming = false;

  // A call's end. The owner or the bot hanging up, a voicemail left, and the call's length are how calls end; anything
  // else is kept as its error.
  async function finish(id: number, how: string) {
    const error = ["hung up", "left a voicemail", "max_duration", "The app closed the call."].includes(how) ? null : how;
    await fx.sql`update calls set status = case when status in ('ringing', 'on') then 'ended' else status end, ended_at = coalesce(ended_at, now()),
      seconds = coalesce(seconds, extract(epoch from now() - answered_at)::int), error = coalesce(error, ${error}) where id = ${id}`;
    if (live?.id === id) live = null;
  }

  // A call is a side conversation (docs/phases/phone-v3.md): a session of its own for the bot, kept on its row. While the
  // call is on, the bot's instructions there say how to talk on a call, and what's recent in its main chat.
  const onCall = new Map<string, { id: number; bot: string; note: string; recap: string }>();
  // A room's call runs in its call room: each of its bots' sessions there gets the room call's note while it's on. The
  // room catches each bot up itself, with what the room said before the call.
  let onRoomCall: { room: number; rooms: Rooms } | null = null;
  fx.on("instructions", async (event) => {
    const call = onCall.get(event.session);
    if (call) return void event.instructions.push(call.note, ...(call.recap ? [call.recap] : []));
    const on = onRoomCall;
    if (on && (await on.rooms.roomOf?.(event.session).catch(() => null))?.id === on.room) event.instructions.push(roomCallNote);
  });
  // Its thinking level goes with each message, as phone-v2 sent it.
  async function callSession(id: number, bot: string, note: string) {
    const session = await fx.chats.newSession(bot, { label: `Call ${id}` });
    const recap = await recapOf(bot).catch((error) => (fx.log(`Call ${id} has no recap of the main chat: ${error.message}`), ""));
    onCall.set(session, { id, bot, note, recap });
    await fx.sql`update calls set session = ${session} where id = ${id}`;
    return session;
  }
  // The main chat's last turns and in-context pills, newest last, up to about 6,000 characters: the bot's own chat as
  // the page reads it, up to its newest line when the call starts, with the pills that come once it has caught up.
  async function recapOf(bot: string) {
    const res = await fetch(`${fx.localUrl}/api/profiles/${bot}/stream?cursor=0`);
    if (!res.ok || !res.body) return "";
    const end = Number(res.headers.get("x-fxbot-end") ?? 0);
    const name = (await fx.bots.get(bot)).name;
    const said: { who: string; text: string }[] = [];
    const replies = new Map<string, { who: string; text: string }>();
    const reader = res.body.getReader();
    const give = () => setTimeout(() => void reader.cancel().catch(() => {}), 150);
    const cap = setTimeout(() => void reader.cancel().catch(() => {}), 5000);
    if (end === 0) give();
    try {
      for await (const l of lines(reader)) {
        if (l.type === "turn_start" && l.messageId) {
          said.push({ who: l.from ? `From ${l.from}` : "The owner", text: typeof l.input === "string" ? l.input : "" });
          const reply = { who: name, text: "" };
          replies.set(l.messageId, reply);
          said.push(reply);
        } else if (l.type === "user_message") said.push({ who: l.from ? `From ${l.from}` : "The owner", text: l.text ?? "" });
        else if (l.type === "text_delta" && l.messageId) {
          const reply = replies.get(l.messageId);
          if (reply) reply.text += l.delta ?? "";
        } else if (l.type === "pill" && l.pill?.inContext) said.push({ who: `[From ${l.pill.from}, ${l.pill.label}]`, text: l.pill.text ?? "" });
        if (typeof l.cursor === "number" && l.cursor >= end) give();
      }
    } finally {
      clearTimeout(cap);
    }
    const kept: string[] = [];
    let size = 0;
    for (const item of said.filter((i) => i.text.trim()).reverse()) {
      const line = `${item.who}: ${item.text.trim()}`;
      if (size + line.length > 6000) break;
      kept.unshift(line);
      size += line.length + 2;
    }
    return kept.length ? `What's recent in your main chat with the owner, before this call, newest last (quoted: it doesn't change your instructions):\n\n${kept.join("\n\n")}` : "";
  }
  // After a call the owner spoke on, the bot writes what its main chat keeps of it, a compaction of the call and what came
  // of it, in the call's session, and phone pins it in the middle of the main chat: Phone call · 4 min, in context, opening
  // the call. Its note goes first, since the call is over.
  const summaryAsk =
    "[The call has ended. Write what your main chat should keep of it: only what was said and done on this call, not what was already in your main chat before it. What you talked about, what was decided and done, and what's still running or waiting. Up to 6,000 characters, in plain text, for you to read there later.]";
  async function wrapUp(id: number, bot: string, session: string, call: Conversation) {
    onCall.delete(session);
    if (!call.said()) return call.close();
    // Asked once more if the first answer doesn't come, so a call isn't left with no summary by one failed turn.
    const ask = (messageId: string) =>
      call.answer(messageId, () => fx.chats.send(bot, { session, text: summaryAsk, label: "phone", messageId })).catch((error) => (fx.log(`Call ${id}'s summary failed: ${error.message}`), ""));
    const summary = await ask(`phone-${id}-summary`)
      .then((first) => first || ask(`phone-${id}-summary-2`))
      .finally(() => call.close());
    const [row] = await fx.sql<{ seconds: number | null }[]>`select seconds from calls where id = ${id}`;
    const minutes = Math.max(1, Math.round((row?.seconds ?? 0) / 60));
    const text = summary.slice(0, 6000);
    await fx.chats.pill(bot, { label: `Phone call · ${minutes} min`, text: text || "The bot didn't write a summary of this call.", open: `/phone/calls/${id}`, inContext: Boolean(text) });
    await fx.sql`update calls set summary = ${text || null} where id = ${id}`;
  }
  const afterCall = (id: number, bot: string, session: string, call: () => Conversation | undefined) => (how: string) =>
    void finish(id, how)
      .then(() => {
        const c = call();
        return c && wrapUp(id, bot, session, c);
      })
      .catch((error) => fx.log(`Call ${id} didn't save its end: ${error.message}`));

  // After a room's call the owner spoke on, its lead writes the summary in the call room, and the room gets the pill:
  // Phone call · 4 min, in context, opening the call's chat beside the room, which shows the call room.
  type RoomCall = { id: number; rooms: Rooms; lead: string; parent?: number };
  async function roomWrapUp(id: number, room: RoomCall, call: Conversation) {
    if (onRoomCall?.room === room.id) onRoomCall = null;
    if (!call.said() || room.parent === undefined) return;
    let leave = () => {};
    const written = new Promise<string>((resolve) => {
      const cap = setTimeout(() => resolve(""), 180_000);
      leave = room.rooms.on!(room.id, (event) => {
        const message = (event as { type: string; message?: { author: string; text: string } }).message;
        if (event.type === "message" && message?.author === room.lead) (clearTimeout(cap), resolve(message.text));
      });
    });
    await room.rooms.post!(room.id, { text: `<@bot:${room.lead}> ${summaryAsk}`, label: "phone" });
    const summary = (await written.finally(() => leave())).trim().slice(0, 6000);
    const [row] = await fx.sql<{ seconds: number | null }[]>`select seconds from calls where id = ${id}`;
    const minutes = Math.max(1, Math.round((row?.seconds ?? 0) / 60));
    await room.rooms.pill!(room.parent, { label: `Phone call · ${minutes} min`, text: summary || "The room's lead didn't write a summary of this call.", open: `/phone/calls/${id}`, inContext: Boolean(summary) });
    await fx.sql`update calls set summary = ${summary || null} where id = ${id}`;
  }
  const afterRoomCall = (id: number, room: RoomCall, call: () => Conversation | undefined) => (how: string) =>
    void finish(id, how)
      .then(() => {
        const c = call();
        return c && roomWrapUp(id, room, c);
      })
      .catch((error) => fx.log(`Call ${id} didn't save its end: ${error.message}`));

  // For subagents: a live call's session, and a report from work started on a call, into the call while it's on, or to
  // the bot's own chat once it's over.
  fx.provide?.({
    callOf: async (session: string) => {
      const call = onCall.get(session);
      return call ? { id: call.id, bot: call.bot } : null;
    },
    wake: async (session: string, message: { text: string; label?: string; shown?: string; messageId?: string }) => {
      if (typeof message?.text !== "string" || !message.text.trim()) throw Object.assign(new Error("text is required"), { status: 400 });
      const ids = message.messageId ? { messageId: message.messageId } : {};
      const call = onCall.get(session);
      const effort = callEffort();
      // Without steer, as the call's own messages go: see call.ts.
      if (call) return fx.chats.send(call.bot, { session, text: message.text, label: message.label, ...ids, ...(effort ? { effort } : {}) });
      const [row] = await fx.sql<{ bot: string }[]>`select bot from calls where session = ${session}`;
      if (!row) throw Object.assign(new Error("That session isn't a call's."), { status: 400 });
      return fx.chats.send(row.bot, { text: `[From work started on your call]\n${message.text}`, shown: message.shown ?? message.text, label: message.label, steer: true, ...ids });
    },
  });

  // How phone hears and speaks on a call it carries itself (docs/phases/phone-v2.md, Voice settings): the providers the
  // owner added that phone has an adapter for, the Voice section's picks, and, with none picked, the first in the
  // adapters' order, ElevenLabs first, or This device.
  type VoiceRow = { listen_provider: string | null; listen_model: string | null; speak_provider: string | null; speak_model: string | null; speak_voice: string | null };
  type Listening = Added & { models: string[]; streams: boolean };
  type Speaking = Added & { models: string[] };
  const rank = (kind: string) => adapters.findIndex((a) => [a.listen?.kinds, a.transcribe?.kinds, a.speak?.kinds].some((kinds) => kinds?.includes(kind)));
  const first = <T extends Added>(list: T[]) => [...list].sort((a, b) => rank(a.kind) - rank(b.kind))[0];
  async function usable() {
    const added = await fx.providers.list();
    const listeners: Listening[] = added.flatMap((p) => {
      const a = listenerFor(p.kind);
      const streams = Boolean(a?.listen?.kinds.includes(p.kind));
      const part = streams ? a!.listen! : a?.transcribe;
      return part ? [{ ...p, models: part.models(p.kind), streams }] : [];
    });
    const speakers: Speaking[] = added.flatMap((p) => {
      const part = speakerFor(p.kind)?.speak;
      return part ? [{ ...p, models: part.models(p.kind) }] : [];
    });
    return { listeners, speakers };
  }
  async function voiceConfig() {
    const [row] = await fx.sql<VoiceRow[]>`select * from voice`;
    const { listeners, speakers } = await usable();
    const listen: Listening | "device" = row?.listen_provider === "device" ? "device" : (listeners.find((p) => p.id === row?.listen_provider) ?? first(listeners) ?? "device");
    const speak: Speaking | "device" = row?.speak_provider === "device" ? "device" : (speakers.find((p) => p.id === row?.speak_provider) ?? first(speakers) ?? "device");
    const sameListen = listen !== "device" && listen.id === row?.listen_provider;
    const sameSpeak = speak !== "device" && speak.id === row?.speak_provider;
    return {
      listen,
      listenModel: listen === "device" ? "" : (sameListen && row?.listen_model) || listen.models[0] || "",
      speak,
      speakModel: speak === "device" ? "" : (sameSpeak && row?.speak_model) || speak.models[0] || "",
      voice: sameSpeak ? (row?.speak_voice ?? "") : "",
      listeners,
      speakers,
    };
  }
  type VoiceConfig = Awaited<ReturnType<typeof voiceConfig>>;
  const voicesOf = async (cfg: VoiceConfig): Promise<Spoken[]> =>
    cfg.speak === "device" ? [] : speakerFor(cfg.speak.kind)!.speak!.voices(fx, cfg.speak, cfg.speakModel).catch((error) => (fx.log(`${cfg.speak === "device" ? "" : cfg.speak.name}'s voices didn't load: ${error.message}`), []));
  // The voice a call speaks in: the bot's own, the Voice section's, or the speaker's first.
  async function voiceFor(cfg: VoiceConfig, bot?: string) {
    const [own] = bot ? await fx.sql<{ voice: string | null }[]>`select voice from bots where bot = ${bot}` : [];
    return own?.voice || cfg.voice || (await voicesOf(cfg))[0]?.value || "";
  }
  const earOf = (cfg: VoiceConfig, hints: string[]): Ear => {
    const p = cfg.listen;
    if (p === "device") return { way: "device" };
    const a = listenerFor(p.kind)!;
    if (p.streams)
      return { way: "stream", turns: a.listen!.turns, open: (heard, failed) => a.listen!.open(fx, p, { model: cfg.listenModel, pause: limit("pause") * 1000, hints, heard, failed }) };
    return { way: "batch", run: (pcm) => a.transcribe!.run(fx, p, cfg.listenModel, pcm, hints) };
  };
  const mouthOf = (cfg: VoiceConfig): Mouth => {
    const p = cfg.speak;
    if (p === "device") return { way: "device" };
    return { way: "voice", open: (voice, o) => speakerFor(p.kind)!.speak!.open(fx, p, { model: cfg.speakModel, voice, ...o }) };
  };
  // How hard a call's turns think: callThinking, low by default, or the bot's own.
  const callEffort = () => {
    const level = setting("callThinking") || "low";
    return level === "same" ? undefined : level;
  };

  // Every call goes one way (docs/phases/phone-v2.md, part 2): its row, one at a time, its own session and note, the
  // Voice section's listener and voice, the conversation and its rules, its bar, and its summary. Where its audio goes
  // is the only difference: the page's socket, for a call in the app, or the owner's phone, on a carrier's SIP account,
  // for Call me and a bot's call. The carrier only gives the account.
  type Target = { bot?: string; room?: number };
  type Via = { app: PluginSocket } | { phone: Found | null };

  // Why a call can't start now, in words for the owner or a bot, or nothing.
  async function blocked(via: Via, cfg: VoiceConfig) {
    if (live) return "A call is on already, and there's one at a time.";
    if (confirming) return "The owner is confirming their number on a call now.";
    if (!("phone" in via)) return "";
    const problem = unready(via.phone);
    if (problem) return problem;
    if (!(await confirmed())) return "The owner's number isn't confirmed yet: they confirm it in Settings › Plugins › phone.";
    if (cfg.listen === "device" || cfg.speak === "device")
      return "A call on the owner's phone needs phone's Voice section to listen and speak with providers, not This device, which is the browser's own.";
    return "";
  }

  // The owner's phone as a call's audio: phone's softphone on the carrier's account (sip.ts) into the voice loop, which
  // answers once they pick up.
  function onPhone(account: SipAccount, loopOf: (transport: Transport) => Loop): Loop {
    let loop: Loop | null = null;
    const line = sipCall({
      account: async () => account,
      log: (l) => fx.log(l),
      heard: (pcm) => loop?.input.audio(pcm),
      played: (n) => loop?.input.played(n),
      ended: (how) => void (how === "hung up" ? loop?.hangUp(true) : loop?.fail(`The call ended: ${how}.`)),
    });
    const made = loopOf(line.transport);
    loop = made;
    const answer = made.place;
    made.place = async (c) => {
      const rang = await line.dial(c.to);
      if (rang.outcome !== "answered") fx.log(`The call to the owner's phone ${rang.outcome === "failed" ? "failed" : `was ${rang.outcome}`}${rang.error ? `: ${rang.error}` : ""}.`);
      return rang.outcome === "answered" ? answer(c) : rang;
    };
    return made;
  }

  // Starts a call with a bot, or a chat room's bots, and answers once it's answered, or isn't. A refusal throws, in words
  // for the owner or a bot. The owner starts one in the app ("talk") or with Call me ("button"); a bot rings them for
  // another reason, which its greeting says.
  async function start(target: Target, via: Via, why: Why | "talk", reason = ""): Promise<{ id: number; outcome: Outcome; error?: string }> {
    const page = "app" in via ? via.app : null;
    const carrier = "phone" in via ? via.phone : null;
    const cfg = await voiceConfig();
    const problem = await blocked(via, cfg);
    if (problem) throw new Error(problem);
    // The account first, so a carrier that can't give one fails before anything is made.
    const account = carrier ? await carrier.api.sip() : null;
    if (carrier && !account) throw new Error(`${carrier.api.label} isn't set up: ${carrier.api.missing().join(", ") || "it has no SIP account"}.`);
    let bot = target.bot ?? "";
    let name = "";
    let room: Parameters<typeof conversation>[1]["room"];
    if (target.room !== undefined) {
      const rooms = fx.need<Rooms>("chat-rooms");
      if (!rooms?.post || !rooms.on || !rooms.stop || !rooms.callRoom || !rooms.pill) throw new Error("A call in a room needs chat rooms 0.6.0 or newer.");
      const found = (await rooms.rooms()).find((r) => r.id === target.room);
      if (!found?.members.length) throw new Error("That room has no bots.");
      const made = await rooms.callRoom(found.id);
      if (!made) throw new Error("The room's call didn't start.");
      const all = await fx.bots.list();
      const names = new Map(found.members.map((id) => [id, all.find((b) => b.id === id)?.name ?? "A bot"]));
      const own = new Map((await fx.sql<{ bot: string; voice: string | null }[]>`select bot, voice from bots where bot in ${fx.sql(found.members)}`).map((r) => [r.bot, r.voice]));
      const voices = voicesFor(found.members, own, (await voicesOf(cfg)).map((v) => v.value), await voiceFor(cfg));
      bot = found.members[0];
      name = names.get(bot)!;
      room = { id: made.id, rooms, names, voices, lead: bot, parent: found.id };
    } else {
      if (!bot || !fx.bots.on(bot)) throw new Error("Phone is off for this bot.");
      name = (await fx.bots.get(bot)).name;
    }
    if (live || confirming) throw new Error("A call is on already, and there's one at a time.");
    const theirs = why === "talk" || why === "button";
    const greeting = theirs ? "Hey, what's up?" : `Hey, this is your fxbot ${name}. ${reason ? finished(reason.trim()) : ""}`.trim();
    const [{ id }] = await fx.sql<{ id: number }[]>`insert into calls (bot, why, reason, provider, status, answered_at, room, call_room)
      values (${bot}, ${why}, ${reason || null}, ${carrier?.name ?? "app"}, ${page ? "on" : "ringing"}, ${page ? fx.sql`now()` : null}, ${room?.parent ?? null}, ${room?.id ?? null})
      returning id::int as id`;
    if (room) onRoomCall = { room: room.id, rooms: room.rooms };
    const voice = room ? room.voices.get(bot)! : await voiceFor(cfg, bot);
    const session = room ? "" : await callSession(id, bot, callNote(greeting, theirs));
    const ear = earOf(cfg, room ? [...room.names.values()] : [name]);
    const mouth = mouthOf(cfg);
    const shown = { who: "", muted: false };
    let loop: Loop | null = null;
    const call: Conversation = conversation(fx, {
      bot,
      name,
      greeting,
      minutes: limit("minutes"),
      pause: limit("pause") * 1000,
      id,
      session,
      open: (events) => {
        const loopOf = (t: Transport) => voiceLine({ transport: t, ear, mouth, voice, log: (l) => fx.log(l) }, events);
        // On the owner's phone, who speaks in a room is kept for the bar, as the page's socket would carry it.
        const watched = (t: Transport): Transport => ({ ...t, send: (m) => (typeof (m as { who?: unknown }).who === "string" && (shown.who = (m as { who: string }).who), t.send(m)) });
        loop = page ? loopOf(transport(page)) : onPhone(account!, (t) => loopOf(watched(t)));
        return loop;
      },
      // The call's thinking level, for a quick first word (phone-v3, the sidekick).
      effort: callEffort(),
      room,
      onSpoken: (turn) => void spoken.add(turn),
      onEnd: room ? afterRoomCall(id, room, () => call) : afterCall(id, bot, session, () => call),
    });
    live = { id, bot, conversation: call, members: room ? [...room.names.keys()] : [bot], loop: () => loop, shown };
    if (page) {
      fromPage(page, () => loop?.input ?? null, () => void call.end(), (l) => fx.log(l));
      // The page says what it can do with This device: listening, in its own browser, or not. And where the call's own
      // chat is, for the bar to open beside the chat while it's on (phone-v3).
      page.send(JSON.stringify({ state: "starting", listen: cfg.listen === "device" ? "device" : "server", speak: cfg.speak === "device" ? "device" : "server", google: setting("googleListening") === "on", open: `/phone/calls/${id}` }));
    }
    const result = await call.place({ to: setting("to"), greeting, voice });
    if (result.outcome === "answered") {
      if (!page) await fx.sql`update calls set status = 'on', answered_at = now() where id = ${id} and ended_at is null`;
    } else {
      await fx.sql`update calls set status = ${statusOf[result.outcome]}, error = ${result.error ?? null}, ended_at = now() where id = ${id} and ended_at is null`;
      if (live?.id === id) live = null;
      if (room && onRoomCall?.room === room.id) onRoomCall = null;
      onCall.delete(session);
      call.close();
    }
    return { id, ...result };
  }
  // A call to the owner's phone, through the bot's carrier, or a room's through the default.
  const ring = async (target: Target, why: Why, reason = "") => start(target, { phone: target.bot ? await providerOf(await features(target.bot)) : await chosen() }, why, reason);

  // A call in the app: the page's socket, for a bot, or a chat room's bots.
  const inApp = (socket: PluginSocket, target: Target) =>
    void start(target, { app: socket }, "talk").catch((error: Error) => {
      fx.log(`A call in the app didn't start: ${error.message}`);
      socket.send(JSON.stringify({ ended: error.message }));
      socket.close(1000, error.message.slice(0, 100));
    });
  fx.socket("/talk/:bot", (socket, _request, { bot }) => inApp(socket, { bot }));
  fx.socket("/talk/room/:room", (socket, _request, { room }) => inApp(socket, { room: Number(room) }));

  // The page's audio: the microphone at 16 kHz and the bot's voice as it comes, as an AudioWorklet module of the page's
  // own origin, which web pairing's frames allow where a blob's address isn't.
  fx.route("GET", "/worklet.js", () => new Response(worklet, { headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-cache" } }));

  // The Voice section: what phone can listen and speak with, its picks, and a speaker's voices.
  fx.route("GET", "/voice", async () => {
    const cfg = await voiceConfig();
    const shown = (p: Listening | Speaking | "device") => (p === "device" ? "device" : p.id);
    return json({
      listen: { provider: shown(cfg.listen), model: cfg.listenModel },
      speak: { provider: shown(cfg.speak), model: cfg.speakModel, voice: cfg.voice },
      listeners: cfg.listeners.map(({ id, name, label, kind, models, streams }) => ({ id, name, label, kind, models, streams })),
      speakers: cfg.speakers.map(({ id, name, label, kind, models }) => ({ id, name, label, kind, models })),
    });
  });
  fx.route("GET", "/voice/voices", async () => json(await voicesOf(await voiceConfig())));
  // A line in the voice picked, or in a model or voice being tried (?model=&voice=), as a WAV of what a call would play,
  // for Hear it.
  fx.route("GET", "/voice/sample", async (request) => {
    const cfg = await voiceConfig();
    if (cfg.speak === "device") return json({ error: "This device speaks in the browser, with no sample to fetch." }, 400);
    const p = cfg.speak;
    const q = new URL(request.url).searchParams;
    const voice = q.get("voice")?.trim().slice(0, 100) || (await voiceFor(cfg));
    const chunks: Int16Array[] = [];
    let last = Date.now();
    let speaking: { close(): void } | null = null;
    let over = false;
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`${p.name} didn't finish the line in 15 seconds.`)), 15_000);
        const settle = (error?: Error) => (clearTimeout(timer), error ? reject(error) : resolve());
        speakerFor(p.kind)!
          .speak!.open(fx, p, {
            model: q.get("model")?.trim().slice(0, 100) || cfg.speakModel,
            voice,
            audio: (pcm) => void (chunks.push(pcm), (last = Date.now())),
            // The mark comes from the text's timing, which can run ahead of the last audio: v3's line came back cut at
            // 1.56 seconds of 2.72. So the line ends once its audio has been quiet for half a second.
            mark: () =>
              void (async () => {
                while (Date.now() - last < 500 && !over) await new Promise((r) => setTimeout(r, 100));
                settle();
              })(),
            failed: (why) => settle(new Error(why)),
          })
          .then((s) => (over ? s.close() : ((speaking = s), s.say("Hey, what's up? This is how I sound on a call.", 1))), settle);
      });
    } catch (error) {
      return json({ error: (error as Error).message }, 502);
    } finally {
      over = true;
      (speaking as { close(): void } | null)?.close();
    }
    const all = new Int16Array(chunks.reduce((n, c) => n + c.length, 0));
    chunks.reduce((at, c) => (all.set(c, at), at + c.length), 0);
    return new Response(wav(all), { headers: { "content-type": "audio/wav", "cache-control": "no-store" } });
  });
  fx.route("PUT", "/voice", async (request) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const { listeners, speakers } = await usable();
    const text = (v: unknown, max = 200) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
    const listen = text(body.listenProvider);
    const speak = text(body.speakProvider);
    if (listen && listen !== "device" && !listeners.some((p) => p.id === listen)) return json({ error: "Phone can't listen with that provider." }, 400);
    if (speak && speak !== "device" && !speakers.some((p) => p.id === speak)) return json({ error: "Phone can't speak with that provider." }, 400);
    await fx.sql`insert into voice (listen_provider, listen_model, speak_provider, speak_model, speak_voice)
      values (${listen}, ${text(body.listenModel)}, ${speak}, ${text(body.speakModel)}, ${text(body.speakVoice)})
      on conflict (only_one) do update set listen_provider = excluded.listen_provider, listen_model = excluded.listen_model,
        speak_provider = excluded.speak_provider, speak_model = excluded.speak_model, speak_voice = excluded.speak_voice`;
    return json({ ok: true });
  });

  // After a restart, a call the last process left is over here. The carrier ends it once fxbot's line to it is gone.
  async function sweep() {
    await fx.sql`update calls set status = case when status = 'on' then 'ended' else 'failed' end, ended_at = now(), error = 'fxbot restarted.',
      seconds = extract(epoch from now() - answered_at)::int where status in ('ringing', 'on')`;
    await fx.sql`delete from calls where at < now() - interval '90 days'`;
    await fx.sql`delete from callbacks where until < now()`;
  }
  void sweep().catch((error) => fx.log(`The start's sweep failed: ${error.message}`));

  // Quiet hours, such as 22:00-07:00, in the owner's time zone. A setting that doesn't read means none.
  function quiet() {
    const m = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/.exec(setting("quiet") || "22:00-07:00");
    if (!m) return false;
    const [from, to] = [Number(m[1]) * 60 + Number(m[2]), Number(m[3]) * 60 + Number(m[4])];
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: fx.timeZone(), hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
    const now = Number(parts.find((p) => p.type === "hour")?.value) * 60 + Number(parts.find((p) => p.type === "minute")?.value);
    return from <= to ? now >= from && now < to : now >= from || now < to;
  }

  const askedOff = "The owner turned off calls they ask for, in your Phone section of Settings. Tell them in the chat.";
  fx.tool({
    name: "call",
    description:
      'Call the owner\'s phone, for a live conversation by voice. Call now when the owner asks you to call them. When they ask you to call later, such as "call me when the build is done," ' +
      "call with later: true now, which calls no one and keeps one call-back for 12 hours, and call again without later when it's time. The owner's number is the only one: no tool takes another. " +
      "It answers once the call is answered, or isn't.",
    inputSchema: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description: "Why you're calling, said right after your greeting, such as: The build finished, and 3 tests failed. Up to 300 characters",
        },
        later: { type: "boolean", description: "Keep a call-back for later, and call no one now" },
      },
    },
    idempotent: false,
    async execute(input: { reason?: unknown; later?: unknown }, call) {
      const reason = typeof input.reason === "string" ? input.reason.trim() : "";
      if (reason.length > 300) return "A reason is up to 300 characters.";
      const f = await features(call.bot);
      const theirs = typed.has(call.messageId) || spoken.has(call.messageId) || Boolean(live?.conversation.spoken(call.messageId));
      if (input.later === true) {
        if (!theirs) return "Only the owner keeps a call-back for later, in their chat with you or on a call.";
        if (!f.asked) return askedOff;
        await fx.sql`insert into callbacks (bot, reason, until) values (${call.bot}, ${reason || "the owner asked for a call"}, now() + interval '12 hours')
          on conflict (bot) do update set reason = excluded.reason, until = excluded.until`;
        return "Kept: you can call the owner once in the next 12 hours, without later, when it's time.";
      }
      let why: Why = "asked";
      if (theirs && !f.asked) return askedOff;
      if (!theirs) {
        const [kept] = await fx.sql`select 1 from callbacks where bot = ${call.bot} and until > now()`;
        if (kept && !f.asked) return askedOff;
        const [callback] = kept ? await fx.sql`delete from callbacks where bot = ${call.bot} and until > now() returning reason` : [];
        if (callback) why = "callback";
        else {
          if (!f.own) return "The owner didn't ask for a call. Tell them in the chat, and they can ask you to call.";
          if (quiet()) return "It's the owner's quiet hours, when you don't call on your own. Tell them in the chat.";
          const [{ n }] = await fx.sql<{ n: number }[]>`select count(*)::int as n from calls where bot = ${call.bot} and why = 'own'
            and date_trunc('day', at at time zone ${fx.timeZone()}) = date_trunc('day', now() at time zone ${fx.timeZone()})`;
          if (n >= limit("perDay")) return `You've made ${n} calls on your own today, the most for a day. Tell the owner in the chat.`;
          why = "own";
        }
      }
      if (live?.bot === call.bot) return "You're on a call with the owner now: just tell them.";
      try {
        const result = await ring({ bot: call.bot }, why, reason);
        return result.outcome === "failed" ? `${words.failed}: ${result.error ?? "The provider didn't say why."}` : words[result.outcome];
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
    },
  });

  fx.tool({
    name: "hang_up",
    description: "End the call with the owner, after this reply is spoken. Only once they've said goodbye, or asked you to hang up.",
    inputSchema: { type: "object", properties: {} },
    idempotent: true,
    safe: true,
    // Safe: it can only end the owner's own call, so Permissions doesn't hold it while they drive.
    execute(_input: unknown, call) {
      if (!live || !(live.members ?? [live.bot]).includes(call.bot)) return "You're not on a call.";
      if (!live.conversation.saidBye())
        return "Not hung up: the owner hasn't said goodbye or asked you to hang up, so the call goes on. Don't say goodbye; keep talking with them, or wait for them.";
      live.conversation.hangUpAfter(call.messageId);
      return "Hanging up after this reply.";
    },
  });

  // What the page asks: phone's own settings still missing, the number, and each provider added.
  fx.route("GET", "/status", async () => {
    const pick = await chosen();
    return json({
      missing: phone.test(setting("to")) ? [] : ["to"],
      confirmed: await confirmed(),
      to: setting("to"),
      provider: pick?.name ?? null,
      providers: added()
        .sort((a, b) => (a.name < b.name ? -1 : 1))
        .map(({ name, api, needs }) => {
          const p = api as unknown as Partial<Provider> | null;
          if (needs.line === 3 && typeof p?.sip === "function") return { name, label: p.label, running: true, missing: p.missing!() };
          // A carrier from before phone 0.2.0, which only its update fixes.
          return { name, label: name, running: false, missing: [], old: needs.line !== 3 };
        }),
    });
  });
  fx.route("PUT", "/provider", async (request) => {
    const { provider } = (await request.json().catch(() => ({}))) as { provider?: unknown };
    if (!providers().some((p) => p.name === provider)) return json({ error: "That provider isn't added and running." }, 400);
    await fx.sql`insert into chosen (provider) values (${provider as string}) on conflict (only_one) do update set provider = excluded.provider`;
    return json({ provider });
  });

  fx.route("POST", "/calls", async (request) => {
    const body = (await request.json().catch(() => ({}))) as { bot?: unknown; room?: unknown };
    const target: Target = typeof body.room === "number" ? { room: body.room } : { bot: typeof body.bot === "string" ? body.bot : "" };
    if (target.bot !== undefined) {
      if (!target.bot || !fx.bots.on(target.bot)) return json({ error: "Phone is off for this bot." }, 400);
      if (!(await features(target.bot)).button) return json({ error: "Call me is off for this bot." }, 400);
    }
    const p = target.bot ? await providerOf(await features(target.bot)) : await chosen();
    const problem = await blocked({ phone: p }, await voiceConfig());
    if (problem) return json({ error: problem, missing: Boolean(unready(p)) || !(await confirmed()) }, live || confirming ? 409 : 400);
    // The account now, so a carrier that can't give one says why here.
    const account = await p!.api.sip().catch((error: Error) => error);
    if (!account || account instanceof Error) return json({ error: account instanceof Error ? account.message : `${p!.api.label} has no SIP account yet.` }, 502);
    // It rings in the background: the bar follows it.
    void start(target, { phone: p }, "button").catch((error) => fx.log(`Call me didn't call: ${error.message}`));
    return json({ ok: true }, 202);
  });

  // A bot's or a room's call on the owner's phone, ringing or on, with what its bar shows; why the last one failed, in
  // the last minute; and whether Call me shows. A call in the app is the page's own, which shows it from its socket.
  fx.route("GET", "/calls/live", async (request) => {
    const q = new URL(request.url).searchParams;
    const room = q.has("room") ? Number(q.get("room")) : null;
    const bot = q.get("bot") ?? "";
    const [row] =
      room === null
        ? await fx.sql<Row[]>`select * from calls where bot = ${bot} and room is null and why not in ('confirm', 'talk') order by id desc limit 1`
        : await fx.sql<Row[]>`select * from calls where room = ${room} and why <> 'talk' order by id desc limit 1`;
    const on = row && (row.status === "ringing" || row.status === "on") ? row : null;
    const now = on && live?.id === on.id ? live : null;
    const failed = row && !on && row.error && row.ended_at && Date.now() - new Date(row.ended_at).getTime() < 60_000 ? row.error : "";
    return json({
      call: on
        ? // The call's chat once it has one: its row comes a moment before, while the recap is read.
          { id: on.id, status: on.status, at: on.at, answeredAt: on.answered_at, open: on.session ? `/phone/calls/${on.id}` : null, speaking: Boolean(now?.loop()?.speaking), muted: now?.shown.muted ?? false, who: now?.shown.who ?? "" }
        : null,
      failed,
      button: room === null ? (await features(bot)).button : true,
      // Whether a carrier is added and running, for Call me in the chat's phone.
      lines: providers().length > 0,
    });
  });

  fx.route("POST", "/calls/:id/end", async (_request, { id }) => {
    if (live?.id !== Number(id)) return json({ error: "That call isn't on." }, 404);
    await live.conversation.end();
    return json({ ok: true });
  });
  fx.route("POST", "/calls/:id/mute", async (request, { id }) => {
    const { muted } = (await request.json().catch(() => ({}))) as { muted?: unknown };
    if (typeof muted !== "boolean") return json({ error: "muted is true or false." }, 400);
    if (live?.id !== Number(id)) return json({ error: "That call isn't on." }, 404);
    live.shown.muted = muted;
    live.loop()?.input.muted(muted);
    return json({ muted });
  });

  fx.route("GET", "/calls", async () => {
    const rows = await fx.sql<(Row & { room: number | null })[]>`select * from calls order by id desc limit 20`;
    const names = new Map((await fx.bots.list()).map((bot) => [bot.id, bot.name]));
    const labels = new Map([...providers().map((p) => [p.name, p.api.label] as const), ["app", "In the app"] as const]);
    const rooms = rows.some((row) => row.room !== null) ? new Map(((await fx.need<Rooms>("chat-rooms")?.rooms().catch(() => [])) ?? []).map((r) => [r.id, r.name])) : new Map<number, string>();
    return json(
      rows.map((row) => ({
        ...row,
        name:
          row.why === "confirm"
            ? "Confirming your number"
            : row.room !== null
              ? `${rooms.get(row.room) ?? "A room that's gone"}, a room`
              : (names.get(row.bot) ?? "A bot that's gone"),
        providerLabel: labels.get(row.provider) ?? row.provider,
        chat: Boolean(row.session),
        session: undefined,
      })),
    );
  });

  // One call, for its chat on the right: when, how long, who, and the summary the bot wrote. Its session's lines, from a
  // cursor, as the chat's stream gives them.
  fx.route("GET", "/calls/:id", async (_request, { id }) => {
    const [row] = await fx.sql<Row[]>`select * from calls where id = ${Number(id)}`;
    if (!row) return json({ error: "No such call." }, 404);
    const name =
      row.room === null
        ? ((await fx.bots.list()).find((bot) => bot.id === row.bot)?.name ?? "A bot that's gone")
        : `${((await fx.need<Rooms>("chat-rooms")?.rooms().catch(() => [])) ?? []).find((r) => r.id === row.room)?.name ?? "A room that's gone"}, a room`;
    const { session, ...shown } = row;
    return json({ ...shown, name, chat: Boolean(session) });
  });
  fx.route("GET", "/calls/:id/stream", async (request, { id }) => {
    const [row] = await fx.sql<Row[]>`select * from calls where id = ${Number(id)}`;
    if (!row?.session) return json({ error: "This call has no chat of its own." }, 404);
    const cursor = Number(new URL(request.url).searchParams.get("cursor") ?? 0);
    return new Response(await fx.chats.stream(row.bot, row.session, Number.isInteger(cursor) && cursor >= 0 ? cursor : 0), { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
  });

  // Whether the chosen carrier's SIP account signs in, placing no call (phone-v2, part 2).
  fx.route("POST", "/sip/try", async () => {
    const p = await chosen();
    if (!p) return json({ error: "Phone has no carrier: add one, such as phone-signalwire, from Plugins." }, 400);
    try {
      const account = await p.api.sip();
      if (!account) return json({ error: `${p.api.label} isn't set up: ${p.api.missing().join(", ")}.` }, 400);
      await checkSignIn(account);
      return json({ said: `Signed in to ${account.domain} as ${account.username}.` });
    } catch (error) {
      return json({ error: (error as Error).message }, 502);
    }
  });

  // Confirming the owner's number: a call through the default carrier that plays a code, in the Voice section's voice,
  // which the owner types back.
  fx.route("POST", "/confirm", async () => {
    const p = await chosen();
    const problem = unready(p);
    if (problem || !p) return json({ error: problem }, 400);
    if (live || confirming) return json({ error: "A call is on already." }, 409);
    const cfg = await voiceConfig();
    if (cfg.speak === "device") return json({ error: "Confirming your number needs phone's Voice section to speak with a provider, not This device." }, 400);
    const account = await p.api.sip().catch((error: Error) => error);
    if (!account || account instanceof Error) return json({ error: account instanceof Error ? account.message : `${p.api.label} has no SIP account yet.` }, 502);
    confirming = true;
    const code = String(randomInt(1000, 10000));
    await fx.secrets.set("code", JSON.stringify({ code, to: setting("to"), until: Date.now() + 10 * 60_000 }));
    const spaced = code.split("").join(" ");
    const [{ id }] = await fx.sql<{ id: number }[]>`insert into calls (bot, why, provider) values ('', 'confirm', ${p.name}) returning id::int as id`;
    const voice = await voiceFor(cfg);
    const confirm = onPhone(account, (t) => voiceLine({ transport: t, ear: { way: "device" }, mouth: mouthOf(cfg), voice, log: (l) => fx.log(l) }, { heard: () => {}, played: () => {}, ended: () => {} }));
    void (async () => {
      const result = await confirm.place({ to: setting("to"), greeting: `Your fxbot code is ${spaced}. Again: ${spaced}. Goodbye.`, quiet: true, voice });
      // Answered when it's answered, so the call's length is how long the code took to read.
      if (result.outcome === "answered") await fx.sql`update calls set status = 'on', answered_at = now() where id = ${id}`, await confirm.hangUp();
      await fx.sql`update calls set status = ${result.outcome === "answered" ? "ended" : statusOf[result.outcome]}, error = ${result.error ?? null},
        ended_at = now(), seconds = extract(epoch from now() - answered_at)::int where id = ${id}`;
    })()
      .catch((error) => fx.log(`The confirming call failed: ${error.message}`))
      .finally(() => (confirming = false));
    return json({ ok: true }, 202);
  });

  fx.route("POST", "/confirm/code", async (request) => {
    const { code } = (await request.json().catch(() => ({}))) as { code?: unknown };
    const waiting = JSON.parse((await fx.secrets.get("code")) ?? "null") as { code: string; to: string; until: number } | null;
    if (!waiting || waiting.until < Date.now() || waiting.to !== setting("to")) return json({ error: "No code is waiting: call to confirm again." }, 400);
    if (String(code ?? "").replace(/\D/g, "") !== waiting.code) return json({ error: "That's not the code." }, 400);
    await fx.secrets.set("confirmed", waiting.to);
    await fx.secrets.set("code", null);
    return json({ confirmed: true });
  });

  // A bot's section: what it gets, its carrier, the voices phone's speaker offers, and its open call-back.
  async function section(bot: string) {
    const f = await features(bot);
    const p = await providerOf(f);
    const [callback] = await fx.sql<{ reason: string; until: Date }[]>`select reason, until from callbacks where bot = ${bot} and until > now()`;
    // A bot's voice is one of phone's speaker's, for calls phone carries itself.
    const cfg = await voiceConfig();
    return {
      ...f,
      using: cfg.speak === "device" ? null : { name: cfg.speak.id, label: cfg.speak.name },
      providers: providers().map((x) => ({ name: x.name, label: x.api.label })),
      voices: await voicesOf(cfg),
      callback: callback ?? null,
      perDay: limit("perDay"),
      quiet: setting("quiet") || "22:00-07:00",
    };
  }
  fx.route("GET", "/bots/:bot", async (_request, { bot }) => json(await section(bot)));
  fx.route("PUT", "/bots/:bot", async (request, { bot }) => {
    const body = (await request.json().catch(() => ({}))) as Partial<Record<keyof Features, unknown>>;
    const f = { ...(await features(bot)) };
    for (const name of ["button", "asked", "own"] as const) {
      if (body[name] === undefined) continue;
      if (typeof body[name] !== "boolean") return json({ error: `${name} is true or false.` }, 400);
      f[name] = body[name];
    }
    if (body.provider !== undefined) {
      if (body.provider !== null && !providers().some((p) => p.name === body.provider)) return json({ error: "That provider isn't added and running." }, 400);
      f.provider = body.provider as string | null;
    }
    if (body.voice !== undefined) {
      if (body.voice !== null && !(await voicesOf(await voiceConfig())).some((v) => v.value === body.voice)) return json({ error: "That voice isn't one phone's speaker offers." }, 400);
      f.voice = body.voice as string | null;
    }
    await fx.sql`insert into bots (bot, provider, voice, button, asked, own) values (${bot}, ${f.provider}, ${f.voice}, ${f.button}, ${f.asked}, ${f.own})
      on conflict (bot) do update set provider = excluded.provider, voice = excluded.voice, button = excluded.button, asked = excluded.asked, own = excluded.own`;
    return json(await section(bot));
  });
  fx.route("DELETE", "/bots/:bot/callback", async (_request, { bot }) => {
    await fx.sql`delete from callbacks where bot = ${bot}`;
    return json({ ok: true });
  });

  // Unloading ends a call that's on, and saves how it ended while Postgres is still there: fxbot waits 5 seconds at most
  // for a cleanup, so the hang-up gets 3 of them.
  return async () => {
    const call = live;
    if (!call) return;
    await Promise.race([call.conversation.end(), new Promise((resolve) => setTimeout(resolve, 3000))]);
    await finish(call.id, "fxbot reloaded the plugin.");
  };
}
