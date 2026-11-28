-- One working watch for each agent, with admission serialized in the plugin.
update watches set state = 'failed', ended_at = now()
  where state = 'working'
    and id not in (select min(id) from watches where state = 'working' group by machine, agent);

create unique index watches_one_working_agent on watches (machine, agent) where state = 'working';
