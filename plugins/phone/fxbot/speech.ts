import { deepgram } from "./speech/deepgram.ts";
import { elevenlabs } from "./speech/elevenlabs.ts";
import { mistral } from "./speech/mistral.ts";
import { openai } from "./speech/openai.ts";
import type { Adapter } from "./audio.ts";

// Which adapter listens and speaks for each kind of provider (docs/_completed/phases/phone-v2.md). The adapters and what they share
// are in speech/ and audio.ts, apart from this list, so none of them imports it.
export * from "./audio.ts";

// In the order the defaults are picked: ElevenLabs, then Deepgram, then Mistral, then OpenAI's shape.
export const adapters: Adapter[] = [elevenlabs, deepgram, mistral, openai];
/** Who listens for a kind, streaming first, and who speaks for it. */
export const listenerFor = (kind: string) => adapters.find((a) => a.listen?.kinds.includes(kind)) ?? adapters.find((a) => a.transcribe?.kinds.includes(kind));
export const speakerFor = (kind: string) => adapters.find((a) => a.speak?.kinds.includes(kind));
