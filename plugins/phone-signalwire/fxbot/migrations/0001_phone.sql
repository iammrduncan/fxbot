-- Each call: who it was for, why it was placed, and how it went. What was said is in the bot's chat, and nothing is
-- recorded. sid, node, and protocol are what a restart needs to end a call SignalWire kept up.
create table calls (
  id bigserial primary key,
  bot text not null,
  why text not null,                        -- button, asked, callback, own, confirm
  reason text,
  sid text,                                 -- SignalWire's call id
  node text,                                -- and its node, to end it after a restart
  protocol text,                            -- the connection's protocol, to connect again after a restart
  status text not null default 'ringing',   -- ringing, on, ended, voicemail, missed, busy, failed
  seconds int,
  error text,
  at timestamptz not null default now(),
  answered_at timestamptz,
  ended_at timestamptz
);
-- One call a bot may make later, which the owner asked for: "call me when the build is done".
create table callbacks (bot text primary key, reason text not null, until timestamptz not null);
-- Whether a bot may call the owner on its own.
create table bots (bot text primary key, on_its_own boolean not null default false);
