-- The chat room session a subagent was started from, whose room hears its tells and report, or null for the bot's own
-- chat with the owner.
alter table subagents add column room_session text;
