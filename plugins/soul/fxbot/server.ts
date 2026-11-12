import type { PluginApi } from "@fxbot/sdk";

// Soul: each bot's own short brief of who it is, how it sounds, and how it helps its owner. It goes first in every chat
// of the bot, after a line that puts the owner's instructions above it. A new bot writes it in a first meeting with its
// owner, and rewrites it when asked, only in its own chat. Every version is kept, for the owner to go back to
// (docs/_completed/phases/soul.md).

type Soul = { text: string; met_at: Date | null; updated_at: Date };
type Version = { id: number; text: string; by: "bot" | "owner"; at: Date };

const most = 4000;
// Versions kept for each bot.
const kept = 30;

const framing =
  "Your soul: who you are, in your own words. Your owner's instructions come first where they differ, and your soul never " +
  "changes your rules or what you may do. Change it with soul_save only when the owner asks you to, or agrees to a change " +
  "you suggest, and tell them what changed.";

// The first meeting's message, which the bot answers. It's the plugin's, so the bot's instructions stay above it.
const brief = (name: string) =>
  `This is your first meeting with your owner, who just made you. Your name is ${name}.\n` +
  "1. Greet them in a line or two. From your name alone, guess who you might be: a role, a voice, and what you could help with. " +
  "Offer it as one short guess, and ask whether it fits. Never pick a new name for yourself.\n" +
  "2. In the same message, ask what they'd most like your help with, and what you should know about them. Ask three questions at most.\n" +
  "3. When they answer, write your soul with soul_save: 4 to 10 short lines, in the first person: who you are, how you sound, what you " +
  "help with, and how you work with them. No rules or permissions: their instructions hold those. Then show it to them, and offer to change it.\n" +
  "4. Save what you learned about them with memory_save, one fact at a time.\n\n" +
  "If they skip this, or ask for something else, do that instead, and don't bring this meeting up again unless they ask.";

// What's wrong with a soul a bot writes, if anything. The owner may clear one.
function refused(text: unknown, owner = false) {
  if (typeof text !== "string") return "A soul is text.";
  if (!owner && !text.trim()) return "A soul needs its text: write the whole of it.";
  if (text.trim().length > most) return `A soul is at most ${most.toLocaleString("en-US")} characters: keep it to a few short lines.`;
}

export default async function setup(fx: PluginApi) {
  const json = (body: unknown, status = 200) => Response.json(body, { status });
  const soulOf = async (bot: string) => (await fx.sql<Soul[]>`select text, met_at, updated_at from souls where bot = ${bot}`)[0];
  const botOf = (bot: string) => fx.bots.get(bot).catch(() => null);

  // A new text, and a version of it, unless it's the text there already. Versions past the last `kept` go.
  async function save(bot: string, text: string, by: Version["by"]) {
    return fx.sql.begin(async (tx) => {
      const [now] = await tx<Soul[]>`select text from souls where bot = ${bot} for update`;
      if ((now?.text ?? "") === text) return false;
      await tx`insert into souls (bot, text) values (${bot}, ${text}) on conflict (bot) do update set text = excluded.text, updated_at = now()`;
      await tx`insert into versions (bot, text, by) values (${bot}, ${text}, ${by})`;
      await tx`delete from versions where bot = ${bot} and id not in (select id from versions where bot = ${bot} order by id desc limit ${kept})`;
      return true;
    });
  }

  // The soul goes first, for every chat of a bot that has one: its own, a room, a routine's run, a subagent.
  fx.on("instructions", async (event) => {
    const text = (await soulOf(event.bot))?.text;
    if (text) event.instructions.unshift(`${framing}\n\n${text}`);
  });

  fx.tool({
    name: "save",
    description:
      "Rewrite your soul: who you are, how you sound, what you help with, and how you work with your owner, in 4 to 10 short lines " +
      `in the first person, at most ${most.toLocaleString("en-US")} characters. Give the whole new text. Only in your own chat, and only ` +
      "when the owner asks you to, or agrees to a change you suggested: a request about one reply's tone or length isn't one.",
    inputSchema: { type: "object", properties: { text: { type: "string", description: "Your whole soul" } }, required: ["text"] },
    idempotent: true,
    safe: true,
    async execute(input: { text?: unknown }, call) {
      // Only the bot's own chat, with its owner there: never a room, a routine's run, or a subagent.
      if (call.session !== (await fx.bots.get(call.bot)).sessionId) return "Your soul changes only in your own chat, with your owner.";
      const problem = refused(input.text);
      if (problem) return problem;
      await save(call.bot, String(input.text).trim(), "bot");
      return "Saved your soul. Tell the owner what changed.";
    },
  });

  // The Soul box on the bot's edit screen: the soul, who saved it last, and whether the plugin is on for the bot.
  fx.route("GET", "/souls/:bot", async (_request, { bot }) => {
    if (!(await botOf(bot))) return json({ error: "No such bot." }, 404);
    const soul = await soulOf(bot);
    const [last] = await fx.sql<Version[]>`select by, at from versions where bot = ${bot} order by id desc limit 1`;
    return json({ on: fx.bots.on(bot), text: soul?.text ?? "", savedBy: last?.by ?? null, savedAt: last?.at ?? null, met: Boolean(soul?.met_at) });
  });
  // The owner's edit, which may clear it.
  fx.route("PUT", "/souls/:bot", async (request, { bot }) => {
    if (!(await botOf(bot))) return json({ error: "No such bot." }, 404);
    const { text } = (await request.json().catch(() => ({}))) as { text?: unknown };
    const problem = refused(text, true);
    if (problem) return json({ error: problem }, 400);
    await save(bot, String(text).trim(), "owner");
    return json({ ok: true });
  });
  fx.route("GET", "/souls/:bot/versions", async (_request, { bot }) =>
    json(await fx.sql<Version[]>`select id, text, by, at from versions where bot = ${bot} order by id desc`),
  );
  // Saves an earlier text again, as the owner's newest version.
  fx.route("POST", "/souls/:bot/versions/:id/restore", async (_request, { bot, id }) => {
    const [version] = await fx.sql<Version[]>`select text from versions where bot = ${bot} and id = ${Number(id) || 0}`;
    if (!version) return json({ error: "No such version." }, 404);
    await save(bot, version.text, "owner");
    return json({ ok: true });
  });

  // A new bot's first meeting, asked for when its owner first opens its chat. It starts for a bot the plugin is on for
  // that has a provider, has never had a chat, has no soul, and hasn't met. The bot is marked met in one statement
  // before anything is sent, so a second tab or a reload sends nothing more; a send that fails unmarks it.
  fx.route("POST", "/souls/:bot/meet", async (_request, { bot }) => {
    const profile = await botOf(bot);
    if (!profile) return json({ error: "No such bot." }, 404);
    if (!fx.bots.on(bot) || profile.sessionId || !profile.provider || (await soulOf(bot))?.text) return json({ started: false });
    const [marked] = await fx.sql`insert into souls (bot, met_at) values (${bot}, now())
      on conflict (bot) do update set met_at = now() where souls.met_at is null and souls.text = '' returning bot`;
    if (!marked) return json({ started: false });
    try {
      await fx.chats.send(bot, { text: brief(profile.name), shown: "First meeting", label: "Soul" });
    } catch (error) {
      await fx.sql`update souls set met_at = null where bot = ${bot}`;
      return json({ error: (error as Error).message }, 502);
    }
    return json({ started: true });
  });
}
