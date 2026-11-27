# Local voice: phone hears you on your own machine, as you talk

Phone gets a listener that runs on the owner's own machine and hears as they talk, as the cloud ones do. It's built on what powers [Hex](https://anoma.ly/hex/), the local dictation app: transcribe.cpp and NVIDIA's streaming speech models.

- **Words as you talk.** A streaming model, Nemotron Speech Streaming or a Parakeet one, gives words while the owner speaks.
  - **Cutting in** works on words, as with ElevenLabs' Scribe or Deepgram's Flux, not on most of a second of voice.
  - **The call knows sooner** when they're done.
- **End of turn from how they talk,** with SAVA, a small model that hears when a speaker has finished, beside phone's pause. A trailing "and…" isn't taken as done.
- **Nothing leaves the machine,** and nothing is billed.
- **One container,** `speech`, in the release install, as the local embedder is: on by default where the machine can afford it, its models downloaded on first start. In a bot's settings it's a provider like any other, **On this machine**, under **For phone**.
- **Speaking stays as it is:** a cloud voice, or Kokoro on [Speaches](../../packages/website/src/content/docs/docs/how-to/run-speech-on-your-machine.md). Neither transcribe.cpp nor Hex speaks.

Status: planned on 2026-11-27 at the owner's word, not built.
- **Hex:** its source was read at `7ae9c03` on 2026-11-27, through GitHub's API.
- **transcribe.cpp:** its README and model docs were read through GitHub's API too.
- Nothing was downloaded or run. This session refused to run a downloaded speech engine, so **every speed here is a claim to measure**, and measuring is the checklist's first item.

## What the owner asked

"Also for our audio work we have a new reference hex which I put in our reseearch directive doc we can take a look at it for local audio stuff.." (2026-11-27). They added `https://anoma.ly/hex/` to the [research directive](../research-directive.md) the same day.

## 0. Core or plugin

**A phone adapter (plugin), and an optional container in the release install, as the embedder is.**
- **Phone's listening adapters** are where every listener lives (`plugins/phone/fxbot/speech/`). This is one more, about 60 lines, talking to a local service as the Speaches adapter does.
- **The service is install-level, not core code:** a container in `deploy/compose.yaml`, behind a profile, as `embed` is.
  - It's not in fxbot's process: a native speech engine in the server would weigh on every fxbot. A plugin added from GitHub can't count on finding a native package either.
  - An owner who doesn't want it turns it off, as they can the embedder.
- **No core change.** The provider entry is phone's, in its `plugin.json`, with `models: "none"`, as ElevenLabs' and Speaches' are.

## 1. Research

### fxbot today

- **Phone hears with:**
  - **Streaming cloud listeners:** ElevenLabs Scribe, Deepgram Flux, and Mistral. They give words as the owner talks and end turns themselves.
  - **Batch listeners:** OpenAI-shaped and Groq. Phone's own voice detector cuts what the owner says into stretches, and each stretch is sent once it ends.
  - **This device:** the browser's own speech.
- **Local today is Speaches** ([Run speech on your machine](../../packages/website/src/content/docs/docs/how-to/run-speech-on-your-machine.md)): Whisper through the OpenAI-shaped batch adapter.
  - It hears one stretch at a time, so what was said goes only after a pause.
  - A cut-in needs most of a second of voice.
  - On a CPU, "takes a moment to hear each stretch".
  - Its CPU image is about 2 GB.
- **The voice loop** (`plugins/phone/fxbot/voice.ts`) takes a stream listener as `{ open(heard, failed) → { write(pcm), close() }, turns }`. Audio comes as 16 kHz PCM16 in 20 ms frames, from the app or now from phone's own SIP line (phone-v2's part 2).
- **The release install** runs llama.cpp's server as `embed`, a container with its models in a volume, `cpu_shares: 256`, and a GPU file for NVIDIA machines (`deploy/compose.yaml`, `setup.sh`).

### Hex

