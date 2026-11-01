import { randomBytes } from "node:crypto";
import postgres from "postgres";
import { maxPinned, type Fields, type Profile, type Sent, type Settings } from "./types.ts";

export const isId = (id: string) => /^[0-9a-f]{12}$/.test(id);
export const newId = () => randomBytes(6).toString("hex");

// Every record fxbot owns. libfx keeps its sessions in files beside them. Tables are made on start; there is no
// migration tool yet.
const schema = `
create table if not exists settings (id int primary key default 1 check (id = 1), default_provider text);
create table if not exists providers (id text primary key, kind text not null, name text not null, base_url text,
  model text not null default '', context_window int, team_id text, created_at timestamptz not null default now());
create table if not exists secrets (provider_id text primary key references providers on delete cascade,
  sealed bytea not null, updated_at timestamptz not null default now());
create table if not exists profiles (id text primary key, name text not null, instructions text not null default '',
  provider text references providers, model text not null default '', session_id text, handoff text, preview text,
  created_at timestamptz not null default now());
create table if not exists sent (profile_id text references profiles on delete cascade, message_id text,
  input text not null, files jsonb not null, primary key (profile_id, message_id));
create table if not exists messages (id bigserial primary key, profile_id text not null references profiles on delete cascade,
  session_id text not null, message_id text not null, role text not null, text text not null,
  created_at timestamptz not null default now(), tsv tsvector generated always as (to_tsvector('simple', text)) stored,
  unique (profile_id, message_id, role));
create index if not exists messages_tsv on messages using gin (tsv);
create index if not exists messages_profile on messages (profile_id, created_at);
-- The library: one copy of each file by its SHA-256, and a tag for each bot and chat that saved it. A deleted bot's
-- tags keep the item, with no bot. Names split at ASCII separators, so "report" finds quarterly-report_v2.md.
create table if not exists library (id text primary key, sha256 text not null unique, kind text not null,
  origin text not null, name text not null, type text not null, size int not null, data bytea not null,
  text text not null default '', created_at timestamptz not null default now(),
  tsv tsvector generated always as (to_tsvector('simple',
    regexp_replace(name || ' ' || left(text, 200000), '[-_./\\\\]+', ' ', 'g'))) stored);
create table if not exists library_tags (item_id text not null references library on delete cascade,
  profile_id text references profiles on delete set null, session_id text,
  created_at timestamptz not null default now(), unique (item_id, profile_id, session_id));
create index if not exists library_tsv on library using gin (tsv);
create index if not exists library_tags_bot on library_tags (profile_id, created_at desc);
do $$ begin
  -- Images sent before the library move into it once, with the name and chat their message gave them. The same
  -- bytes held by several bots become one item, named by the earliest, with a tag for each.
  if exists (select 1 from information_schema.tables where table_schema = current_schema() and table_name = 'images') then
    create temp table moved on commit drop as
      select i.profile_id, split_part(i.name, '.', 1) as sha256, coalesce(f.name, i.name) as name, i.type, i.data,
        m.session_id, coalesce(m.created_at, now()) as created_at
      from images i
      left join lateral (select s.message_id, e->>'name' as name from sent s, jsonb_array_elements(s.files) e
        where s.profile_id = i.profile_id and e->>'url' = '/api/profiles/' || i.profile_id || '/uploads/' || i.name limit 1) f on true
      left join lateral (select session_id, created_at from messages
        where profile_id = i.profile_id and message_id = f.message_id and role = 'user') m on true;
    insert into library (id, sha256, kind, origin, name, type, size, data, created_at)
      select distinct on (sha256) left(replace(gen_random_uuid()::text, '-', ''), 12), sha256, 'image', 'uploaded', name, type,
        octet_length(data), data, created_at
      from moved order by sha256, created_at;
    insert into library_tags (item_id, profile_id, session_id, created_at)
      select l.id, mv.profile_id, mv.session_id, mv.created_at from moved mv join library l using (sha256) on conflict do nothing;
    drop table images;
  end if;
end $$;
create table if not exists models_dev (id int primary key default 1 check (id = 1), etag text, data jsonb, fetched_at timestamptz);
alter table profiles add column if not exists shape text not null default 'circle';
alter table profiles add column if not exists color text not null default 'brown';
do $$ begin
  -- The first bot starts pinned. Pins came after bots did, so adding the column pins the oldest bot, once.
  if not exists (select 1 from information_schema.columns where table_schema = current_schema() and table_name = 'profiles' and column_name = 'pinned_at') then
    alter table profiles add column pinned_at timestamptz;
    update profiles set pinned_at = now() where id = (select id from profiles order by created_at, id limit 1);
  end if;
end $$;
`;

export type Sql = postgres.Sql;
export type ProviderRecord = { id: string; kind: string; name: string; baseUrl: string | null; model: string; contextWindow: number | null; teamId: string | null };
// A profile as stored. Whether its bot is busy is known only to the running process.
export type StoredProfile = Omit<Profile, "busy">;

