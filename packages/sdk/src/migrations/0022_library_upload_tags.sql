-- Restore pre-library upload tags that 0001 limited to one chat; sent files and messages retain the other chats.
insert into library_tags (item_id, profile_id, session_id, created_at)
  select distinct l.id, s.profile_id, m.session_id, m.created_at
  from sent s
  cross join lateral jsonb_array_elements(s.files) e
  join library l on l.sha256 = substring(e->>'url' from '^/api/profiles/' || s.profile_id || '/uploads/([0-9a-f]{64})\.[a-z]+$')
  join messages m on m.profile_id = s.profile_id and m.message_id = s.message_id and m.role = 'user'
  on conflict do nothing;
