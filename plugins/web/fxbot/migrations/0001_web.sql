-- The owner's picks, from the Web section of the plugin's tab: the added provider that searches, the one that reads
-- pages (none is fxbot itself), and the one that researches. None picked, or one that's gone, is the first added that can.
create table picks (
  only_one boolean primary key default true check (only_one),
  search text,
  read text,
  research text
);
-- What each tool call showed, for its view in the chat, by the model's id for the call: a search's results, a page's
-- title and address, research's sources. Kept 30 days.
create table calls (
  id text primary key,
  bot text not null,
  view jsonb not null,
  at timestamptz not null default now()
);
create index calls_at on calls (at);
