---
title: "Vercel and AI Gateway"
description: "Vercel's AI Gateway reaches hundreds of models from many labs, billed to one of your Vercel teams. Sign in with your Vercel account, or add an AI Gateway key."
---

Vercel's AI Gateway reaches hundreds of models from many labs, billed to one of your Vercel teams. Every team gets a monthly free credit, for some of its models at lower rate limits. Buying credits moves the team to the paid tier, at each provider's list price ([AI Gateway pricing](https://vercel.com/docs/ai-gateway/pricing)).

fxbot takes it two ways: your Vercel account, signed in, or an AI Gateway key.

## Sign in

**Vercel's sign-in is off for now.** fxbot signs in with a device code, and Vercel doesn't let fxbot's app use one yet. Meanwhile, [use a key](#make-a-key). A server that sets [`FXBOT_VERCEL_CLIENT_ID`](/docs/reference/configuration/), to a Vercel app that may use device codes, shows the sign-in. You sign in with your own Vercel account, and use your own team's credit.

1. In **Settings** › **Providers**, choose **Add provider**, then **Vercel**, under **Sign in**. A code shows at once.
2. Open the link on any device: scan its QR code, choose **Copy link**, or follow the **Open** link beside the code. Sign in to Vercel, and enter the code. **Copy code** copies it.
3. Leave fxbot's page open. It finishes on its own, and shows the time left.
4. Pick a model, and choose **Done**. **Make it the default for new bots** starts new bots on it.

fxbot keeps the account's tokens sealed, and renews them before they end. AI Gateway bills one of the account's teams. fxbot picks it by itself when the account has one. With more than one, fxbot lists no models until you pick: in **Settings** › **Providers**, choose it under the provider's **Team**, then set its **Default model**.

## Make a key

1. Open [AI Gateway's API keys](https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai-gateway%2Fapi-keys), and sign in.
2. Pick the team to bill, then choose **Create key**, and give it a name, such as fxbot.
3. Copy the key. Vercel shows it only once.

## Add it to fxbot

1. In **Settings** › **Providers**, choose **Add provider**, then **AI Gateway**, under **Use a key**.
2. Paste the key, and choose **Add**. fxbot checks it with AI Gateway first.
3. Pick a model, and choose **Done**.

| Field | What to put there |
| --- | --- |
| **API key** | The key you copied. It goes to fxbot's server once, sealed, and never comes back to the page. |
| **Name** | Optional. It's **AI Gateway** when you leave it empty. |

The key bills the team it was made in, so it needs no **Team**.

## Claude with your own Anthropic key

AI Gateway can bill Claude to your own Anthropic key, at Anthropic's prices with no markup ([Bring Your Own Key](https://vercel.com/docs/ai-gateway/authentication-and-byok/byok)). On AI Gateway's **Bring Your Own Key** page, find **Anthropic**, choose **Add**, paste the key, leave **Enabled** on, and choose **Test Key**. fxbot keeps using the AI Gateway key, and AI Gateway's logs say which key served each request.

Through AI Gateway, fxbot's agent library marks Claude's prompts for Anthropic's prompt caching, so a long chat costs less than through the [Anthropic](/docs/providers/anthropic/) provider, whose OpenAI-compatible API has none. From Vercel's docs:

- **It needs the paid tier,** with AI Gateway credits bought.
- **A request your key fails is tried again on Vercel's own credentials,** and billed to the team's credits.

## Its models

fxbot lists the models from AI Gateway's own list, whichever way you came in.

## When it fails

- **No Vercel under Sign in.** Its sign-in is off for now, as above. Use an AI Gateway key.
- **"Vercel did not issue a device code (HTTP 401): This client is not authorized to use the Device Authorization flow."** The Vercel app fxbot signs in through isn't allowed device codes yet. Its owner turns that on in the app's settings at Vercel. Meanwhile, use an AI Gateway key.
- **"Pick a Vercel team for this provider in Settings."** The account has more than one team, and none is picked yet. Pick one under the provider's **Team**.
- **"This sign-in expired."** The code ran out before you entered it. Choose **Start again** for a new one.
- **"Vercel did not renew the sign-in."** Use the provider's **Sign in again**.
- **"AI Gateway rejected this key (HTTP 401): it's wrong, or it was deleted."** Vercel also turns off the keys a person made when they leave the team. Make another, and add it with the provider's **Replace key**.
- **A chat stops with HTTP 429.** You've reached a rate limit, which is lower on the free tier. fxbot tries again by itself, and stops the turn after 5 minutes of nothing but refusals ([Providers](/docs/reference/providers/)).
