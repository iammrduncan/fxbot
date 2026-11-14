---
title: "Baseten"
description: "Baseten's Model APIs serve open models such as GLM, Kimi, and DeepSeek, charged by the token. Add it to fxbot with a team key from its organization settings."
---

Baseten's Model APIs serve open models from many labs, such as GLM, Kimi, DeepSeek, and gpt-oss, charged by the token. A new workspace gets credits to start. Once they run out, Baseten needs a card or a bank account in [its billing settings](https://app.baseten.co/settings/billing). [Its pricing](https://www.baseten.co/pricing/) lists each model's rate.

Baseten's sign-in in the browser is only for its own tools, so fxbot takes a key.

## Make a key

Make a team key. A personal key must end within 90 days, and Baseten revokes one that goes 30 days unused, so a bot you haven't talked to in a month would stop.

1. Open [app.baseten.co/settings/api_keys](https://app.baseten.co/settings/api_keys), and sign in or make an account.
2. Choose **Create API key**, give it a name, such as `fxbot`, and pick **Team**.
3. Set **Expiration** to **Never**, so the key doesn't stop. An organization with a limit on keys doesn't offer **Never**: pick the longest it offers. Choose **Next**.
4. Under **Team scope**, pick the team, and under **Permissions**, choose **Call Model APIs**.
5. Choose **Create API key**, and copy the key. Baseten shows it only once. It starts with `b10_`.

If you can't make a team key, a personal key works until it ends. Then make another, and add it with the provider's **Replace key**.

## Add it to fxbot

1. In **Settings** › **Providers**, choose **Add provider**, then **Baseten**, under **Use a key**.
2. Paste the key, and choose **Add**. fxbot checks it with Baseten first.
3. Pick a model. Tick **Make it the default for new bots** to start each new bot on it.

| Field | What to put there |
| --- | --- |
| **API key** | The key you copied. It goes to fxbot's server once, sealed, and never comes back to the page. |
| **Name** | Optional. It's **Baseten** when you leave it empty. |

Baseten's address is `https://inference.baseten.co/v1`. fxbot fills it in.

## Its models

fxbot lists the models from Baseten's own list, with each one's context window, tool use, and images from [models.dev](https://models.dev), where models.dev knows the model. A model models.dev doesn't know still lists, without them. Baseten names its models with the maker in front, such as `zai-org/GLM-5.3`, which fxbot picks after you connect.

A model whose name ends in `-Fast` has the same weights as the one without, on capacity of its own, at its own price and rate limits.

## Quirks

These are what the research for this page found, in Baseten's docs. fxbot hasn't run Baseten with a real key yet.

- **Beam needs its thinking sent back.** Baseten says `reflection/Beam-1.0` answers HTTP 400 unless each earlier reply in the chat carries its thinking, as `reasoning_content`. If a chat on Beam fails after its first reply, pick another model.
- **GLM 5.2 thinks only when asked,** through `chat_template_args`, which fxbot doesn't send. It may answer without thinking, whatever its **Thinking** level. GLM 5.3 doesn't need it.
- **Baseten's list can disagree with its limits.** Its docs warn that the context window and output length its list reports can differ from what it enforces.

## When it fails

- **"Baseten rejected this key (HTTP 401): it's wrong, or it was deleted."** A personal key also stops once it ends, or after 30 days unused. Make another, and add it with the provider's **Replace key**.
- **A chat fails with HTTP 402.** The workspace's credits ran out with no payment method, or a monthly budget stopped it. Add a payment method in [its billing settings](https://app.baseten.co/settings/billing).
- **A chat stops with HTTP 429.** You've reached the model's limit on requests or tokens a minute. A new account that isn't verified gets 15 requests a minute, which a bot using tools reaches quickly. [Baseten's rate limits](https://docs.baseten.co/inference/model-apis/pricing-and-limits) say how to get verified, for 120. fxbot tries again by itself, and stops the turn after 5 minutes of nothing but refusals ([Providers](/docs/reference/providers/)).
- **A chat stops with HTTP 529.** Baseten had no capacity for that model just then, even within your limits. Try again, or pick another model.
