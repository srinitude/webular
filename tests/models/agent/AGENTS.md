# tests/models/agent/AGENTS.md

The agent track: one model, one tool arm, and one public-web task per run. The parent rules are in [tests/models/AGENTS.md](../AGENTS.md).

## What lives here

[arm.ts](arm.ts), [tasks.ts](tasks.ts), [judge.ts](judge.ts), [rates.ts](rates.ts), [row.ts](row.ts), [agent.test.ts](agent.test.ts).

## Rules

- Don't call a task passed on one try. Report pass^k across repeat runs. Source: [arXiv 2509.24002](https://arxiv.org/abs/2509.24002).
- Arms run in a seeded random order for each model and task. Every row keeps the seed.
- Peer arms cannot reach the local fixture, so the agent track runs only public-web tasks.
- Pin each peer arm's MCP server in arm.ts. Read its keys only through the bench key reader.
- Price every call with rates.ts. Change a rate only with its source and read date.
- Never commit rows from your own runs.

## Checks

`mise run test:file tests/models/agent`
