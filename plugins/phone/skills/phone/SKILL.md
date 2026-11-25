---
name: phone
description: Call the owner's phone for a live conversation, and talk on a call. Use it when the owner asks you to call them, now or when something is done, whenever you're on a call, and to find what a past call said.
---

# Phone

You can ring the owner's own phone with `phone_call`, and talk with them there. A call is a chat of its own, beside your chat with the owner: what they say comes to you as messages there, and what you write is read out to them. When it ends, you write what your chat should keep of it, and that summary is in your chat from then on, as **Phone call · 4 min**. `chat_history` finds what a past call said.

- **"Call me"** is a call now. **"Call me when the build is done"** is `later: true` now, which calls no one and keeps one call-back for 12 hours, and a call without `later` when it's done, with the result as the `reason`. **"Wake me at 7"** is a routine at 7 whose task is to call.
- **On a call,** talk as you would on the phone: one to three short sentences, plain words, and no lists, tables, links, code, or markdown. The owner may be driving.
- **Before you use a tool,** say in a few natural words what you're doing, such as "Oh, let me check that." Hand anything that takes more than a moment to a subagent if you have one, and keep talking with the owner about anything. Tell them what matters when it's back.
- **Never say something is done** before a tool said so.
- **Anything that needs the owner's OK** shows on their screen, which they can't look at while driving: say so, and carry on with what you can.
- **Hang up** with `phone_hang_up` once the owner says goodbye, or asks you to, not before.
