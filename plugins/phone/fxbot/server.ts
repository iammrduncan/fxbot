import { randomInt } from "node:crypto";
import type { PluginApi } from "@fxbot/sdk";
import { conversation, type Conversation } from "./call.ts";
import type { Outcome, Provider } from "./line.ts";
import { voicesFor, type Rooms } from "./room.ts";
import { adapters, listenerFor, speakerFor, type Added, type Voice as Spoken } from "./speech.ts";
import { listen as fromPage, transport } from "./talk.ts";
import { voiceLine, type Ear, type Input, type Mouth } from "./voice.ts";

// phone: a bot rings the owner's own phone, and they talk, with the bot's own turn deciding everything
// (docs/_completed/phases/phone.md). This holds the call: Call me, the tools, who may call and when, the owner's number, the conversation, and
// the last calls. A provider plugin, such as phone-signalwire, carries it: it needs phone with { "line": 2 } and offers
// a Provider (line.ts). The owner starts a call with Call me; a bot starts one when the owner asked, on a call-back they
// gave, or on its own when the owner allowed that.

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
};
// What a bot gets. A provider or voice of null is the default's.
type Features = { provider: string | null; voice: string | null; button: boolean; asked: boolean; own: boolean };
// line is the contract the provider speaks: 2, or the older 1, where the provider decides what cuts the bot off.
type Found = { name: string; api: Provider; line: number };

