import type { Line, LineEvents, Outcome, Place } from "./line.ts";
import { rate, type Heard, type Listener, type Speaking } from "./audio.ts";

// The voice loop (docs/phases/phone-v2.md): a call's Line, made from where the audio goes (the app's socket, or the
// owner's phone over a carrier's SIP account), a listener, and a speaker. call.ts holds the conversation and its rules, as with any line. This hears
// the owner, cuts what a batch listener sends with a voice detector, and speaks the bot's sentences in order, one voice
// at a time, each sentence's mark coming back once the page has played it.

/** Where the call's audio goes: the bot's voice out, as 16 kHz PCM16, a message for the page, and dropping what it holds. */
export type Transport = { audio(pcm: Int16Array): void; send(message: object): void; clear(): void; close(): void };
/** How the owner is heard: a streaming listener, one that takes a stretch at a time, or the page's own speech. */
export type Ear =
  | { way: "stream"; open(heard: (h: Heard) => void, failed: (why: string) => void): Promise<Listener>; turns: boolean }
  | { way: "batch"; run(pcm: Int16Array): Promise<string> }
  | { way: "device" };
/** How the bot is heard: a provider's voice, opened for each voice a call uses, or the page's own speech. */
export type Mouth = { way: "voice"; open(voice: string, o: { audio(pcm: Int16Array): void; mark(n: number): void; failed(why: string): void }): Promise<Speaking> } | { way: "device" };
/** What the page sends the loop. */
export type Input = { audio(pcm: Int16Array): void; played(mark: number): void; heard(h: Heard): void; muted(on: boolean): void };

const frameMs = 20;
// A breath between two voices, as one bot hands on to the next.
const breath = new Int16Array(rate * 0.3);

// Speech against a noise floor that follows the room: a frame well over the floor is voice, and a stretch ends after
// 700 ms below it. The floor rises slowly and falls at once, so steady noise isn't speech.
export function detector() {
  let floor = 200;
  let voiced = 0;
  let quiet = 0;
  return (pcm: Int16Array) => {
    let sum = 0;
    for (const s of pcm) sum += s * s;
    const level = Math.sqrt(sum / Math.max(1, pcm.length));
    const loud = level > Math.max(floor * 3, 300);
    if (!loud) floor = level < floor ? level : floor * 0.995 + level * 0.005;
    if (loud) (voiced += frameMs), (quiet = 0);
    else if (voiced) quiet += frameMs;
    const ended = voiced > 0 && quiet >= 700;
    const was = voiced;
    if (ended) (voiced = 0), (quiet = 0);
    return { speaking: voiced > 0 && quiet < 700, voicedMs: voiced, ended, stretchMs: ended ? was : 0 };
  };
}

