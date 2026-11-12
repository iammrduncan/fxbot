-- How hard a bot's model thinks: '' is the model's own default, else a level its model offers, such as 'high'. A plugin's
-- session can have its own, such as a subagent's; null there is the bot's.
alter table profiles add column effort text not null default '' check (effort ~ '^[A-Za-z0-9._-]{0,64}$');
alter table plugin_sessions add column effort text check (effort ~ '^[A-Za-z0-9._-]{1,64}$');
