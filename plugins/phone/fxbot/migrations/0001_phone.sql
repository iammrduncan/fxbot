-- Each call: who it was for, why it was placed, the provider that carried it, and how it went. What was said is in the
-- bot's chat, and nothing is recorded.
create table calls (
  id bigserial primary key,
  bot text not null,
  why text not null,                        -- button, asked, callback, own, confirm
  reason text,
  provider text not null,                   -- the provider plugin's name, such as phone-signalwire
  status text not null default 'ringing',   -- ringing, on, ended, voicemail, missed, busy, failed
  seconds int,
  error text,
  at timestamptz not null default now(),
  answered_at timestamptz,
  ended_at timestamptz
);
-- One call a bot may make later, which the owner asked for: "call me when the build is done".
create table callbacks (bot text primary key, reason text not null, until timestamptz not null);
-- What each bot gets: Call me, calls the owner asks for, and calls on its own, and a provider and a voice of its own,
-- or none for the default's.
create table bots (
  bot text primary key,
  provider text,
  voice text,
  button boolean not null default true,
  asked boolean not null default true,
  own boolean not null default false
);
-- The provider calls go through unless a bot has its own.
create table chosen (only_one boolean primary key default true check (only_one), provider text not null);
