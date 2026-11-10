-- A name of its own for each subagent, a scientist's, and its color, by its number in the page's palette. Earlier ones
-- are named in the order each bot started them, with a color each in turn.
alter table subagents add column name text not null default '', add column color int not null default 0;
update subagents s set name = n.name, color = n.place % 8 from (
  select id, place, (array['Lovelace','Curie','Turing','Hopper','Noether','Euler','Gauss','Darwin','Faraday','Tesla','Kepler',
    'Galileo','Newton','Hypatia','Fermat','Pascal','Bohr','Planck','Feynman','Shannon','Fourier','Boole','Babbage','Meitner','Franklin','Ramanujan'])[place + 1] as name
  from (select id, (row_number() over (partition by bot order by id) - 1) % 26 as place from subagents where name = '') ranked) n
where s.id = n.id;
