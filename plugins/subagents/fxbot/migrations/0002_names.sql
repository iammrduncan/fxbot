-- A name of its own for each subagent, from the phonetic alphabet, and its color, by its number in the page's palette,
-- one for each name in turn. Earlier ones are named in the order each bot started them.
alter table subagents add column name text not null default '', add column color int not null default 0;
update subagents s set name = n.name, color = n.place % 8 from (
  select id, place, (array['Alpha','Bravo','Charlie','Delta','Echo','Foxtrot','Golf','Hotel','India','Juliet','Kilo','Lima','Mike',
    'November','Oscar','Papa','Quebec','Romeo','Sierra','Tango','Uniform','Victor','Whiskey','X-ray','Yankee','Zulu'])[place + 1] as name
  from (select id, (row_number() over (partition by bot order by id) - 1) % 26 as place from subagents where name = '') ranked) n
where s.id = n.id;
