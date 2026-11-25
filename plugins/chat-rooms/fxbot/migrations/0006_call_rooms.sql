-- A room's call is a side conversation (phone 0.2.0, docs/phases/phone-v3.md): it runs in a call room of its own, for
-- the room in call_of, left out of the list. A pill in a room's timeline, such as the call's, is a message whose author
-- is 'pill': its words in label, what it holds in text, a place it opens, and whether the bots read it.
alter table rooms add column call_of int references rooms on delete cascade;
alter table messages add column open text, add column in_context boolean not null default true;
