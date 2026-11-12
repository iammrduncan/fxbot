-- Each room given a computer, with chat rooms added: its key, which names the computer and its home, and whether the
-- room uses it now. A room's computer from chat-rooms-computer, which this replaces, keeps its key, and so its home: its
-- table is read here once, while it's still added.
create table room_computers (room int primary key, key text not null unique, enabled boolean not null default true);
do $$ begin
  if to_regclass('plugin_chat_rooms_computer.computers') is not null then
    insert into room_computers (room, key, enabled) select room, key, enabled from plugin_chat_rooms_computer.computers
      on conflict do nothing;
  end if;
end $$;
