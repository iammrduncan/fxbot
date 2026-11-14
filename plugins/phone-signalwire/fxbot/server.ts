import { randomInt } from "node:crypto";
import type { PluginApi } from "@fxbot/sdk";
import { conversation, type Conversation } from "./call.ts";
import { endKept, line, type Kept, type Outcome, type Relay } from "./relay.ts";

// phone-signalwire: a bot rings the owner's own phone through SignalWire, and they talk, with the bot's own turn
// deciding everything (docs/phases/phone-signalwire.md). fxbot opens one connection to SignalWire for each call, and
// nothing ever connects to fxbot. The owner starts a call with Call me; a bot starts one when the owner asked, on a
// call-back they gave, or on its own when the owner allowed that.

type Why = "button" | "asked" | "callback" | "own" | "confirm";
type Row = {
  id: number;
  bot: string;
  why: Why;
  reason: string | null;
  status: string;
  seconds: number | null;
  error: string | null;
  at: Date;
  answered_at: Date | null;
  ended_at: Date | null;
};

const limits = { minutes: [5, 120, 30], perDay: [1, 20, 3] } as const;
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

export default async function setup(fx: PluginApi) {
  if (!fx.secrets || !fx.bots.on) throw new Error("phone-signalwire needs fxbot 0.9.0 or newer.");

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
  // RELAY has one address for every space: the project says whose. A checkout's checks point the plugin at a fake
  // one, read once at start.
  const fake = process.env.FXBOT_PHONE_RELAY ?? "";
  const relay = (): Relay => ({
    url: fake || "wss://relay.signalwire.com",
    project: setting("project"),
    token: setting("token"),
    from: setting("from"),
    voice: setting("voice") || "amazon.Joanna:neural:en-US",
    language: setting("language") || "en-US",
    log: (...parts) => fx.log(...parts),
  });
  // What's missing before any call: the account, the numbers, and the owner's number confirmed.
  function missing() {
    const out: string[] = [];
    for (const name of ["project", "token"]) if (!setting(name)) out.push(name);
    for (const name of ["from", "to"]) if (!phone.test(setting(name))) out.push(name);
    return out;
  }
  const confirmed = async () => phone.test(setting("to")) && (await fx.secrets.get("confirmed")) === setting("to");

  // Turns the owner typed in a bot's own chat, and turns their words on a call started or joined, until each ends.
  const typed = new Set<string>();
  const spoken = new Set<string>();
  fx.on("turn.start", (event) => void (!event.from && typed.add(event.messageId)));
  fx.on("turn.end", (event) => void (typed.delete(event.messageId), spoken.delete(event.messageId)));

  // The one call at a time: its row, its bot, and its conversation. A call that confirms the owner's number counts too.
  let live: { id: number; bot: string; conversation: Conversation } | null = null;
  let confirming = false;

  // What a restart needs to end a call, ringing or on, saved as soon as SignalWire names it.
  const keep = (id: number) => (k: Kept) => void fx.sql`update calls set sid = ${k.id}, node = ${k.node}, protocol = ${k.protocol} where id = ${id}`.catch(() => {});

  // A call's end. The owner or the bot hanging up, a voicemail left, and the call's length are how calls end; anything
  // else is kept as its error.
  async function finish(id: number, how: string) {
    const error = ["hung up", "left a voicemail", "max_duration"].includes(how) ? null : how;
    await fx.sql`update calls set status = case when status in ('ringing', 'on') then 'ended' else status end, ended_at = coalesce(ended_at, now()),
      seconds = coalesce(seconds, extract(epoch from now() - answered_at)::int), error = coalesce(error, ${error}) where id = ${id}`;
    if (live?.id === id) live = null;
  }

  // Places a call to the owner's phone and answers once they answer, or don't. A refusal throws, in words for a bot.
  async function place(bot: string, why: Why, reason = "") {
    const absent = missing();
    if (absent.length)
      throw new Error(`Phone isn't set up: ${absent.join(", ")} ${absent.length === 1 ? "is" : "are"} missing, in Settings › Plugins › phone-signalwire.`);
    if (!(await confirmed())) throw new Error("The owner's number isn't confirmed yet.");
    if (live) throw new Error(live.bot === bot ? "You're on a call with the owner now: just tell them." : "A call is on already, and there's one at a time.");
    if (confirming) throw new Error("The owner is confirming their number on a call now.");
    const { name } = await fx.bots.get(bot);
    const told = reason ? finished(reason.trim()) : "";
    const greeting = why === "button" ? `Hey, this is your fxbot ${name}. How can I help today?` : `Hey, this is your fxbot ${name}. ${told}`.trim();
    const voicemail = why === "button" ? undefined : `Hi, it's ${name} from fxbot. ${told} Talk to me in the app anytime.`.replace(/\s+/g, " ");
    const [{ id }] = await fx.sql<{ id: number }[]>`insert into calls (bot, why, reason) values (${bot}, ${why}, ${reason || null}) returning id::int as id`;
    const call = conversation(fx, {
      bot,
      name,
      greeting,
      minutes: limit("minutes"),
      id,
      open: (events) => line(relay(), events),
      onSpoken: (turn) => void spoken.add(turn),
      onEnd: (how) => void finish(id, how).catch((error) => fx.log(`Call ${id} didn't save its end: ${error.message}`)),
    });
    live = { id, bot, conversation: call };
    const result = await call.place({ to: setting("to"), greeting, voicemail, hints: [name], kept: keep(id) });
    await fx.sql`update calls set status = ${statusOf[result.outcome]}, error = ${result.error ?? null},
      answered_at = ${result.outcome === "answered" || result.outcome === "voicemail" ? fx.sql`now()` : null},
      ended_at = ${result.outcome === "answered" ? null : fx.sql`now()`} where id = ${id} and ended_at is null`;
    if (result.outcome !== "answered" && live?.id === id) live = null;
    return { id, ...result };
  }

  // After a restart, a call the last process left may still be up, since SignalWire keeps calls across connections:
  // each is ended from a new connection with its protocol. Nothing is placed again.
  async function sweep() {
    const left = await fx.sql<
      { id: number; sid: string | null; node: string | null; protocol: string | null }[]
    >`select id, sid, node, protocol from calls where status in ('ringing', 'on')`;
    for (const row of left) {
      if (row.sid && row.node && row.protocol && !missing().length) await endKept(relay(), { id: row.sid, node: row.node, protocol: row.protocol });
      await fx.sql`update calls set status = case when status = 'on' then 'ended' else 'failed' end, ended_at = now(), error = 'fxbot restarted.',
        seconds = extract(epoch from now() - answered_at)::int where id = ${row.id}`;
    }
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
      const theirs = typed.has(call.messageId) || spoken.has(call.messageId) || Boolean(live?.conversation.spoken(call.messageId));
      if (input.later === true) {
        if (!theirs) return "Only the owner keeps a call-back for later, in their chat with you or on a call.";
        await fx.sql`insert into callbacks (bot, reason, until) values (${call.bot}, ${reason || "the owner asked for a call"}, now() + interval '12 hours')
          on conflict (bot) do update set reason = excluded.reason, until = excluded.until`;
        return "Kept: you can call the owner once in the next 12 hours, without later, when it's time.";
      }
      let why: Why = "asked";
      if (!theirs) {
        const [callback] = await fx.sql`delete from callbacks where bot = ${call.bot} and until > now() returning reason`;
        if (callback) why = "callback";
        else {
          const [own] = await fx.sql<{ on_its_own: boolean }[]>`select on_its_own from bots where bot = ${call.bot}`;
          if (!own?.on_its_own) return "The owner didn't ask for a call. Tell them in the chat, and they can ask you to call.";
          if (quiet()) return "It's the owner's quiet hours, when you don't call on your own. Tell them in the chat.";
          const [{ n }] = await fx.sql<{ n: number }[]>`select count(*)::int as n from calls where bot = ${call.bot} and why = 'own'
            and date_trunc('day', at at time zone ${fx.timeZone()}) = date_trunc('day', now() at time zone ${fx.timeZone()})`;
          if (n >= limit("perDay")) return `You've made ${n} calls on your own today, the most for a day. Tell the owner in the chat.`;
          why = "own";
        }
      }
      try {
        const result = await place(call.bot, why, reason);
        return result.outcome === "failed" ? `${words.failed}: ${result.error ?? "SignalWire didn't say why."}` : words[result.outcome];
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
      if (!live || live.bot !== call.bot) return "You're not on a call.";
      live.conversation.hangUpAfter(call.messageId);
      return "Hanging up after this reply.";
    },
  });

  // What the page asks.
  fx.route("GET", "/status", async () => json({ missing: missing(), confirmed: await confirmed(), to: setting("to") }));

  fx.route("POST", "/calls", async (request) => {
    const { bot } = (await request.json().catch(() => ({}))) as { bot?: unknown };
    if (typeof bot !== "string" || !fx.bots.on(bot)) return json({ error: "Phone is off for this bot." }, 400);
    const absent = missing();
    if (absent.length) return json({ error: "Phone isn't set up.", missing: absent }, 400);
    if (!(await confirmed())) return json({ error: "Confirm your number first, in Settings › Plugins › phone-signalwire." }, 400);
    if (live || confirming) return json({ error: "A call is on already." }, 409);
    // It rings in the background: the bar follows it.
    void place(bot, "button").catch((error) => fx.log(`Call me didn't call: ${error.message}`));
    return json({ ok: true }, 202);
  });

  fx.route("GET", "/calls/live", async (request) => {
    const bot = new URL(request.url).searchParams.get("bot") ?? "";
    const [row] = await fx.sql<Row[]>`select * from calls where bot = ${bot} and why <> 'confirm' and status in ('ringing', 'on') order by id desc limit 1`;
    return json({ call: row ? { id: row.id, status: row.status, at: row.at, answeredAt: row.answered_at } : null });
  });

  fx.route("POST", "/calls/:id/end", async (_request, { id }) => {
    if (live?.id !== Number(id)) return json({ error: "That call isn't on." }, 404);
    await live.conversation.end();
    return json({ ok: true });
  });

  fx.route("GET", "/calls", async () => {
    const rows = await fx.sql<Row[]>`select * from calls order by id desc limit 20`;
    const names = new Map((await fx.bots.list()).map((bot) => [bot.id, bot.name]));
    return json(rows.map((row) => ({ ...row, name: row.why === "confirm" ? "Confirming your number" : (names.get(row.bot) ?? "A bot that's gone") })));
  });

  // Confirming the owner's number: a call that plays a code, which the owner types back.
  fx.route("POST", "/confirm", async () => {
    const absent = missing();
    if (absent.length) return json({ error: `Set ${absent.join(", ")} first.` }, 400);
    if (live || confirming) return json({ error: "A call is on already." }, 409);
    confirming = true;
    const code = String(randomInt(1000, 10000));
    await fx.secrets.set("code", JSON.stringify({ code, to: setting("to"), until: Date.now() + 10 * 60_000 }));
    const spaced = code.split("").join(" ");
    const [{ id }] = await fx.sql<{ id: number }[]>`insert into calls (bot, why) values ('', 'confirm') returning id::int as id`;
    const confirm = line(relay(), { heard: () => {}, interrupted: () => {}, played: () => {}, ended: () => {} });
    void (async () => {
      const result = await confirm.place({
        to: setting("to"),
        greeting: `Your fxbot code is ${spaced}. Again: ${spaced}. Goodbye.`,
        quiet: true,
        kept: keep(id),
      });
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

  // A bot's section: whether it may call on its own, and its open call-back.
  fx.route("GET", "/bots/:bot", async (_request, { bot }) => {
    const [own] = await fx.sql<{ on_its_own: boolean }[]>`select on_its_own from bots where bot = ${bot}`;
    const [callback] = await fx.sql<{ reason: string; until: Date }[]>`select reason, until from callbacks where bot = ${bot} and until > now()`;
    return json({ onItsOwn: own?.on_its_own ?? false, callback: callback ?? null, perDay: limit("perDay"), quiet: setting("quiet") || "22:00-07:00" });
  });
  fx.route("PUT", "/bots/:bot", async (request, { bot }) => {
    const { onItsOwn } = (await request.json().catch(() => ({}))) as { onItsOwn?: unknown };
    if (typeof onItsOwn !== "boolean") return json({ error: "onItsOwn is true or false." }, 400);
    await fx.sql`insert into bots (bot, on_its_own) values (${bot}, ${onItsOwn}) on conflict (bot) do update set on_its_own = excluded.on_its_own`;
    return json({ onItsOwn });
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
