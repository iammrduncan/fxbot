-- Idle compaction: the minutes a bot's own chat is idle before it's compacted, 0 for off, and the model that writes the
-- summary when it isn't each bot's own. A removed provider clears it, and each bot's own model writes it again.
alter table settings add column idle_compact_minutes int not null default 30
    check (idle_compact_minutes = 0 or idle_compact_minutes between 5 and 1440),
  add column compact_provider text references providers on delete set null,
  add column compact_model text not null default '';
