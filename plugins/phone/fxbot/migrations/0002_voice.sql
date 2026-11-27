-- How phone hears and speaks on a call it carries itself (Phone v2): a provider the owner added and a model for each,
-- or none for This device, the page's own speech, and the voice the bot speaks in unless it has its own.
create table voice (
  only_one boolean primary key default true check (only_one),
  listen_provider text,                     -- an added provider's id, or 'device'
  listen_model text,
  speak_provider text,
  speak_model text,
  speak_voice text
);
-- A call in a chat room is the room's: its id, for Last calls. An app call's provider is 'app', and its why 'talk'.
alter table calls add column room int;
