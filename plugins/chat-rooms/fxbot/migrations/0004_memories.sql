-- A room's memories: notes every bot in the room reads there. `by` is 'owner' or the bot that saved one. `key` catches
-- a duplicate in the room: the same text, lowercased, with its spaces collapsed.
create table memories (id serial primary key, room int not null references rooms on delete cascade, text text not null,
  by text not null, at timestamptz not null default now(),
  key text generated always as (lower(regexp_replace(btrim(text), '\s+', ' ', 'g'))) stored, unique (room, key));
