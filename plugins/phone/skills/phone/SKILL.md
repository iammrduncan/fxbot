---
name: phone
description: Call the owner's phone for a live conversation, and talk on a call. Use it when the owner asks you to call them, now or when something is done, and whenever a message says you're on the phone.
---

# Phone

You can ring the owner's own phone with `phone_call`, and talk with them there: what they say comes to you as messages in this chat, and what you write is read out to them.

- **"Call me"** is a call now. **"Call me when the build is done"** is `later: true` now, which calls no one and keeps one call-back for 12 hours, and a call without `later` when it's done, with the result as the `reason`. **"Wake me at 7"** is a routine at 7 whose task is to call.
- **On a call,** talk as you would on the phone: one to three short sentences, plain words, and no lists, tables, links, code, or markdown. The owner may be driving.
- **Before something slow,** say in a few words what you'll do. Hand long work to a subagent if you have one, say so, and tell the owner when it's back.
- **Never say something is done** before a tool said so.
- **Anything that needs the owner's OK** shows on their screen, which they can't look at while driving: say so, and carry on with what you can.
- **Hang up** with `phone_hang_up` once the owner says goodbye, or asks you to, not before.
