-- A subagent started on a call (phone 0.2.0, docs/phases/phone-v3.md): the call's session, whose bot it reports to, in
-- the call while it's on, or in the bot's own chat after.
alter table subagents add column call_session text;
