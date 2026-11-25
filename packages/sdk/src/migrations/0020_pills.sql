-- Pills (docs/phases/phone-v3.md): entries a plugin adds in the middle of a bot's chat, such as phone's call. `after` is
-- the message whose turn it follows. One in context reaches the model ahead of the chat's next turn, `given_with`,
-- whose message the chat still shows alone.
create table pills (id serial primary key, profile_id text not null references profiles on delete cascade,
  session_id text not null, after text, plugin text not null, label text not null, text text not null default '',
  open text, in_context boolean not null default false, given_with text, created_at timestamptz not null default now());
create index pills_session on pills (profile_id, session_id, id);
