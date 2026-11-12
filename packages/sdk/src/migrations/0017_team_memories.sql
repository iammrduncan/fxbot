-- Team memories: a memory with no bot is the team's, and every bot reads it. `by_bot` is the bot that saved a team
-- memory, when one did; it's cleared when that bot is deleted, and the memory stays. Every memory there is stays its
-- bot's own. A duplicate is the same text in the same set, a bot's own or the team's, so nulls count as one set.
alter table memories alter column profile_id drop not null,
  add column by_bot text references profiles on delete set null;
alter table memories drop constraint memories_profile_id_key_key,
  add constraint memories_set_key unique nulls not distinct (profile_id, key);
create index memories_team on memories (updated_at desc) where profile_id is null;
