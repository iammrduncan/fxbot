-- A name a plugin gives a session of its own, such as a subagent's name, which its tool calls carry, so the computer
-- can tell a bot's sessions apart. Empty for every session before it.
alter table plugin_sessions add column label text;