[anomalyco/hex](https://github.com/anomalyco/hex), MIT, Rust; read at `7ae9c03` (2026-11-27).
- **Local dictation** for Mac, Windows, Linux, iOS, and Android: hold a key, speak, and it pastes. The first run downloads a model, "after that nothing leaves your machine" (README).
- **Its engine is transcribe.cpp,** pinned with a few patches (`Cargo.toml` 46-56). It runs on the CPU, on Vulkan on Linux and Windows, and on Metal on a Mac.
- **Its models,** GGUF:
  - **On an English system,** the default is Parakeet Unified English, which "writes while you talk, so the text is ready when you let go".
  - **Others:** Parakeet v3 (25 European languages), Whisper large-v3-turbo, Qwen3-ASR 0.6B, SenseVoice Small, Nemotron 3.5 ASR (streaming, 27 languages), Granite Speech 5.0, and one-language models.
  - **Licenses:** Parakeet's weights are NVIDIA's, CC BY 4.0 (`THIRD_PARTY_NOTICES.md`).
- **A local API for other apps** (`docs/streams.md`, `docs/cli.md` 380-450). An owner-only file, `local-api.json`, gives a port and a token on `127.0.0.1`. Two routes:
  - **`POST /transcriptions`** takes 16 kHz WAV pieces of up to 30 s.
  - **`/streams`** is live:
    - Create a stream: `{ sampleFormat: "s16le", sampleRate: 16000 }`.
    - Push samples with `POST /streams/{id}/audio`, 100 ms to 1 s a request.
    - Read `GET /streams/{id}/events` as server-sent events: `partial` with `stable` and `tentative` text, `segment` for a finished window, then `final`.
    - It uses the model dictation holds, and only the running Hex app serves it today. A shared engine service is planned (`ROADMAP.md`).
- **Meetings** records the owner and the other side as separate tracks, and merges a speaker's lines within 3 s in its transcript.

### transcribe.cpp

[handy-computer/transcribe.cpp](https://github.com/handy-computer/transcribe.cpp), MIT; README read 2026-11-27.
- **What it is:** "C/C++ speech-to-text inference library. Runs diverse STT model families via GGUF models on the ggml runtime." It runs on CPU, CUDA, Vulkan, and Metal. Its 16 families and 60 variants are each "numerically verified and WER-tested" under `huggingface.co/handy-computer`.
- **Streaming models:**
  - Nemotron Speech Streaming EN 0.6B
  - Nemotron 3.5 ASR Streaming 0.6B, 27 languages
  - Moonshine Streaming, tiny, small, and medium
  - Multitalker Parakeet Streaming 0.6B, which tells speakers apart
  - Voxtral Realtime 4B
  - Parakeet's 0.6B to 1.1B, in batch
- **Turns:**
  - **Silero VAD v6.2** detects speech.
  - **SAVA,** from Inworld, Apache-2.0, "every 40 ms … gives the probability that the speaker has finished their turn, and whether the audio is speech… Any language. CPU is the default backend" (`docs/models/sava.md`, `docs/turn.md`).
- **A Node binding:** `npm install transcribe-cpp`, with "A matching prebuilt native package … selected automatically for your platform … nothing to compile". `TranscribeModel.load(gguf)`, `transcribe(pcm)`, and streams.
- **No server comes with it,** so a service needs a small one of its own.

### What wasn't verified

- **Speed on the owner's machines:** how far behind the words come on a CPU with no GPU, and on their GPUs. The same for SAVA's end-of-turn delay.
- **Memory** of a 0.6B streaming model, and the prebuilt Node package on fxbot's base image, which is glibc on x86 and ARM.
- **The exact stream API** of the Node binding, beyond its README.

## 2. Key takeaways

1. **Streaming is what local listening lacks today.** Speaches works, but a stretch at a time, so a local call is slower and clumsier than a cloud one. A streaming model with words as you talk closes that.
2. **transcribe.cpp is the engine to take,** as Hex took it: MIT, GGUF, CPU first, with GPUs when there are any, many models, and SAVA for turns.
3. **A container, as the embedder is:** native code and model files stay out of fxbot's own process and image, it's on or off with a profile, and the GPU file pattern carries over.
4. **Hex's own local API is a nice extra, not the plan.** It serves only while the Hex app runs, on `127.0.0.1` of the machine it's on, which is rarely where fxbot runs. An adapter for it would be about 60 lines, if the owner wants it.
5. **Measure first.** The plan stands or falls on the first words coming well under a second behind on the owner's own CPU.

## 3. Implementation

### The `speech` container (`deploy/`, and a small server of its own)

- **An image of fxbot's own,** `ghcr.io/iammrduncan/fxbot-speech`, built in this repo's CI beside fxbot's: Node, the `transcribe-cpp` package, and a server of about 150 lines (`speech/server.mjs`).
- **The server:** one WebSocket, `/listen?model=<id>`. In: 16 kHz PCM16. Out: JSON lines.
  - `{ partial: text }` while the owner talks.
  - `{ final: text }` when a stretch ends.
  - `{ turn: true }` when SAVA says they've finished, with phone's `pause` as its upper bound.
  - Plus `/health`, and `GET /models` for what's downloaded.
- **Models:** downloaded on first start into the `models` volume the embedder uses, by name from the `handy-computer` collection, with a SHA-256 check. The default is Nemotron Speech Streaming EN 0.6B, or whichever measures best.
- **In `deploy/compose.yaml`:** `speech`, behind a profile, with `cpu_shares` as the embedder has, a healthcheck, and a GPU file for NVIDIA machines, `compose.gpu.<engine>.yaml`.
- **In `setup.sh`:** `FXBOT_SPEECH=cpu`, `gpu`, or `off`. By default it's on where the machine has the memory the first item measures, and off where it doesn't, with a line saying so.

### Phone: the **On this machine** listener (`plugins/phone/fxbot/speech/local.ts`)

- **An entry in phone's `plugin.json`:** `local-speech`, "On this machine", `models: "none"`, with the address `http://speech:8090` in the release install, or one the owner gives, as for Speaches.
- **A stream adapter,** about 60 lines:
  - It opens `/listen` and sends each frame.
  - It turns `partial` into `heard({ type: "partial" })` and `final` into `heard({ type: "final" })`, as Scribe's adapter does.
  - With `turns: true`, phone holds nothing more after a `turn`.
- **The Voice section** lists it under **Listening**, with its models from `/models`.

### Hex, if the owner wants it (`plugins/phone/fxbot/speech/hex.ts`)

- **When it fits:** fxbot running on the owner's own desktop, where Hex runs.
- **What it does:** a stream adapter for Hex's `/streams`, about 60 lines. It reads `local-api.json`, creates a stream, pushes audio, and reads the events.

### What the owner sees

- **Voice section:** **On this machine** under **Listening**, picked like any other.
- **On a call:** words as they talk, a cut-in on their second word, and the bot answering once they're done, with nothing sent anywhere.
- **In the install:** the `speech` container beside the embedder, and `fxbot speech off` to stop it.

### Docs, when it's built

- **[Run speech on your machine](../../packages/website/src/content/docs/docs/how-to/run-speech-on-your-machine.md):** **On this machine** first, Speaches for speaking and for Whisper's languages.
- **The install's reference:** the `speech` container, `FXBOT_SPEECH`, and `fxbot speech`.
- **Phone's README:** the adapter's row.
- **`CHANGELOG.md`:** under `## Unreleased`.

### Size

- **The server:** about 150 lines, and its `Dockerfile`, about 20.
- **Compose and setup:** about 40 lines.
- **Phone's adapter:** about 60 lines, and 60 more for Hex's if wanted.

### Not in this phase

- **Speaking locally** with something new: Kokoro through Speaches stays the local voice.
- **Telling voices apart,** with Multitalker Parakeet.
- **Transcribing voice memos** with it: [Voice memos](voice-memos.md) can use the same service later.

## 4. Checklist

- [ ] **Measure first,** on the owner's machines, in a container of the check's own. For each of Nemotron Speech Streaming EN 0.6B, a Parakeet streaming model, and Moonshine Streaming small, measure:
  - how far the first words come behind the voice
  - the CPU it takes while a call talks
  - its memory
  - its download size
  - SAVA's end-of-turn delay

  Do it on a CPU-only machine and on one with an NVIDIA GPU, with a recorded call, and pick the default from that. If none comes well under a second behind on a CPU, say so and stop here.
- [ ] The `speech` image built, its server's `/listen`, `/health`, and `/models`, and a model downloaded and checked.
- [ ] `deploy/compose.yaml`'s `speech`, its GPU file, and `setup.sh`'s `FXBOT_SPEECH`, checked with another `COMPOSE_PROJECT_NAME`, `FXBOT_PORT`, and `FXBOT_ROOT`.
- [ ] Phone's **On this machine** listener on the check fxbot: partials, finals, a turn's end, and a cut-in on words, in an app call with Chromium's fake microphone playing recorded speech.
- [ ] **On dev,** a real call with the owner, listening on this machine and speaking with ElevenLabs. The owner's to judge.
- [ ] Hex's adapter, if the owner wants it, with Hex running on their desktop.
- [ ] The docs listed above.
- [ ] The repo checks: `npm run typecheck`, `npm run build-site`, `bash -n setup.sh deploy/fxbot`, `git diff --check`, and the image built.

## 5. Open questions

- **A container, or in fxbot's own process?** Recommended: a container, as the embedder is. In-process would be one service less, but a native engine and its models would come into every fxbot.
- **On by default?** Recommended: on where the first item finds the machine can afford it, off where it can't, as the embedder's GPU check decides for the GPU.
- **English first, or many languages?** Nemotron Speech Streaming is English. Nemotron 3.5 ASR Streaming has 27 languages, and its speed is to measure. Recommended: English by default, with the other a model to pick.
- **Hex's adapter?** Only useful where fxbot and Hex share a machine. Recommended: leave it out unless the owner runs fxbot on their desktop.
