# Memories

Each bot profile keeps its own persistent memory, so later conversations can use what that profile has already learned.

Decided in [provider logins](../_completed/phases/provider-logins.md): memories live in Postgres, and search is hybrid, pgvector plus full-text fused with reciprocal rank fusion. The embedding model is picked in Settings, from any provider that serves `/embeddings`. `chat_history` gains the vector half here.

Not planned yet.
