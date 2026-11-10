-- One row for each subagent: what started it, its session, and how it ended.
create table subagents (
  id serial primary key,
  bot text not null,
  key text not null unique,          -- a hash of the starting turn, the title, and the task: a repeat starts nothing
  turn text not null,                -- the messageId of the turn that started it: the subagents of one turn report together
  ask text not null,                 -- the owner's request it comes from, for perAsk
  session text,
  title text not null,
  task text not null,
  state text not null default 'working', -- working, done, failed, or stopped
  ended text not null default '',    -- why it ended, in words
  report text not null default '',
  calls int not null default 0,
  stopped_by text,                   -- owner, bot, or restart, when stopped
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  reported_at timestamptz
);
create index on subagents (bot, started_at desc);
create index on subagents (turn);
create index on subagents (ask);
