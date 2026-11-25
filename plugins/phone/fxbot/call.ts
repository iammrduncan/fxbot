import type { PluginApi } from "@fxbot/sdk";
import type { Line, LineEvents, Outcome, Place } from "./line.ts";
import { roomNote, spoken, tagged, type Rooms, type RoomEvent } from "./room.ts";

// A call's conversation (docs/phases/phone-v3.md). It names no phone service: it holds the call through a provider's
// line. A call is a side conversation: what the owner says goes to the call's own session, a session of phone's for the
// bot, joining a turn that's running, and every reply there is spoken while the call lasts, sentence by sentence, made
// fit to hear. The bot's instructions there say how to talk on a call (server.ts adds them, only while it's on), and
// what's recent in its main chat. A room's call speaks in its call room.

type StreamLine = {
  type: string;
  messageId?: string;
  id?: string;
  delta?: string;
  sessionId?: string;
  input?: unknown;
  text?: string;
  from?: string;
  cursor?: number;
  pill?: { label: string; text?: string; from: string; inContext?: boolean };
};
export type Conversation = {
  /** Rings the owner, and answers once they answer or don't. */
  place(call: Place): Promise<{ outcome: Outcome; error?: string }>;
  /** Whether this turn is one the owner's words on this call started or joined. */
  spoken(turn: string): boolean;
  /** How many times the owner's words went to the bot. */
  said(): number;
  /** A turn's text once it ends, read from the call's own reader, after the turns running in the session have ended:
   * opening and closing readers on a session as a turn starts raced libfx (phone-v3). Up to 3 minutes. */
  answer(messageId: string, send: () => Promise<unknown>): Promise<string>;
  /** Closes the call's reader, after its wrap-up. */
  close(): void;
  /** Ends the call once this turn ends and its last words have played. */
  hangUpAfter(turn: string): void;
  /** Ends the call at once. */
  end(): Promise<void>;
};
type Options = {
  bot: string;
  name: string;
  /** What the owner heard when they answered, which the bot's first message quotes. */
  greeting: string;
  minutes: number;
  /** The plugin's id for the call, which names the messages it sends. */
  id: number;
  /** The call's own session for the bot, where what the owner says goes. A room's call has its call room instead. */
  session: string;
  open: (events: LineEvents) => Line;
  /** A line 2: the call decides what cuts the bot off, from the words as they come. */
  turns: boolean;
  /** How long, in ms, the owner may go quiet before what they said goes to the bot. */
  pause: number;
  /** A turn the owner's words joined or started, for the plugin to count as theirs. */
  onSpoken: (turn: string) => void;
  onEnd: (how: string) => void;
  /** A call in the app, which the owner opened: its own note. */
  app?: boolean;
  /** How hard a call's turns think, as fx.chats.send's effort, or none for the bot's own. */
  effort?: string;
  /** A call in a chat room: the room's bots answer, each in its own voice, one at a time. */
  /** A room's call: its call room, `id`, and the room it's for, `parent`. */
  room?: { id: number; rooms: Rooms; names: Map<string, string>; voices: Map<string, string>; lead: string; parent?: number };
};

