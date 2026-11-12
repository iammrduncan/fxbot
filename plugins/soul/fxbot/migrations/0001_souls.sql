-- Each bot's soul, in its own words, and when its first meeting started. A bot with neither has never met its owner.
create table souls (bot text primary key, text text not null default '' check (length(text) <= 4000),
  met_at timestamptz, updated_at timestamptz not null default now());
-- Every version, newest last, so the owner can go back. `by` is 'bot' or 'owner'.
create table versions (id serial primary key, bot text not null, text text not null, by text not null check (by in ('bot', 'owner')),
  at timestamptz not null default now());
create index versions_bot on versions (bot, id desc);
