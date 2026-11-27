-- Phone 0.1.x kept a bot's own voice as a SignalWire voice name, such as amazon.Joanna:neural:en-US. Calls speak with
-- the provider in phone's Voice section now, which doesn't know those names, so a bot that has one speaks in the Voice
-- section's voice until another is picked for it.
update bots set voice = null where voice ~ '^(amazon|azure|cartesia|deepgram|elevenlabs|gcloud|grok|groq-tts|inworld|openai|rime)\.';
