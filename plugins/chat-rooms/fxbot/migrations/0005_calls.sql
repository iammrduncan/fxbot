-- A message's label, shown with it, such as "your call" for what the owner said on a call, and its note, which the
-- room's bots read and the room doesn't show. A message from another plugin, such as a subagent's report, is the
-- author 'plugin', named by its label.
alter table messages add column label text;
alter table messages add column note text;
