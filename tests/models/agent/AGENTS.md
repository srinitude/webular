# tests/models/agent/AGENTS.md

The agent track: one model, one tool arm, and one public-web task per run. The parent rules are in [tests/models/AGENTS.md](../AGENTS.md).

## What lives here

- [arm.ts](arm.ts): one tool arm. It sets which tools a run may call, what the prompt hints, and, for a peer arm, its MCP server and the keys its child env needs.
- [tasks.ts](tasks.ts): single-answer tasks from the peer set, [bench/tasks/dev/peers.jsonl](../../../bench/tasks/dev/peers.jsonl). Set `BENCH_AGENT_SET` to read another set, such as `dev/answer.jsonl`. A reply passes when it holds the gold answer or any alias. An inline sample stands in when the task file is missing.
- [judge.ts](judge.ts): the judge eval kind. It grades a reply with one Claude model through the grader track.
- [rates.ts](rates.ts): public per-token rates for pricing subscription runs, with their source and read date.
- [row.ts](row.ts): one result row, including the arm-order seed.
- [agent.test.ts](agent.test.ts): checks the grid, arm tools, arm order, task set, cost, and pass^k with no model call.

## Rules

- Arms run in a seeded random order for each model and task. Every row keeps the seed.
- Peer arms cannot reach the local fixture, so the agent track runs only public-web tasks.
- Pin each peer arm's MCP server in arm.ts. Read its keys only through the bench key reader.
- Price every call with rates.ts. Change a rate only with its source and read date.
- Never commit rows from your own runs.

## Checks

`mise run test:file tests/models/agent`
