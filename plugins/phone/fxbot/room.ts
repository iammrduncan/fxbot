// A call in a chat room (docs/phases/phone-v2.md, a conference call in a room): the room's conversation said aloud. The
// room keeps who answers and its limits, exactly as in text. phone adds a voice for each bot, one speaking at a time,
// and tags: a bot named at the start or end of what the owner says is tagged, as `@` does in the room's box.

/** What chat rooms 0.6.0 offers phone with fx.provide. */
export type Room = { id: number; name: string; members: string[]; untagged: "lead" | "everyone"; replies: number };
export type RoomEvent =
  | { type: "reply"; bot: string; text: string }
  | { type: "message"; message: { id: number; author: string; text: string } }
  | { type: "queue"; bots: string[] }
  | { type: "idle" }
  | { type: string };
export type Rooms = {
  rooms(): Promise<Room[]>;
  post?(room: number, message: { text: string; label?: string; note?: string; effort?: string }): Promise<unknown>;
  stop?(room: number): Promise<void>;
  on?(room: number, listener: (event: RoomEvent) => void): () => void;
};

// Words said before a name that address someone: "Hey Bob", "Okay, Mr Robot".
const leading = new Set(["hey", "hi", "okay", "ok", "so", "alright", "um", "uh", "yo", "and", "now"]);
const everyone = /^(?:(?:hey|okay|ok|so|alright)[,\s]+)?(?:everyone|everybody|both of you|you all|y'all|all of you|you guys|guys)\b/i;
const everyoneLast = /\b(?:everyone|everybody|both of you|you all|y'all|all of you|you guys|guys)[\s.!?,]*$/i;
const plain = (text: string) =>
  text
    .toLowerCase()
    .replace(/\bmister\b/g, "mr")
    .replace(/[^\p{L}\p{N}]+/gu, "");

/** The owner's words, with a bot of the room named at their start or end as the room's token, `<@bot:id>`, or
 * `<@all>` for everyone. A name in the middle is left as it is, for the lead to decide. */
export function tagged(words: string, members: { id: string; name: string }[]) {
  if (everyone.test(words) || everyoneLast.test(words)) return `<@all> ${words}`;
  const found = [...words.matchAll(/[\p{L}\p{N}'.]+/gu)].map((m) => ({ text: m[0], at: m.index!, end: m.index! + m[0].length }));
  const names = members.map((m) => ({ ...m, key: plain(m.name) })).filter((m) => m.key);
  const endOf = (w: { text: string; at: number }) => w.at + w.text.replace(/\.+$/, "").length;
  // A name of one to three words, starting at word i.
  const nameAt = (i: number) => {
    for (let k = Math.min(3, found.length - i); k >= 1; k--) {
      const key = plain(found.slice(i, i + k).map((w) => w.text).join(" "));
      const bot = names.find((m) => m.key === key);
      // A sentence's period stays the sentence's: "…, Mr Robot." keeps its ".".
      if (bot) return { bot, from: found[i].at, to: endOf(found[i + k - 1]) };
    }
    return null;
  };
  let first = 0;
  while (first < found.length - 1 && leading.has(found[first].text.toLowerCase().replace(/[^\p{L}]/gu, ""))) first++;
  const start = found.length ? nameAt(first) : null;
  let hit = start;
  if (!hit)
    for (let k = 1; k <= 3 && k <= found.length; k++) {
      const end = nameAt(found.length - k);
      if (end && end.to === endOf(found.at(-1)!)) {
        hit = end;
        break;
      }
    }
  return hit ? `${words.slice(0, hit.from)}<@bot:${hit.bot.id}>${words.slice(hit.to)}` : words;
}

/** A reply's tags, said as names: "Mr Robot, can you check the logs?" A reply being written still has a bot's tag as
 * the bot wrote it, `@Name`, which the room makes a token only once it's saved. */
export const spoken = (text: string, names: Map<string, string>) =>
  text
    .replace(/<@bot:([0-9a-f]{12})>/g, (_, id: string) => names.get(id) ?? "someone")
    .replace(/<@all>/g, "everyone")
    .replace(/(^|[\s(])@(?=\p{L})/gu, "$1");

/** What the room's bots are told with the call's first words, and only them. */
export const roomNote =
  "(The owner is on a voice call with this room. Each reply is read out to them in its bot's own voice, one bot at a time, so answer in one to three short spoken sentences, with no lists, tables, links, code, or markdown. " +
  "Hand on to another bot by tagging it, as in text, and it's said as its name. Quick looks you do yourself; anything longer goes to a subagent, if you have one, and say it's under way.)";

/** Each bot's voice in a room: its own, or one of the speaker's that no other bot in the room has, in the room's order. */
export function voicesFor(members: string[], own: Map<string, string | null>, offered: string[], fallback: string) {
  const voices = new Map<string, string>();
  const taken = new Set(members.map((bot) => own.get(bot)).filter((v): v is string => Boolean(v)));
  const free = offered.filter((v) => !taken.has(v));
  for (const bot of members) voices.set(bot, own.get(bot) || free.shift() || fallback);
  return voices;
}
