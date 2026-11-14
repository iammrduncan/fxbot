-- Idle compaction's size: how long a bot's own chat or a room must be, in tokens at 4 bytes of text each, before it's
-- compacted while idle. 30,000 tokens is the 120 KB it was before this was a setting.
alter table settings add column idle_compact_tokens int not null default 30000
    check (idle_compact_tokens between 1000 and 1000000);
