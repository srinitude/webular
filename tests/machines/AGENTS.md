# tests/machines/AGENTS.md

Model-based tests for the XState machines in `src/machines/`. The parent rules are in [tests/AGENTS.md](../AGENTS.md).

## What lives here

- One machine each: `fetch.test.ts`, `policy.test.ts`, `scrape-fallback.test.ts`, `command-lifecycle.test.ts`, `cli-dispatch.test.ts`, `mcp-serve.test.ts`, `jev-command.test.ts`.
- Agent: `agent.test.ts` and `agent-jev.test.ts` (recorded planner answers go through the real `agent.decide()`).
- Coverage: `flow-coverage.test.ts` (every path), `machine-next.test.ts`.

## Rules

- Walk paths with `tests/_support/paths.ts`: simple paths when the machine is small, shortest paths when context makes simple paths explode.
- Import graph helpers from `xstate/graph`, never `@xstate/graph`.
- `path.steps[0]` is the init step; slice it off to get the events.
- `limit` has no bound by default. Set `limit` or `stopWhen` when context can grow.
- `getPathsFromEvents` throws on an event with no transition. Do not swallow the error.
- Never call a model. Planner answers are recorded. When a test needs a model object, use `MockLanguageModelV1` from `ai/test`.
- These tests are the flow docs, so a machine change needs a test change here.

## Checks

`mise run test:file tests/machines`