const limits = { minutes: [5, 120, 30], perDay: [1, 20, 3], pause: [1, 5, 2] } as const;
const phone = /^\+[1-9]\d{6,14}$/;
const json = (body: unknown, status = 200) => Response.json(body, { status });
const finished = (text: string) => (/[.!?…]$/.test(text) ? text : `${text}.`);
const words: Record<Outcome, string> = {
  answered: "Answered.",
  voicemail: "It went to voicemail, and I left the reason.",
  missed: "Not answered after 30 seconds of ringing.",
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

  // The providers: the plugins that need phone with { "line": 2 } or { "line": 1 }, added, and the ones of them running
  // now, by name.
  const added = () => fx.dependents().filter((d) => d.needs.line === 1 || d.needs.line === 2);
  const providers = (): Found[] =>
    added()
      .filter((d) => typeof (d.api as Partial<Provider> | null)?.line === "function")
      .map((d) => ({ name: d.name, api: d.api as unknown as Provider, line: Number(d.needs.line) }))
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

  // The one call at a time: its row, its bot, and its conversation. A call that confirms the owner's number counts too.
  // A call in the app or a room keeps the bots who may hang it up: in a room, any of its bots.
  let live: { id: number; bot: string; conversation: Conversation; members?: string[] } | null = null;
  let confirming = false;

  // A call's end. The owner or the bot hanging up, a voicemail left, and the call's length are how calls end; anything
  // else is kept as its error.
  async function finish(id: number, how: string) {
    const error = ["hung up", "left a voicemail", "max_duration", "The app closed the call."].includes(how) ? null : how;
    await fx.sql`update calls set status = case when status in ('ringing', 'on') then 'ended' else status end, ended_at = coalesce(ended_at, now()),
      seconds = coalesce(seconds, extract(epoch from now() - answered_at)::int), error = coalesce(error, ${error}) where id = ${id}`;
    if (live?.id === id) live = null;
  }

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

  // A call in the app: the page's socket, for a bot, or a chat room's bots. It's a call as phone's others are, with its
  // row, its limits, and one call at a time, carried by phone's own voice loop.
  async function talk(socket: Parameters<Parameters<typeof fx.socket>[1]>[0], target: { bot?: string; room?: number }) {
    const refuse = (why: string) => (socket.send(JSON.stringify({ ended: why })), socket.close(1000, why.slice(0, 100)));
    if (live || confirming) return refuse("A call is on already.");
    const cfg = await voiceConfig();
    let bot = target.bot ?? "";
    let name = "";
    let room: Parameters<typeof conversation>[1]["room"];
    if (target.room !== undefined) {
      const rooms = fx.need<Rooms>("chat-rooms");
      if (!rooms?.post || !rooms.on || !rooms.stop) return refuse("A call in a room needs chat rooms 0.6.0 or newer.");
      const found = (await rooms.rooms()).find((r) => r.id === target.room);
      if (!found?.members.length) return refuse("That room has no bots.");
      const all = await fx.bots.list();
      const names = new Map(found.members.map((id) => [id, all.find((b) => b.id === id)?.name ?? "A bot"]));
      const own = new Map((await fx.sql<{ bot: string; voice: string | null }[]>`select bot, voice from bots where bot in ${fx.sql(found.members)}`).map((r) => [r.bot, r.voice]));
      const voices = voicesFor(found.members, own, (await voicesOf(cfg)).map((v) => v.value), await voiceFor(cfg));
      bot = found.members[0];
      name = names.get(bot)!;
      room = { id: found.id, rooms, names, voices, lead: bot };
    } else {
      if (!bot || !fx.bots.on(bot)) return refuse("Phone is off for this bot.");
      name = (await fx.bots.get(bot)).name;
    }
    if (live || confirming) return refuse("A call is on already.");
    const [{ id }] = await fx.sql<{ id: number }[]>`insert into calls (bot, why, provider, status, answered_at, room)
      values (${bot}, 'talk', 'app', 'on', now(), ${room?.id ?? null}) returning id::int as id`;
    const voice = room ? room.voices.get(bot)! : await voiceFor(cfg, bot);
    let input: Input | null = null;
    const greeting = "Hey, what's up?";
    const call = conversation(fx, {
      bot,
      name,
      greeting,
      minutes: limit("minutes"),
      pause: limit("pause") * 1000,
      id,
      open: (events) => {
        const line = voiceLine({ transport: transport(socket), ear: earOf(cfg, room ? [...room.names.values()] : [name]), mouth: mouthOf(cfg), voice, log: (l) => fx.log(l) }, events);
        input = line.input;
        return line;
      },
      turns: true,
      app: true,
      effort: callEffort(),
      room,
      onSpoken: (turn) => void spoken.add(turn),
      onEnd: (how) => void finish(id, how).catch((error) => fx.log(`Call ${id} didn't save its end: ${error.message}`)),
    });
    live = { id, bot, conversation: call, members: room ? [...room.names.keys()] : [bot] };
    fromPage(socket, () => input, () => void call.end());
    // The page says what it can do with This device: listening, in its own browser, or not.
    socket.send(JSON.stringify({ state: "starting", listen: cfg.listen === "device" ? "device" : "server", speak: cfg.speak === "device" ? "device" : "server", google: setting("googleListening") === "on" }));
    const result = await call.place({ to: "", greeting, voice });
    if (result.outcome !== "answered") await finish(id, result.error ?? "The call didn't start.");
  }
  fx.socket("/talk/:bot", (socket, _request, { bot }) => void talk(socket, { bot }).catch((error) => (fx.log(`A call in the app failed: ${error.message}`), socket.close(1011, "The call failed."))));
  fx.socket("/talk/room/:room", (socket, _request, { room }) => void talk(socket, { room: Number(room) }).catch((error) => (fx.log(`A room's call failed: ${error.message}`), socket.close(1011, "The call failed."))));

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

  // Places a call to the owner's phone and answers once they answer, or don't. A refusal throws, in words for a bot.
  async function place(bot: string, why: Why, reason = "") {
    const f = await features(bot);
    const p = await providerOf(f);
    const problem = unready(p);
    if (problem || !p) throw new Error(problem);
    if (!(await confirmed())) throw new Error("The owner's number isn't confirmed yet.");
    if (live) throw new Error(live.bot === bot ? "You're on a call with the owner now: just tell them." : "A call is on already, and there's one at a time.");
    if (confirming) throw new Error("The owner is confirming their number on a call now.");
    const { name } = await fx.bots.get(bot);
    const told = reason ? finished(reason.trim()) : "";
    const greeting = why === "button" ? `Hey, this is your fxbot ${name}. How can I help today?` : `Hey, this is your fxbot ${name}. ${told}`.trim();
    const voicemail = why === "button" ? undefined : `Hi, it's ${name} from fxbot. ${told} Talk to me in the app anytime.`.replace(/\s+/g, " ");
    // The bot's voice, while its provider still offers it, or the provider's own.
    const voice = f.voice && p.api.voices().some((v) => v.value === f.voice) ? f.voice : undefined;
    const [{ id }] = await fx.sql<{ id: number }[]>`insert into calls (bot, why, reason, provider) values (${bot}, ${why}, ${reason || null}, ${p.name}) returning id::int as id`;
    const call = conversation(fx, {
      bot,
      name,
      greeting,
      minutes: limit("minutes"),
      pause: limit("pause") * 1000,
      id,
      open: (events) => p.api.line(events),
      turns: p.line === 2,
      onSpoken: (turn) => void spoken.add(turn),
      onEnd: (how) => void finish(id, how).catch((error) => fx.log(`Call ${id} didn't save its end: ${error.message}`)),
    });
    live = { id, bot, conversation: call };
    const result = await call.place({ to: setting("to"), greeting, voicemail, hints: [name], ...(voice ? { voice } : {}) });
    await fx.sql`update calls set status = ${statusOf[result.outcome]}, error = ${result.error ?? null},
      answered_at = ${result.outcome === "answered" || result.outcome === "voicemail" ? fx.sql`now()` : null},
      ended_at = ${result.outcome === "answered" ? null : fx.sql`now()`} where id = ${id} and ended_at is null`;
    if (result.outcome !== "answered" && live?.id === id) live = null;
    return { id, ...result };
  }

  // After a restart, a call the last process left is over here. Its provider ends it at the service, if it's still up.
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
      try {
        const result = await place(call.bot, why, reason);
        return result.outcome === "failed" ? `${words.failed}: ${result.error ?? "The provider didn't say why."}` : words[result.outcome];
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
    },
  });

  fx.tool({
    name: "hang_up",
    description: "End the call with the owner, after this reply is spoken. Use it once they've said goodbye, or asked you to hang up.",
    inputSchema: { type: "object", properties: {} },
    idempotent: true,
    safe: true,
    // Safe: it can only end the owner's own call, so Permissions doesn't hold it while they drive.
    execute(_input: unknown, call) {
      if (!live || !(live.members ?? [live.bot]).includes(call.bot)) return "You're not on a call.";
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
        .map(({ name, api }) => {
          const p = api as unknown as Provider | null;
          return typeof p?.line === "function" ? { name, label: p.label, running: true, missing: p.missing() } : { name, label: name, running: false, missing: [] };
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
    const { bot } = (await request.json().catch(() => ({}))) as { bot?: unknown };
    if (typeof bot !== "string" || !fx.bots.on(bot)) return json({ error: "Phone is off for this bot." }, 400);
    const f = await features(bot);
    if (!f.button) return json({ error: "Call me is off for this bot." }, 400);
    const problem = unready(await providerOf(f));
    if (problem) return json({ error: problem, missing: true }, 400);
    if (!(await confirmed())) return json({ error: "Confirm your number first, in Settings › Plugins › phone." }, 400);
    if (live || confirming) return json({ error: "A call is on already." }, 409);
    // It rings in the background: the bar follows it.
    void place(bot, "button").catch((error) => fx.log(`Call me didn't call: ${error.message}`));
    return json({ ok: true }, 202);
  });

  // The bot's call ringing or on, and whether its Call me shows.
  fx.route("GET", "/calls/live", async (request) => {
    const bot = new URL(request.url).searchParams.get("bot") ?? "";
    // A call in the app is the page's own, which shows it from its socket.
    const [row] = await fx.sql<Row[]>`select * from calls where bot = ${bot} and why not in ('confirm', 'talk') and status in ('ringing', 'on') order by id desc limit 1`;
    // lines: whether a plugin that carries phone lines is added and running, for Call me in the chat's phone.
    return json({ call: row ? { id: row.id, status: row.status, at: row.at, answeredAt: row.answered_at } : null, button: (await features(bot)).button, lines: added().some((d) => d.api !== null) });
  });

  fx.route("POST", "/calls/:id/end", async (_request, { id }) => {
    if (live?.id !== Number(id)) return json({ error: "That call isn't on." }, 404);
    await live.conversation.end();
    return json({ ok: true });
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
      })),
    );
  });

  // Confirming the owner's number: a call through the default provider that plays a code, which the owner types back.
  fx.route("POST", "/confirm", async () => {
    const p = await chosen();
    const problem = unready(p);
    if (problem || !p) return json({ error: problem }, 400);
    if (live || confirming) return json({ error: "A call is on already." }, 409);
    confirming = true;
    const code = String(randomInt(1000, 10000));
    await fx.secrets.set("code", JSON.stringify({ code, to: setting("to"), until: Date.now() + 10 * 60_000 }));
    const spaced = code.split("").join(" ");
    const [{ id }] = await fx.sql<{ id: number }[]>`insert into calls (bot, why, provider) values ('', 'confirm', ${p.name}) returning id::int as id`;
    const confirm = p.api.line({ heard: () => {}, interrupted: () => {}, played: () => {}, ended: () => {} });
    void (async () => {
      const result = await confirm.place({ to: setting("to"), greeting: `Your fxbot code is ${spaced}. Again: ${spaced}. Goodbye.`, quiet: true });
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

  // A bot's section: what it gets, its provider and the voices that provider offers, and its open call-back.
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
      // A voice is its provider's, so another provider starts from its own.
      if (body.provider !== f.provider) f.voice = null;
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
