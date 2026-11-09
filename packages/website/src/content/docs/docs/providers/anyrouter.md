---
title: "AnyRouter"
description: "Connect fxbot to models from many providers through AnyRouter."
---

AnyRouter provides one OpenAI-compatible API for models from multiple providers. Model availability and charges depend on your plan, credits, and any provider keys you connect to AnyRouter. See [AnyRouter pricing](https://anyrouter.dev/pricing) and its [model catalog](https://anyrouter.dev/models).

## Make a key

1. Sign in to [AnyRouter](https://anyrouter.dev/), then open [API keys](https://anyrouter.dev/dashboard/keys).
2. Create an inference API key and copy it. It starts with `sk-ar-v1-`. A management key, which starts with `ak_`, cannot run chat requests.

## Add it to fxbot

1. In **Settings** › **Providers**, choose **Add provider**, then **AnyRouter**, under **Use a key**.
2. Paste the inference key and choose **Add**. fxbot checks it at `https://anyrouter.dev/api/v1/auth/key`, because the model list is public.
3. Pick a model and choose **Done**. You can make it the default for new bots.

fxbot fills in the API address, `https://anyrouter.dev/api/v1`. The key is sent to fxbot's server and stored sealed. It is not returned to the page.

## Models and access

fxbot reads AnyRouter's model list and shows models that return text. Use the model's full ID, including its provider prefix. The list includes models that may require a paid plan, credits, or a connected provider key. A model appearing in the list does not guarantee your account can run it. Check its access requirements in the [model catalog](https://anyrouter.dev/models).

## When it fails

- **The key is rejected.** Check that you copied an inference key, not a management key. Create another key if needed and use **Replace key** in fxbot.
- **A model cannot be used.** Check its access requirements and your account's plan, credits, and connected provider keys.
- **A request is rate limited.** Check your plan's limits and retry later.
