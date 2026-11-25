-- A call is a side conversation (docs/phases/phone-v3.md): its own session for the bot, the summary the bot wrote of it
-- for its main chat, and, for a room's call, the call room chat rooms made for it.
alter table calls add column session text, add column summary text, add column call_room int;
