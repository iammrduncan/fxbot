---
title: "Anthropic"
description: "Anthropic makes the Claude models. Add credit, then add it to fxbot with a key from the Claude Console, through Anthropic's OpenAI-compatible API."
---

Anthropic makes the Claude models. fxbot reaches them through Anthropic's OpenAI-compatible API, with a key from the Claude Console. You add credit before a key can run a model. Its prices are on its [pricing page](https://platform.claude.com/docs/en/about-claude/pricing).

## Make a key

1. Open [platform.claude.com/settings/keys](https://platform.claude.com/settings/keys), and sign in or make an account.
2. Add credit under [Billing](https://platform.claude.com/settings/billing) first.
3. Choose **Create key**. Give it a name, such as fxbot, pick when it expires, and scope it to a workspace.
4. Copy the key.

## Add it to fxbot

1. In **Settings** › **Providers**, choose **Add provider**, then **Anthropic**, under **Use a key**.
2. Paste the key, and choose **Add**. fxbot checks it with Anthropic first.
3. Pick a model. fxbot fills in `claude-sonnet-5-5` when Anthropic serves it. **Make it the default for new bots** starts new bots on it.

| Field | What to put there |
| --- | --- |
| **API key** | The key you copied. It goes to fxbot's server once, sealed, and never comes back to the page. |
| **Name** | Optional. It's **Anthropic** when you leave it empty. |

Anthropic's address is `https://api.anthropic.com/v1`. fxbot fills it in, and sends the key as `x-api-key` too, where Anthropic's model list wants it.

## Its models

fxbot lists the models from Anthropic's own list, with each one's context window, tool use, and images from [models.dev](https://models.dev), where models.dev knows the model.

## Quirks

These come from Anthropic's docs. fxbot hasn't run Anthropic with a real key yet.

- **Not Anthropic's own API.** Anthropic says its OpenAI-compatible API is "not considered a long-term or production-ready solution".
- **No prompt caching.** So a long chat costs more than it would through Anthropic's own API. For caching now, reach Claude through [AI Gateway with your own Anthropic key](/docs/providers/vercel/#claude-with-your-own-anthropic-key).
- **No thinking shown.** Claude 5 models think by default there, but the answer doesn't carry the thinking, so fxbot shows none.
- **A key for one workspace.** A key that isn't scoped to a workspace needs Anthropic's `anthropic-workspace-id` header on every request. fxbot doesn't send it, and Anthropic answers with 400.

## When it fails

- **"Anthropic rejected this key (HTTP 401): it's wrong, or it was deleted."** It may also have expired. Make another, and paste that.
- **"The key check failed (HTTP 400)."** The key may not be scoped to a workspace. Make one that is.
- **"Anthropic rejected this provider's key. Replace it in Settings › Providers."** fxbot says this when a chat gets a 401 or a 403, such as after the key expired or was deleted. Make another, and add it with the provider's **Replace key**.
- **A chat stops with HTTP 400.** Anthropic's error says why, such as a credit balance too low. Add credit under **Billing**.
- **A chat stops with HTTP 429.** You've reached your usage tier's rate limit. Anthropic raises an account's tier over time. fxbot tries again by itself, and stops the turn after 5 minutes of nothing but refusals ([Providers](/docs/reference/providers/)).
