# tests/machines/AGENTS.md

Model-based tests for the XState machines in [src/machines/](../../src/machines/). The parent rules are in [tests/AGENTS.md](../AGENTS.md).

## What lives here

- One machine each: [`fetch.test.ts`](fetch.test.ts), [`policy.test.ts`](policy.test.ts), [`scrape-fallback.test.ts`](scrape-fallback.test.ts), [`command-lifecycle.test.ts`](command-lifecycle.test.ts), [`cli-dispatch.test.ts`](cli-dispatch.test.ts), [`mcp-serve.test.ts`](mcp-serve.test.ts), [`jev-command.test.ts`](jev-command.test.ts).
- Agent: [`agent.test.ts`](agent.test.ts), [`agent-jev.test.ts`](agent-jev.test.ts), and [`agent-cache.test.ts`](agent-cache.test.ts). Recorded planner answers go through the real `agent.decide()`. The answer cache drops its oldest-used entry at its limit.
- Coverage: [`flow-coverage.test.ts`](flow-coverage.test.ts) (every path), [`machine-next.test.ts`](machine-next.test.ts). [`machine-sync.test.ts`](machine-sync.test.ts) (machine events match the branches in the code).

## Rules

- Walk paths with [tests/_support/paths.ts](../_support/paths.ts): simple paths when the machine is small, shortest paths when context makes simple paths explode.
- Import graph helpers from `xstate/graph`, never `@xstate/graph`.
- `path.steps[0]` is the init step; slice it off to get the events.
- `limit` has no bound by default. Set `limit` or `stopWhen` when context can grow.
- `getPathsFromEvents` throws on an event with no transition. Do not swallow the error.
- Never call a model. Planner answers are recorded. When a test needs a model object, use `MockLanguageModelV1` from `ai/test`.
- These tests are the flow docs, so a machine change needs a test change here.

## Checks

`mise run test:file tests/machines`
