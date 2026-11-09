# Local access

Bots read and change files in folders the owner picks on the machine fxbot runs on, and, only if the owner allows it, run commands there. It does nothing until the owner adds the plugin and picks each folder.

**Plugin, and the only way a bot reaches the owner's machine.** By design, a bot never acts on the machine itself: its tools work on fxbot's own data, and files and commands happen on its [computer](../_completed/phases/computer.md), a machine of its own apart from the owner's ([Bots and the owner's machine](../../CONVENTIONS.md#bots-and-the-owners-machine)). An owner who wants a bot on their own files adds this plugin. It's never on by default, and never in **Essentials**.

To plan:
- **Folders, one at a time:** the owner picks each one, for each bot, read-only unless the owner says read and write. Nothing outside them is reachable, links that lead out included.
- **Commands,** if at all: a switch of their own, for each bot, off by default, with each command waiting for the owner's yes through [permissions](../_completed/phases/permissions.md) unless the owner says otherwise.
- **Where fxbot runs:** an app on the owner's own computer ([Distribution](distribution.md), [Mac support](mac-support.md)) reaches the folders directly. A release install runs the app in a container, so a folder needs a mount that the machine's `fxbot` command adds, as it does for the computer's socket: likely a second machine job, the smallest hook it needs.
- **Or the other way round:** a folder copied into, or kept in step with, a bot's computer, so the bot works there and the owner takes the result back. To weigh when it's planned.
- **What the owner sees:** each folder and bot in Settings, and each change a bot made, in its chat.

Not planned yet.