const label = "your call";
const floorWords = /^(?:wait|hold on|hang on|one (?:sec|second|moment)|sorry)[.!,]*$/i;
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const wordsOf = (text: string) => text.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? [];
// A heard word is a said one when they're equal, or both have 4 letters or more and are one edit apart, two letters
// swapped counting as one: the recognizer hears the bot's own voice back a little wrong, as "quite" for "quiet" on
// 2026-11-25, which cut it off after one word.
export function alike(a: string, b: string) {
  if (a === b) return true;
  if (a.length < 4 || b.length < 4 || Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  const [x, y] = [a.slice(i), b.slice(i)];
  return x.slice(1) === y.slice(1) || x.slice(1) === y || x === y.slice(1) || (x[0] === y[1] && x[1] === y[0] && x.slice(2) === y.slice(2));
}
// How many of these words come in that order in what was said. An echo is the bot's words as it said them; the owner
// answering may use the same words in another order, as "hold on so you can't hear me" did on 2026-11-25, after the bot
// said "it can't hear you while it's talking, so you have to wait... when you say hold on".
function inOrder(words: string[], said: string[]) {
  let row: number[] = new Array(said.length + 1).fill(0);
  for (const word of words) {
    const next = [0];
    for (let j = 1; j <= said.length; j++) next[j] = alike(word, said[j - 1]) ? row[j - 1] + 1 : Math.max(row[j], next[j - 1]);
    row = next;
  }
  return row[said.length];
}
// How the bot talks on a call (docs/phases/phone-v3.md, the sidekick): in its own words at once, and longer work in the
// background, so the conversation never waits. It's in the bot's instructions for the call's session while the call is
// on, and never a message.
const sidekick =
  "Talk like a person on a call: short spoken sentences, with no lists, tables, links, code, or markdown. " +
  'Before you use a tool, first say in a few natural words what you\'re doing, such as "Oh, let me check that.", so the owner hears you at once. ' +
  "One quick look, a single tool call, you may do yourself. Anything more, such as reading what you found, digging, work on your computer, a herdr agent's task, or a second tool call, hand to a subagent with subagents_start, with all it needs, then come straight back to the owner and keep talking about anything they like. Never make them wait on it. " +
  "When a subagent tells you something or reports, say what matters, briefly. When the owner asks how it's going, check with subagents_list or herdr's agents, and don't guess. Without subagents, keep each turn short, and say so if a task will take a while.";
/** A room call's instructions, for each bot's session in the call room, while it's on. */
export const roomCallNote = `${roomNote} ${sidekick}`;
/** The bot's instructions for a call's session, while it's on. */
export const callNote = (greeting: string, app = false) =>
  app
    ? `You're in a voice chat with the owner in the app: they opened it, and you said "${greeting}" What they say comes to you as text, and what you write is read out to them. ${sidekick} Anything that needs their OK shows on their screen. When they're done, say goodbye and use phone_hang_up.`
    : `You're on a live phone call with the owner, who may be driving. You called them and said: "${greeting}" What they say comes to you as text, and what you write is read out to them. ${sidekick} Anything that needs their OK shows on their screen, which they can't look at while driving. When they're done, say goodbye and use phone_hang_up.`;

// NDJSON lines from a stream of bytes, until it ends or is cancelled.
export async function* lines(reader: ReadableStreamDefaultReader<Uint8Array>) {
  const decoder = new TextDecoder();
  let rest = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return;
    const parts = (rest + decoder.decode(value, { stream: true })).split("\n");
    rest = parts.pop()!;
    for (const part of parts) if (part) yield JSON.parse(part) as StreamLine;
  }
}

