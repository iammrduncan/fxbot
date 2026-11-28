-- The canonical plugin that sent a message, kept apart from its display label for authorization after a restart.
alter table sent add column sender text;
