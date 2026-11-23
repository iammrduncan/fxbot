-- Every agent herdr has, on every machine, as the plugin last saw it, for the message box's @ list: `machine` '' for the
-- one fxbot runs on. Synced every minute; a machine that doesn't answer keeps its rows.
create table panes (
  machine text not null,
  pane text not null,
  name text not null,
  label text not null default '',
  kind text not null default '',
  session_id text not null default '',
  session_name text not null default '',
  tab text not null default '',
  workspace text not null default '',
  folder text not null default '',
  title text not null default '',
  status text not null default 'unknown',
  seen_at timestamptz not null default now(),
  primary key (machine, pane)
);
