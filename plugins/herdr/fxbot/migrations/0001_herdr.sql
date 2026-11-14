-- One row for each prompt a bot sent an agent, from the call to the agent's settled state, and whether the bot was told.
create table watches (
  id serial primary key,
  bot text not null,
  machine text not null default '',  -- herdr's label for the machine, '' for the one fxbot runs on
  agent text not null,               -- the agent's name or pane id there
  prompt text not null,
  asked text,                        -- the owner's words behind the turn that sent it, for Permissions' reviewer
  state text not null default 'working', -- working, done, blocked, timeout, gone, or failed
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  told boolean not null default false
);
create index on watches (state) where state = 'working';

-- The workspace the plugin made on each machine for the agents bots start, by its id there: '' for this machine.
create table workspaces (machine text primary key, workspace text not null, made_at timestamptz not null default now());

-- The machines a bot may reach, when the owner picked them in its settings: herdr's labels, and '' for this machine.
-- A bot with no row reaches every machine, with any herdr adds later.
create table bots (bot text primary key, machines text[] not null);