// Text made fit to hear: a link is its words, or "a link in the chat", and markdown's marks go.
const clean = (text: string) =>
  text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "a link in the chat")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/^\s{0,3}(?:#{1,6}|>|[-*+]|\d+[.)])\s+/, "")
    .replace(/\*\*|__|~~|\*/g, "")
    .trim();

// Sentences that end in this text, and what's left. A piece with no letter, such as a list's "1.", waits for the rest.
function sentences(text: string, ended: boolean) {
  const out: string[] = [];
  let start = 0;
  for (const m of text.matchAll(/[.!?…]["')\]]*(?=\s)/g)) {
    const end = m.index + m[0].length;
    const piece = text.slice(start, end).trim();
    if (/\p{L}/u.test(piece)) (out.push(piece), (start = end));
  }
  let left = text.slice(start);
  if (ended && left.trim()) (out.push(left.trim()), (left = ""));
  return { out, left };
}

// A turn's reply, as it arrives: each sentence as soon as it ends, made fit to hear. A code block or table is said once,
// as "There's more in the chat."
export function speech() {
  let rest = "";
  let fence = false;
  let more = false;
  const moreOnce = () => (more ? [] : ((more = true), ["There's more in the chat."]));
  function whole(text: string): string[] {
    if (/^\s*```/.test(text)) return ((fence = !fence), moreOnce());
    if (fence) return [];
    if (/^\s*\|/.test(text)) return moreOnce();
    return sentences(clean(text), true).out;
  }
  return {
    push(delta: string) {
      rest += delta;
      const parts = rest.split("\n");
      rest = parts.pop()!;
      const out = parts.flatMap(whole);
      // The line still arriving gives its finished sentences too, unless it may be code or a table.
      if (!fence && !/^\s*[`|]/.test(rest)) {
        const found = sentences(rest, false);
        if (found.out.length) ((rest = found.left), out.push(...found.out.map(clean).filter(Boolean)));
      }
      return out;
    },
    flush() {
      const text = rest;
      rest = "";
      return whole(text);
    },
  };
}

export function conversation(fx: PluginApi, o: Options): Conversation {
  // "Stop", alone or with the bot's name, "okay", or "please", stops the call's work. "Don't stop" doesn't.
  const stopWords = new RegExp(`^(?:(?:okay|ok|hey|no|${escape(o.name)}),?\\s+)?(?:stop|cancel|never ?mind)(?:,?\\s+(?:okay|ok|please|now))?[.!]*$`, "i");
  const sent = new Set<string>();
  const started = new Set<string>();
  const ours = new Set<string>();
  const running = new Set<string>();
  const tools = new Map<string, string>();
  const speeches = new Map<string, ReturnType<typeof speech>>();
  let count = 0;
  // A call's ids carry when it began: libfx skips an id a chat already holds, and a call's row id comes round again
  // when the table starts over, as it did when phone-signalwire's calls moved to phone.
  const stamp = Date.now().toString(36);
  let begun = false;
  let following = false;
  const stopFollowing = new AbortController();
  // The turn spoken last; what's been said and not yet played, in order, with whose turn it is, so the first is the one
  // being heard (in a room the next bot's words are said ahead while one speaks); and what of each turn has played.
  let speaking = "";
  let unplayed: { text: string; turn: string }[] = [];
  const heardOf = new Map<string, string>();
  let lastHeard = "";
  let muted = "";
  let cutAfter: string | null = null;
  let saidAt = Date.now();
  let heardAt = Date.now();
  let goodbyeAfter = "";
  let over = false;
  const timers: NodeJS.Timeout[] = [];
  // What the bot said that's playing or waiting to, and what stopped playing, with when: for telling its own voice coming
  // back from the owner's words (echoed). The greeting plays through: on a line 2, nothing said cuts it but "stop".
  let airing: string[] = [];
  let aired: { text: string; end: number }[] = [];
  let greeting = true;
  // When the words heard now began, as their first partial came, on a line 2.
  let began = 0;
  // What the owner said, held until they've been quiet for o.pause, so a stumble or a thought mid-sentence doesn't end
  // it: words after a shorter pause join it. When their words last sounded, and when any last reached the call.
  let held: string[] = [];
  let lastWords = 0;
  let talked = 0;
  let release: NodeJS.Timeout | undefined;
  // A room's call: each bot's reply as it's said, how much of its text was taken, the bots cut off, and who was.
  const saying = new Map<string, { taken: number; words: ReturnType<typeof speech> }>();
  const quieted = new Set<string>();
  let cutOff = "";
  let cutOthers: string[] = [];

  const line = o.open({
    hearing: (text) => void (o.turns && hearing(text)),
    heard: (text) => void (owners(text) && take(text)),
    interrupted: () => interrupted(),
    played: (text) => {
      const i = unplayed.findIndex((u) => u.text === text.trim());
      const turn = i >= 0 ? unplayed.splice(0, i + 1).at(-1)!.turn : speaking;
      heardOf.set(turn, `${heardOf.get(turn) ?? ""} ${text}`.trim());
      lastHeard = turn;
      saidAt = Date.now();
      offAir(text);
    },
    ended: (how) => finish(how),
    // A listener with no words as they come: 700 ms of the owner's voice over the bot cuts it off, after the greeting.
    voice: (ms) => void (o.turns && ms >= 700 && line.speaking && !greeting && (logCut(`${ms} ms of voice`), stop(), interrupted())),
  });

  // The owner is speaking: words as they come, a final within the last moment, or words held for the pause. Mid-words is
  // the first and last of those, without the moment after a final, which an answer to their words doesn't wait out.
  const talking = () => began > 0 || Date.now() - talked < 1200 || held.length > 0;
  const midWords = () => began > 0 || held.length > 0;
  // Nothing the bot says starts over the owner: what isn't an answer to their words, such as a subagent's report, and
  // since phone-v3 an answer to their earlier words too, waits while they speak, for their pause. On the owner's first
  // real call, the answer to "What's going on in the lab?" began 2 seconds into their next words, and was cut off.
  const later: [string, string, string | undefined][] = [];
  let waitingFor: NodeJS.Timeout | undefined;
  function hold() {
    clearTimeout(waitingFor);
    if (over || !later.length) return;
    if (later.some(([, turn]) => !ours.has(turn)) ? talking() : midWords()) return void (waitingFor = setTimeout(hold, 300));
    for (const [text, turn, voice] of later.splice(0)) say(text, turn, voice);
  }
  function say(text: string, turn = "", voice?: string) {
    if (turn && !o.room && ((ours.has(turn) ? midWords() : talking()) || later.length)) return (later.push([text, turn, voice]), hold());
    if (turn && turn !== speaking) ((speaking = turn), heardOf.delete(turn));
    saidAt = Date.now();
    if (text.trim()) (airing.push(text.trim()), unplayed.push({ text: text.trim(), turn }));
    line.say(text, voice, turn.startsWith("room-") ? turn.slice(5) : undefined);
  }

  // The bot cut off, by the call or by a line 1 provider: what was playing stopped, and what waited was dropped.
  function interrupted() {
    muted = speaking;
    speeches.delete(muted);
    // Who was being heard: the first turn not yet played through, or the last that played.
    const who = unplayed[0]?.turn ?? lastHeard;
    cutAfter = heardOf.get(who) ?? "";
    const nameOf = (turn: string) => (turn.startsWith("room-") ? (o.room?.names.get(turn.slice(5)) ?? "") : "");
    cutOff = nameOf(who);
    // In a room, every reply being said is dropped: the owner's next words replace the room's queue.
    cutOthers = [...new Set([...unplayed.map((u) => u.turn), ...[...saying.keys()].map((bot) => `room-${bot}`)])].filter((turn) => turn !== who).map(nameOf).filter(Boolean);
    unplayed = [];
    for (const bot of saying.keys()) quieted.add(bot);
    offAir();
  }
  function stop() {
    line.stop();
    offAir();
  }
  // What the bot said leaves the air as it plays to the end, or all at once when the line stops. The first to leave is
  // the greeting.
  function offAir(text?: string) {
    const now = Date.now();
    const gone = text === undefined ? airing : airing.filter((said) => text.includes(said));
    airing = airing.filter((said) => !gone.includes(said));
    aired = [...aired.filter((a) => now - a.end < 60_000), ...gone.map((said) => ({ text: said, end: now }))];
    greeting = false;
  }

  // Whether words heard are the bot's own voice coming back, as from a phone on speaker or a watch: most of them are, in
  // order, what was playing as they began, or had stopped up to 1.5 seconds before, the echo's way back. The recognizer gives
  // words a second or more after their sound, so an echo comes after its line ended, or while the next one plays: on
  // 2026-11-24 the greeting's echo, "hey this is", reached the bot as the owner's words.
  function echoed(text: string, at: number) {
    if (!line.speaking && airing.length) offAir();
    const said = [...aired.filter((a) => a.end + 1500 > at).map((a) => a.text), ...airing].flatMap(wordsOf);
    const words = wordsOf(text);
    return words.length > 0 && inOrder(words, said) / words.length >= 0.6;
  }
  // On a line 2, two words of the owner's while the bot speaks cut it off, after the greeting. One may be a cough.
  function cutIn(text: string) {
    if (o.turns && line.speaking && !greeting && wordsOf(text).length >= 2) (logCut(text), stop(), interrupted());
  }
  // Each cut says what cut the bot off and what it was saying, to tell a misheard echo from the owner on real calls.
  const logCut = (heard: string) => fx.log(`Call ${o.id}: cut ${o.name} off on hearing "${heard.slice(0, 80)}", while saying "${(airing[0] ?? "").slice(0, 80)}"`);
  // Words as they come, on a line 2.
  function hearing(text: string) {
    if (!began) began = Date.now();
    if (echoed(text, began)) return;
    lastWords = talked = Date.now();
    cutIn(text);
  }
  // Words finished: whether they're the owner's, to send. They began at their first partial, or with only a final,
  // about a second of silence and half a second a word before it. The log says each echo dropped, and how long after
  // its line, for tuning the 1.5 seconds on real calls.
  function owners(text: string) {
    const dated = began > 0;
    const at = dated ? began : Date.now() - 1000 - 500 * wordsOf(text).length;
    began = 0;
    // Words a final alone brought sounded last about a second before it, the recognizer's own wait.
    if (!echoed(text, at)) return ((talked = Date.now()), (lastWords = Math.max(lastWords, dated ? 0 : talked - 1000)), cutIn(text), true);
    const last = aired.at(-1);
    const after = !airing.length && last && at > last.end ? at - last.end : 0;
    const when = after ? `${(after / 1000).toFixed(1)} s after a line ended` : "during a line";
    fx.log(`The bot's own voice came back ${when}${dated ? "" : " (its start estimated)"}, and wasn't sent: "${text.slice(0, 80)}"`);
    return false;
  }

  // The owner's finished words: "wait" or "stop" acts at once, and the rest waits for the pause.
  function take(text: string) {
    const words = text.trim();
    if (!stopWords.test(words) && !floorWords.test(words)) return (held.push(words), wait());
    if (stopWords.test(words)) held = [];
    send(words);
  }
  // Sends what's held once the owner has been quiet for the pause, or words begun have waited 2 seconds more for their
  // end.
  function wait() {
    clearTimeout(release);
    // A listener that ends turns itself has waited the pause already.
    const until = lastWords + (line.ends ? 0 : o.pause) + (began ? 2000 : 0);
    if (Date.now() < until) return void (release = setTimeout(wait, until - Date.now()));
    if (held.length) send(held.splice(0).join(" "));
  }
  const send = (text: string) => void hear(text).catch((error) => fx.log(`What the owner said didn't reach ${o.name}: ${error.message}`));

  async function hear(text: string) {
    heardAt = Date.now();
    const words = text.trim();
    if (floorWords.test(words)) return stop();
    if (stopWords.test(words)) {
      stop();
      if (o.room) return void (await o.room.rooms.stop?.(o.room.id), say("Okay, stopped.", "", o.room.voices.get(o.room.lead)));
      const mine = [...running].some((turn) => started.has(turn));
      if (mine) await fx.chats.cancel(o.bot, o.session);
      return say(mine ? "Okay, stopped." : running.size ? "That one isn't mine to stop from here." : "Okay.");
    }
    if (o.room) return toRoom(words);
    const id = `phone-${o.id}-${stamp}-${++count}`;
    sent.add(id);
    const cut =
      cutAfter === null ? "" : cutAfter ? `(They cut you off after: "${cutAfter.slice(-300)}")\n` : "(They cut you off before you'd said anything.)\n";
    cutAfter = null;
    // Without steer: in the call's own session, messages sent with it failed now and then with libfx's
    // ConflictingIdentity on the owner's OpenCode Go model (3 of 6 tries on dev, 2026-11-25), and without it none did,
    // a second one sent while the first turn ran included. Words said while a turn runs are the next turn.
    const result = await fx.chats.send(o.bot, {
      session: o.session,
      text: `${cut}${words}`,
      shown: words,
      label,
      asked: words,
      messageId: id,
      ...(o.effort ? { effort: o.effort } : {}),
    });
    const turn = result.joined ?? result.messageId;
    ours.add(turn);
    o.onSpoken(turn);
    if (result.joined) running.add(turn);
    if (muted === turn) muted = "";
    const asked = heardAt;
    // Unless the owner has talked again since.
    // A net for a slow start, not the call's voice: the bot's own words come first.
    timers.push(setTimeout(() => !over && saidAt < asked && talked <= asked && say("One moment."), 3000));
    void follow();
  }

  // The bot's own chat, from the start, until the call's first message, and spoken from there on. A chat that starts
  // over in a new session, as idle compaction does, is followed there.
  async function follow() {
    if (following) return;
    following = true;
    if (o.room) {
      const leave = o.room.rooms.on?.(o.room.id, fromRoom);
      if (leave) stopFollowing.signal.addEventListener("abort", leave);
      return;
    }
    try {
      const reader = (await fx.chats.stream(o.bot, o.session, 0)).getReader();
      stopFollowing.signal.addEventListener("abort", () => void reader.cancel().catch(() => {}));
      for await (const l of lines(reader)) read(l);
    } catch (error) {
      if (!over) fx.log(`The call stopped following ${o.name}'s chat: ${error instanceof Error ? error.message : error}`);
    }
  }

  // Turns whose text the wrap-up waits for, and what of it has come.
  const answers = new Map<string, { text: string; done: (text: string) => void }>();
  function read(l: StreamLine) {
    const turn = l.messageId ?? "";
    const asked = answers.get(turn);
    if (asked && l.type === "text_delta") asked.text += l.delta ?? "";
    if (asked && l.type === "turn_end") (answers.delete(turn), asked.done(asked.text.trim()));
    if (over) return void (l.type === "turn_end" && running.delete(turn));
    if (!begun) {
      if (l.type === "turn_start" && sent.has(turn)) begun = true;
      else if (l.type === "user_message" && l.id && sent.has(l.id)) begun = true;
      else return;
    }
    if (!turn) return;
    // A tool call, or a message joining the turn, ends what the bot was saying before it: its text after is new.
    if ((l.type === "tool_start" || l.type === "user_message") && muted !== turn) for (const text of speeches.get(turn)?.flush() ?? []) say(text, turn);
    if (l.type === "turn_start") {
      running.add(turn);
      if (sent.has(turn)) started.add(turn);
    } else if (l.type === "user_message") {
      running.add(turn);
      if (l.id && sent.has(l.id) && muted === turn) muted = "";
    } else if (l.type === "text_delta" && l.delta && muted !== turn) {
      let words = speeches.get(turn);
      if (!words) speeches.set(turn, (words = speech()));
      for (const text of words.push(l.delta)) say(text, turn);
    } else if (l.type === "tool_start" && l.id) tools.set(l.id, turn);
    else if (l.type === "tool_end" && l.id) tools.delete(l.id);
    else if (l.type === "turn_end") {
      running.delete(turn);
      for (const [tool, of] of tools) if (of === turn) tools.delete(tool);
      if (muted !== turn) for (const text of speeches.get(turn)?.flush() ?? []) say(text, turn);
      speeches.delete(turn);
      if (muted === turn) muted = "";
      if (goodbyeAfter === turn) void line.hangUp();
    }
  }

  // The owner's words to the room: a bot named at their start or end tagged, and a note for the bots, the first time
  // with the call's, and after a cut, who was cut off. The room decides who answers.
  async function toRoom(words: string) {
    const room = o.room!;
    const members = [...room.names].map(([id, name]) => ({ id, name }));
    const nor = cutOthers.length ? `, nor ${cutOthers.join(" and ")}'s reply` : "";
    const cut =
      cutAfter === null ? "" : !cutOff ? "(They cut in before anything was said.)" : cutAfter ? `(They cut off ${cutOff} after: "${cutAfter.slice(-300)}". The rest wasn't heard${nor}.)` : `(They cut off ${cutOff} before anything was heard${nor}.)`;
    cutAfter = null;
    const asked = heardAt;
    ++count;
    await room.rooms.post!(room.id, { text: tagged(words, members), label, note: cut || undefined, effort: o.effort });
    timers.push(setTimeout(() => !over && saidAt < asked && talked <= asked && say("One moment.", "", room.voices.get(room.lead)), 3000));
    void follow();
  }
  // The room's replies, said as they're written, each in its bot's voice, with tags said as names.
  function fromRoom(event: RoomEvent) {
    const room = o.room!;
    if (event.type === "reply" && "bot" in event) {
      const { bot, text } = event as { bot: string; text: string };
      if (!room.names.has(bot)) return;
      let r = saying.get(bot);
      if (!r || text.length < r.taken) (saying.set(bot, (r = { taken: 0, words: speech() })), quieted.delete(bot));
      // A tag still arriving waits for its end.
      const safe = text.replace(/<[^>]*$/, "");
      const fresh = spoken(safe.slice(r.taken), room.names);
      r.taken = safe.length;
      if (!quieted.has(bot)) for (const said of r.words.push(fresh)) say(said, `room-${bot}`, room.voices.get(bot));
    } else if (event.type === "message" && "message" in event) {
      const bot = (event as { message: { author: string } }).message.author;
      const r = saying.get(bot);
      if (r && !quieted.has(bot)) for (const said of r.words.flush()) say(said, `room-${bot}`, room.voices.get(bot));
      saying.delete(bot);
      quieted.delete(bot);
    }
  }

  function finish(how: string) {
    if (over) return;
    // What the owner said just before the call ended still goes.
    clearTimeout(release);
    if (held.length) send(held.splice(0).join(" "));
    over = true;
    timers.forEach((timer) => clearTimeout(timer));
    // A room's call stops hearing the room; a bot's keeps its reader for the wrap-up, which closes it.
    if (o.room) stopFollowing.abort();
    o.onEnd(how);
  }

  return {
    async place(call) {
      airing = [call.greeting.trim()];
      const result = await line.place(call);
      if (result.outcome !== "answered" || over) return result;
      const ms = o.minutes * 60_000;
      // While a tool works with nothing said, a word every 20 seconds. With nothing said by either for a minute, and
      // nothing running, goodbye.
      timers.push(
        setInterval(() => {
          const now = Date.now();
          if (line.speaking || over || talking()) return;
          if (tools.size && now - saidAt > 20_000) return say("Still working on it.");
          if (!running.size && now - Math.max(saidAt, heardAt) > 60_000) {
            say("I'll let you go. Bye for now.");
            void line.hangUp();
          }
        }, 1000),
        setTimeout(() => say("We have about a minute left on this call."), Math.max(0, ms - 60_000)),
        setTimeout(() => void line.hangUp(true), ms),
      );
      return result;
    },
    spoken: (turn) => ours.has(turn),
    said: () => count,
    async answer(messageId, send) {
      for (const end = Date.now() + 30_000; running.size && Date.now() < end; ) await new Promise((r) => setTimeout(r, 200));
      await new Promise((r) => setTimeout(r, 500));
      const text = new Promise<string>((done) => {
        answers.set(messageId, { text: "", done });
        setTimeout(() => (answers.delete(messageId), done("")), 180_000);
      });
      await send();
      return text;
    },
    close: () => stopFollowing.abort(),
    hangUpAfter(turn) {
      // The tool runs inside its turn, which the chat may not have shown yet: the call ends at that turn's end, or in a
      // minute if the chat never says it ended.
      goodbyeAfter = turn;
      timers.push(setTimeout(() => void line.hangUp(), 60_000));
    },
    end: () => line.hangUp(true),
  };
}