export function voiceLine(o: { transport: Transport; ear: Ear; mouth: Mouth; voice: string; log(line: string): void }, events: LineEvents) {
  const { transport, ear, mouth } = o;
  let over = false;
  let answered = false;
  let muted = false;
  // The sentences said, by mark: their text, voice, and whether their audio is out. A mark goes once the page played it.
  let next = 0;
  const said = new Map<number, { text: string; voice: string; out: boolean }>();
  const waiting: { text: string; voice: string; mark: number; who?: string }[] = [];
  // Who speaks now, in a room, for the page to show.
  let showing = "";
  // The voice speaking now and its open speakers, one for each voice the call has used.
  let current = "";
  const speakers = new Map<string, Promise<Speaking>>();
  let listener: Listener | null = null;
  const sense = detector();
  let batch: Int16Array[] = [];
  let before: Int16Array[] = [];
  const done = new Set<() => void>();
  // Why the call ends, when the loop ends it itself: the call's row keeps it.
  let why = "";

  function failed(reason: string) {
    o.log(reason);
    if (over) return;
    why ||= reason;
    void self.hangUp(true);
  }

  function speaker(voice: string) {
    if (!speakers.has(voice) && mouth.way === "voice")
      speakers.set(
        voice,
        mouth.open(voice, {
          audio: (pcm) => !over && current === voice && transport.audio(pcm),
          mark(n) {
            const s = said.get(n);
            if (!s || over) return;
            s.out = true;
            transport.send({ mark: n });
            pump();
          },
          failed: (why) => failed(`The voice stopped: ${why}`),
        }),
      );
    return speakers.get(voice)!;
  }

  // Sends what waits, in order. Another voice waits for the one speaking to have all its audio out, then a breath.
  function pump() {
    if (over || !answered) return;
    while (waiting.length) {
      const item = waiting[0];
      if (mouth.way === "device") {
        waiting.shift();
        said.get(item.mark)!.out = true;
        transport.send({ say: item.mark, text: item.text, voice: item.voice });
        continue;
      }
      if (current && item.voice !== current && [...said.values()].some((s) => s.voice === current && !s.out)) return;
      if (current && item.voice !== current) transport.audio(breath);
      current = item.voice;
      waiting.shift();
      if (item.who && item.who !== showing) transport.send({ who: (showing = item.who) });
      void speaker(item.voice).then(
        (s) => (over ? undefined : s.say(item.text, item.mark)),
        (error) => failed(`The voice didn't open: ${error instanceof Error ? error.message : error}`),
      );
    }
    if (!self.speaking) for (const resolve of done) resolve();
  }

  function heard(h: Heard) {
    if (over || muted) return;
    if (h.type === "partial") events.hearing?.(h.text);
    else if (h.text.trim()) events.heard(h.text.trim());
  }

  const input: Input = {
    audio(pcm) {
      if (over || muted || !answered) return;
      const sensed = sense(pcm);
      if (ear.way === "stream") listener?.write(pcm);
      if (ear.way !== "batch") return;
      // A batch listener has no words as they come, so the owner's voice itself says they're speaking.
      if (sensed.speaking) events.voice?.(sensed.voicedMs);
      // A batch listener gets each stretch, with 300 ms from before it began.
      if (sensed.speaking) {
        if (!batch.length) batch.push(...before);
        batch.push(pcm);
      }
      before = [...before.slice(-14), pcm];
      if (sensed.ended && batch.length) {
        const stretch = batch.splice(0);
        const all = new Int16Array(stretch.reduce((n, p) => n + p.length, 0));
        let at = 0;
        for (const p of stretch) (all.set(p, at), (at += p.length));
        if (sensed.stretchMs < 250) return;
        void ear.run(all).then(
          (text) => text && heard({ type: "final", text }),
          (error) => o.log(`Listening failed for a stretch: ${error instanceof Error ? error.message : error}`),
        );
      }
    },
    played(mark) {
      // What played to the end: this mark, and any before it the page skipped.
      for (const [n, s] of said) {
        if (n > mark) break;
        said.delete(n);
        events.played(s.text);
      }
      pump();
    },
    heard: (h) => ear.way === "device" && heard(h),
    muted(on) {
      muted = on;
    },
  };

  const self: Line & { input: Input; ends: boolean; fail(why: string): void } = {
    async place(call: Place) {
      // A call that only speaks, such as a number's code, opens no listener.
      if (ear.way === "stream" && !call.quiet) listener = await ear.open(heard, (why) => failed(`Listening stopped: ${why}`));
      answered = true;
      transport.send({ state: "on" });
      if (call.greeting) self.say(call.greeting, call.voice);
      return { outcome: "answered" as Outcome };
    },
    say(text: string, voice?: string, who?: string) {
      if (over || !text.trim()) return;
      const mark = ++next;
      const v = voice || o.voice;
      said.set(mark, { text: text.trim(), voice: v, out: false });
      waiting.push({ text: text.trim(), voice: v, mark, ...(who ? { who } : {}) });
      pump();
    },
    stop() {
      waiting.length = 0;
      for (const s of speakers.values()) void s.then((sp) => sp.clear(), () => {});
      transport.clear();
      said.clear();
      current = "";
      pump();
    },
    async hangUp(now = false) {
      if (over) return;
      if (!now && self.speaking) await new Promise<void>((resolve) => (done.add(resolve), setTimeout(resolve, 30_000)));
      over = true;
      listener?.close();
      for (const s of speakers.values()) void s.then((sp) => sp.close(), () => {});
      transport.send({ ended: why || "hung up" });
      transport.close();
      events.ended(why || "hung up");
    },
    get speaking() {
      return waiting.length > 0 || said.size > 0;
    },
    // A listener that ends the owner's turns itself: the call holds nothing more.
    get ends() {
      return ear.way === "stream" && ear.turns;
    },
    input,
    // Where the audio goes ended the call, and why.
    fail: (why) => failed(why),
  };
  return self;
}
