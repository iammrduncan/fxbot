import type { PluginApi } from "@fxbot/sdk";
import type { Line, LineEvents, Outcome, Place } from "./line.ts";

// A call's conversation (docs/_completed/phases/phone-signalwire.md, On the call). It names no phone service: it holds
// the call through a provider's line. What the owner says goes to the bot's own chat as a message, joining a turn that's
// running, and every reply in that chat is spoken while the call lasts, sentence by sentence, made fit to hear.
// fx.chats.stream reads only a plugin's own sessions, so the call follows the bot's own chat through fxbot's own API, at
// fx.localUrl, as the page does.

type StreamLine = {
  type: string;
  messageId?: string;
  id?: string;
  delta?: string;
  sessionId?: string;
};
export type Conversation = {
  /** Rings the owner, and answers once they answer or don't. */
  place(call: Place): Promise<{ outcome: Outcome; error?: string }>;
  /** Whether this turn is one the owner's words on this call started or joined. */
  spoken(turn: string): boolean;
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
  open: (events: LineEvents) => Line;
  /** A turn the owner's words joined or started, for the plugin to count as theirs. */
  onSpoken: (turn: string) => void;
  onEnd: (how: string) => void;
};

const label = "your call";
const floorWords = /^(?:wait|hold on|hang on|one (?:sec|second|moment)|sorry)[.!,]*$/i;
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const note = (greeting: string) =>
  `You're on a live phone call with the owner, who may be driving. You called them and said: "${greeting}" What they say comes to you as text, and what you write is read out to them. ` +
  "Answer in one to three short spoken sentences, with no lists, tables, links, code, or markdown. Before work that takes more than a few seconds, say in a few words what you'll do, and hand long work to a subagent if you have one. " +
  "Anything that needs their OK shows on their screen, which they can't look at while driving. When they're done, say goodbye and use phone_hang_up.";

// NDJSON lines from a stream of bytes, until it ends or is cancelled.
async function* lines(reader: ReadableStreamDefaultReader<Uint8Array>) {
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
  // The turn spoken last and what of it played, the turn the owner cut off, and what they'd heard of it.
  let speaking = "";
  let played = "";
  let muted = "";
  let cutAfter: string | null = null;
  let saidAt = Date.now();
  let heardAt = Date.now();
  let goodbyeAfter = "";
  let over = false;
  const timers: NodeJS.Timeout[] = [];

  const line = o.open({
    heard: (text) => void hear(text).catch((error) => fx.log(`What the owner said didn't reach ${o.name}: ${error.message}`)),
    interrupted: () => {
      muted = speaking;
      speeches.delete(muted);
      cutAfter = played;
    },
    played: (text) => {
      played = `${played} ${text}`.trim();
      saidAt = Date.now();
    },
    ended: (how) => finish(how),
  });

  function say(text: string, turn = "") {
    if (turn && turn !== speaking) ((speaking = turn), (played = ""));
    saidAt = Date.now();
    line.say(text);
  }

  async function hear(text: string) {
    heardAt = Date.now();
    const words = text.trim();
    if (floorWords.test(words)) return line.stop();
    if (stopWords.test(words)) {
      line.stop();
      const mine = [...running].some((turn) => started.has(turn));
      if (mine) await fx.chats.cancel(o.bot);
      return say(mine ? "Okay, stopped." : running.size ? "That one isn't mine to stop from here." : "Okay.");
    }
    const id = `phone-${o.id}-${stamp}-${++count}`;
    sent.add(id);
    const cut =
      cutAfter === null ? "" : cutAfter ? `(They cut you off after: "${cutAfter.slice(-300)}")\n` : "(They cut you off before you'd said anything.)\n";
    cutAfter = null;
    const body = `${count === 1 ? note(o.greeting) : "[On the phone]"}\n\n${cut}${words}`;
    const result = await fx.chats.send(o.bot, {
      text: body,
      shown: words,
      label,
      steer: true,
      asked: words,
      messageId: id,
    });
    const turn = result.joined ?? result.messageId;
    ours.add(turn);
    o.onSpoken(turn);
    if (result.joined) running.add(turn);
    if (muted === turn) muted = "";
    const asked = heardAt;
    timers.push(setTimeout(() => !over && saidAt < asked && say("One moment."), 1500));
    void follow();
  }

  // The bot's own chat, from the start, until the call's first message, and spoken from there on. A chat that starts
  // over in a new session, as idle compaction does, is followed there.
  async function follow() {
    if (following) return;
    following = true;
    try {
      for (;;) {
        const res = await fetch(`${fx.localUrl}/api/profiles/${o.bot}/stream?cursor=0`, { signal: stopFollowing.signal });
        if (!res.ok || !res.body) throw new Error(`fxbot answered ${res.status}`);
        let moved = false;
        for await (const l of lines(res.body.getReader())) {
          if (l.type === "moved") {
            moved = true;
            break;
          }
          read(l);
        }
        if (!moved || over) return;
      }
    } catch (error) {
      if (!over) fx.log(`The call stopped following ${o.name}'s chat: ${error instanceof Error ? error.message : error}`);
    }
  }

  function read(l: StreamLine) {
    const turn = l.messageId ?? "";
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

  function finish(how: string) {
    if (over) return;
    over = true;
    timers.forEach((timer) => clearTimeout(timer));
    stopFollowing.abort();
    o.onEnd(how);
  }

  return {
    async place(call) {
      const result = await line.place(call);
      if (result.outcome !== "answered" || over) return result;
      const ms = o.minutes * 60_000;
      // While a tool works with nothing said, a word every 20 seconds. With nothing said by either for a minute, and
      // nothing running, goodbye.
      timers.push(
        setInterval(() => {
          const now = Date.now();
          if (line.speaking || over) return;
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
    hangUpAfter(turn) {
      // The tool runs inside its turn, which the chat may not have shown yet: the call ends at that turn's end, or in a
      // minute if the chat never says it ended.
      goodbyeAfter = turn;
      timers.push(setTimeout(() => void line.hangUp(), 60_000));
    },
    end: () => line.hangUp(true),
  };
}
