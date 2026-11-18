-- A call SignalWire may still hold up, and what a restart needs to end it from a new connection: its id, its node, and
-- the protocol of the connection that placed it. phone keeps everything else about a call.
create table kept (
  sid text primary key,
  node text not null,
  protocol text not null,
  at timestamptz not null default now()
);
