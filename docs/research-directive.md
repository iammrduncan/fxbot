# Research Directive

Use this doc alongside a research task given to you.

Our reference implementations we glean inspiration from are the following:

- https://eve.dev/ (https://github.com/vercel/eve)
- https://fx.sh/ (https://github.com/vercel-labs/fx)
- https://docs.x.ai/grok-bot/overview
- https://github.com/CopilotKit/openbot
- https://github.com/CopilotKit/OpenDuet
- https://github.com/CopilotKit/openmuse
- https://github.com/CopilotKit/OpenDots
- https://github.com/vercel-labs/agent-desktop
- https://github.com/vercel-labs/fx0
- https://github.com/vercel-labs/durable-harness
- https://github.com/vercel-labs/agent-browser

Keep in mind our conventions @../CONVENTIONS.md

Our goal is simple over complex. 
Lesser is more. 
Keep our ladder in mind of less code to do the jobs as possible. 
Keep it organized and neat.

Remember:

- reusable core bits to into packages/sdk
- specific backend for serving API goes into packages/server
- ui stuff goes into packages/ui

Phase plans should have

1. research against references and inspiration.
2. key takeaways
3. implementation details on how to do it.
4. checklist and bounded gaols.
5. open questions to human as needed.

A user should be able to use `/goal Complete <phase-doc>.md, reread the goal before wrapping up`.
