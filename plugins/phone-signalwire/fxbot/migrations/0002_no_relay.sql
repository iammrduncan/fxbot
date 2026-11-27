-- Since 0.2.0, phone carries each call itself on SignalWire's SIP account, and this plugin holds no call: the calls a
-- restart had to end through RELAY are gone.
drop table if exists kept;
