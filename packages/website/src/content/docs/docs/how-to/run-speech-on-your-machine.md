---
title: "Run speech on your machine"
description: "Hear and speak on calls with Speaches on your own machine: Whisper listens and Kokoro speaks there, with no voice service."
---

The phone plugin's **Speech server** is any server with OpenAI's audio endpoints, `/v1/audio/transcriptions` and `/v1/audio/speech`, on your machine. [Speaches](https://speaches.ai) is one: Whisper models hear you, and Kokoro speaks. LocalAI, Kokoro-FastAPI, and whisper.cpp's server work too.

## Run Speaches

1. Start it, with podman or docker. The CPU image is about 2 GB:

   ```sh
   podman run -d --name speaches -p 127.0.0.1:8000:8000 \
     -v speaches-models:/home/ubuntu/.cache/huggingface/hub \
     ghcr.io/speaches-ai/speaches:latest-cpu
   ```

2. Download a model to hear you, and one to speak:

   ```sh
   curl -X POST http://localhost:8000/v1/models/Systran/faster-whisper-small
   curl -X POST http://localhost:8000/v1/models/speaches-ai/Kokoro-82M-v1.0-ONNX
   ```

   `Systran/faster-whisper-tiny.en` is smaller and quicker, in English only.

## Add it to fxbot

1. In **Settings** › **Providers**, choose **Add provider**, and under **For phone**, pick **Speech server**.
2. Give its address, `http://localhost:8000/v1`. In fxbot's container, `localhost` is the container's own: give the machine's address, as for Ollama.
3. In phone's tab, under **Voice**, pick **Speech server** for **Listening** and **Speaking**. The models are Speaches' names: `Systran/faster-whisper-small` to listen, `speaches-ai/Kokoro-82M-v1.0-ONNX` to speak, and a voice such as `af_heart`.

It hears you one stretch at a time: what you said goes once you pause, and you cut the bot off by talking over it for most of a second. A computer with no GPU takes a moment to hear each stretch, longer with a bigger Whisper model.
