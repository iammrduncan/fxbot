-- Where a page goes when a site blocks fxbot's own read, from the Web section: none tells the bot what else could read
-- it, "browser" is the bot's own browser, and anything else is an added provider that reads, by its id.
alter table picks add column blocked text;
