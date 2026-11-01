import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { applyLine, type Turn } from "./client.ts";
import type { createHistory } from "./history.ts";
import type { Store, StoredProfile } from "./store.ts";
import type { StreamLine } from "./types.ts";

const json = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const imageTypes: Record<string, string> = { png: "image/png", jpg: "image/jpeg", gif: "image/gif", webp: "image/webp" };

// A session's turns, read from its stream. libfx replays the stored lines and then stays open for new ones without
// marking the end of the replay, so a quiet half second after the last line ends the read.
async function turnsOf(stream: ReadableStream<string>) {
  const reader = stream.getReader();
  let turns: Turn[] = [];
  let rest = "";
  for (;;) {
    const next = await Promise.race([reader.read(), new Promise<null>((resolve) => setTimeout(resolve, 500, null))]);
    if (!next || next.done) break;
    const parts = (rest + next.value).split("\n");
    rest = parts.pop()!;
    for (const part of parts.filter(Boolean)) turns = applyLine(turns, JSON.parse(part) as StreamLine);
  }
  await reader.cancel().catch(() => {});
  return turns;
}

// Moves v1's files into Postgres while they are there, then sets them aside in `data/imported/`. Every insert skips
// what is already stored, so an import that stopped partway runs again on the next start and leaves no duplicates.
// v1's bots move to the environment's provider when there is one.
export async function importFiles(
  store: Store,
  history: ReturnType<typeof createHistory>,
  dataDir: string,
  stream: (profile: StoredProfile) => Promise<ReadableStream<string> | null>,
) {
  const dir = join(dataDir, "profiles");
  if (!existsSync(dir)) return;
  const env = await store.providers.get("env");
  const settingsFile = join(dataDir, "settings.json");
  const settings = existsSync(settingsFile) ? json(settingsFile) : {};
  if (env) {
    await store.providers.save({ ...env, model: env.model || (settings.defaultModel ?? "") });
    if (!(await store.settings.get()).defaultProvider) await store.settings.save({ defaultProvider: "env" });
  }
  for (const name of readdirSync(dir).filter((file) => /^[0-9a-f]{12}\.json$/.test(file))) {
    const p = json(join(dir, name));
    await store.sql`insert into profiles (id, name, instructions, provider, model, session_id, preview)
      values (${p.id}, ${p.name}, ${p.instructions ?? ""}, ${env ? "env" : null}, ${p.model ?? ""}, ${p.sessionId ?? null}, ${p.preview ?? null})
      on conflict (id) do nothing`;
    const uploads = join(dataDir, "uploads", p.id);
    for (const file of existsSync(uploads) ? readdirSync(uploads) : []) {
      const ext = /^[0-9a-f]{64}\.(png|jpg|gif|webp)$/.exec(file)?.[1];
      if (ext) await store.sql`insert into images values (${p.id}, ${file}, ${imageTypes[ext]}, ${readFileSync(join(uploads, file))}) on conflict do nothing`;
      else if (file.endsWith(".json")) await store.sent.save(p.id, file.slice(0, -5), json(join(uploads, file)));
    }
    const lines = await stream((await store.profiles.get(p.id))!);
    if (lines)
      for (const turn of await turnsOf(lines)) {
        const files = turn.files?.length ? `\n[files: ${turn.files.map((f) => f.name).join(", ")}]` : "";
        if (turn.text || files) await history.record(p.id, p.sessionId, turn.messageId, "user", turn.text + files);
        if (turn.reply) await history.record(p.id, p.sessionId, turn.messageId, "assistant", turn.reply);
      }
  }
  // The first bot is pinned, as on a new install.
  await store.sql`update profiles set pinned_at = now() where id = (select id from profiles order by created_at, id limit 1)
    and not exists (select 1 from profiles where pinned_at is not null)`;
  const aside = join(dataDir, "imported");
  mkdirSync(aside, { recursive: true });
  for (const name of ["profiles", "uploads", "settings.json"]) if (existsSync(join(dataDir, name))) renameSync(join(dataDir, name), join(aside, name));
}
