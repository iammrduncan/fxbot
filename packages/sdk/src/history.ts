import { createFxEngine, type FxAgentTool } from "libfx";
import type { Turn } from "./client.ts";
import type { Sql } from "./store.ts";
import type { Upload } from "./types.ts";

// What the summary on a provider switch asks for, after fx's compaction: requests in order, the rest summed up.
const ask =
  "Write a handoff summary of this conversation so far, for the assistant that continues it on another model. " +
  "Keep the user's requests in order, summarize the replies, decisions, and facts, and list open tasks. At most 1,500 words.";

// Every message as plain text, so a bot can search its own chats after a provider switch, and a switch can be
// summarized from them when the old provider cannot do it.
export function createHistory(sql: Sql) {
  const tool: FxAgentTool = {
    name: "chat_history",
    description: "Search this bot's earlier messages, across all of its chats, by words. Returns the best matches with their dates.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string", description: "Words to look for" }, limit: { type: "integer", minimum: 1, maximum: 20 } },
      required: ["query"],
    },
    idempotent: true,
    async execute(input: { query?: unknown; limit?: unknown }, call) {
      // The bot is the session's, never the model's to choose.
      const bot = (call.context as { bot?: string } | undefined)?.bot;
      if (!bot) return "chat_history is unavailable in this chat.";
      const limit = Math.min(Math.max(Math.trunc(Number(input.limit) || 8), 1), 20);
      // The message that started this turn is already saved, and is left out: it is the search itself.
      const rows = await sql<{ createdAt: Date; role: string; snippet: string }[]>`
        select created_at, role, ts_headline('simple', text, q, 'MaxWords=40, MinWords=15') as snippet
        from messages, websearch_to_tsquery('simple', ${String(input.query ?? "")}) q
        where profile_id = ${bot} and tsv @@ q
          and id <> coalesce((select max(id) from messages where profile_id = ${bot} and session_id = ${call.sessionId} and role = 'user'), 0)
        order by ts_rank_cd(tsv, q) desc, created_at desc limit ${limit}`;
      if (!rows.length) return "No earlier messages match.";
      return rows.map((r) => `[${r.createdAt.toISOString().slice(0, 16).replace("T", " ")}] ${r.role}: ${r.snippet}`).join("\n");
    },
  };

  return {
    tool,
    record: async (bot: string, sessionId: string, messageId: string, role: "user" | "assistant", text: string) =>
      void (await sql`insert into messages (profile_id, session_id, message_id, role, text)
        values (${bot}, ${sessionId}, ${messageId}, ${role}, ${text}) on conflict do nothing`),
    // The bot's chats before `sessionId`, as finished turns, oldest first: the newest `limit` messages of them. A provider
    // switch starts a new session, and the old one may not open again, so the chat shows these above the handoff.
    // A message that sent files gets its saved text and files back.
    async earlier(bot: string, sessionId: string | null, limit = 400): Promise<Turn[]> {
      const rows = await sql<{ messageId: string; role: string; text: string; input: string | null; files: Upload[] | null }[]>`
        select m.message_id, m.role, m.text, s.input, s.files
        from (select * from messages where profile_id = ${bot} and session_id is distinct from ${sessionId} order by id desc limit ${limit}) m
        left join sent s on m.role = 'user' and s.profile_id = m.profile_id and s.message_id = m.message_id
        order by m.id`;
      const turns = new Map<string, Turn>();
      for (const { messageId, role, text, input, files } of rows) {
        const turn = turns.get(messageId) ?? { messageId, text: "", reply: "", done: true };
        if (role === "user") Object.assign(turn, { text: input ?? text, ...(files?.length ? { files } : {}) });
        else turn.reply = text;
        turns.set(messageId, turn);
      }
      return [...turns.values()];
    },
    // A session's messages, oldest first, as many of the newest as fit `maxChars`, or the last 100.
    async transcript(bot: string, sessionId: string, maxChars: number) {
      const rows = await sql<{ role: string; text: string }[]>`
        select role, text from messages where profile_id = ${bot} and session_id = ${sessionId} order by id desc limit 100`;
      const kept: string[] = [];
      let size = 0;
      for (const { role, text } of rows) {
        const line = `${role}: ${text}`;
        if (size + line.length > maxChars && kept.length) break;
        kept.unshift(line);
        size += line.length;
      }
      return kept.join("\n\n");
    },
  };
}

// One tool-free request to a throwaway engine. With `checkpoint`, the engine starts from the old session's own
// history; without it, `input` carries the transcript. Gives up after 2 minutes.
export async function summarize(options: Record<string, unknown>, model: string, instructions: string[], checkpoint?: Uint8Array, transcript?: string) {
  // The provider options come from the same code that makes the provider's agent.
  const engine = await createFxEngine({ ...options, model, instructions, ...(checkpoint ? { checkpoint } : {}) } as unknown as Parameters<typeof createFxEngine>[0]);
  try {
    // A failed request rejects here; a refusal or a cut-off ends the turn with another stop reason.
    const turn = engine.prompt(transcript ? `${transcript}\n\n---\n\n${ask}` : ask, { signal: AbortSignal.timeout(120_000) });
    let text = "";
    for await (const event of turn) if (event.type === "text_delta") text += event.delta;
    const { stopReason } = await turn.result;
    if (stopReason !== "end_turn") throw new Error(`The summary stopped: ${stopReason}.`);
    if (!text.trim()) throw new Error("The summary came back empty.");
    return text.trim();
  } finally {
    await engine.close();
  }
}