// Each change is one statement or one transaction, so concurrent requests cannot interleave a read-modify-write.
export async function createStore(databaseUrl: string) {
  // Column names convert between snake_case and camelCase. Values do not, so stored JSON comes back as it went in.
  const sql = postgres(databaseUrl, { onnotice: () => {}, transform: { column: { from: postgres.toCamel, to: postgres.fromCamel } } });
  await sql.unsafe(schema);
  const one = <T>(rows: readonly T[]) => rows[0] ?? null;
  const profile = (rows: readonly StoredProfile[]) => one(rows);
  const columns = sql`id, name, instructions, coalesce(provider, '') as provider, model, shape, color, session_id, handoff, preview, pinned_at is not null as pinned`;

  return {
    sql,
    profiles: {
      // Pinned bots first, in the order they were pinned, then the rest by name.
      list: async (): Promise<StoredProfile[]> => sql<StoredProfile[]>`select ${columns} from profiles order by pinned_at nulls last, lower(name), id`,
      get: async (id: string) => profile(await sql<StoredProfile[]>`select ${columns} from profiles where id = ${id}`),
      create: async (fields: Fields) =>
        profile(await sql<StoredProfile[]>`insert into profiles (id, name, instructions, provider, model, shape, color, pinned_at)
          values (${newId()}, ${fields.name}, ${fields.instructions}, ${fields.provider || null}, ${fields.model}, ${fields.shape}, ${fields.color},
            case when exists (select 1 from profiles) then null else now() end)
          returning ${columns}`)!,
      update: async (id: string, fields: Partial<Fields & { sessionId: string | null; handoff: string | null; preview: string }>) => {
        const values = { ...fields, ...(fields.provider === undefined ? {} : { provider: fields.provider || null }) };
        // A body with nothing fxbot reads changes nothing.
        if (!Object.keys(values).length) return profile(await sql<StoredProfile[]>`select ${columns} from profiles where id = ${id}`);
        return profile(await sql<StoredProfile[]>`update profiles set ${sql(values)} where id = ${id} returning ${columns}`);
      },
      // A concurrent first send keeps the id already saved.
      claimSession: async (id: string, sessionId: string) =>
        profile(await sql<StoredProfile[]>`update profiles set session_id = coalesce(session_id, ${sessionId}) where id = ${id} returning ${columns}`),
      // A pinned bot keeps its place. A new pin needs a free one of the `maxPinned`, checked in the same statement.
      pin: async (id: string, pinned: boolean) =>
        pinned
          ? (await sql`update profiles set pinned_at = coalesce(pinned_at, now()) where id = ${id}
              and (pinned_at is not null or (select count(*) from profiles where pinned_at is not null) < ${maxPinned}) returning id`).length > 0
          : (await sql`update profiles set pinned_at = null where id = ${id}`, true),
      remove: async (id: string) => void (await sql`delete from profiles where id = ${id}`),
      usingProvider: async (provider: string) => Number((await sql`select count(*) from profiles where provider = ${provider}`)[0].count),
    },
    settings: {
      get: async (): Promise<Settings> => ({ defaultProvider: one(await sql`select default_provider from settings`)?.defaultProvider ?? "" }),
      save: async ({ defaultProvider }: Settings) => {
        await sql`insert into settings (id, default_provider) values (1, ${defaultProvider || null})
          on conflict (id) do update set default_provider = excluded.default_provider`;
        return { defaultProvider };
      },
    },
    providers: {
      list: async () => sql<ProviderRecord[]>`select id, kind, name, base_url, model, context_window, team_id from providers order by created_at, id`,
      get: async (id: string) => one(await sql<ProviderRecord[]>`select id, kind, name, base_url, model, context_window, team_id from providers where id = ${id}`),
      save: async (record: ProviderRecord, tx: Sql = sql) => {
        await tx`insert into providers ${tx(record, "id", "kind", "name", "baseUrl", "model", "contextWindow", "teamId")}
          on conflict (id) do update set kind = excluded.kind, name = excluded.name, base_url = excluded.base_url, model = excluded.model,
          context_window = excluded.context_window, team_id = excluded.team_id`;
        return record;
      },
      remove: async (id: string) => void (await sql`delete from providers where id = ${id}`),
    },
    sent: {
      get: async (id: string, messageId: string): Promise<Sent | null> =>
        one(await sql<Sent[]>`select input, files from sent where profile_id = ${id} and message_id = ${messageId}`),
      save: async (id: string, messageId: string, { input, files }: Sent) =>
        void (await sql`insert into sent values (${id}, ${messageId}, ${input}, ${sql.json(files)}) on conflict do nothing`),
    },
    close: () => sql.end({ timeout: 5 }),
  };
}

export type Store = Awaited<ReturnType<typeof createStore>>;
