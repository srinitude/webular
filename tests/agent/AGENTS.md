# tests/agent/AGENTS.md

Proof that the Stately agent reaches the machines. The parent rules are in [tests/AGENTS.md](../AGENTS.md).

- [`stately-agent-reach.test.ts`](stately-agent-reach.test.ts) shows that the Stately agent (`@statelyai/agent`) reaches every machine in [`src/machines/`](../../src/machines/). It also shows the agent can take only an event the machine allows from its current state.
- Every model answer is recorded, from a planner or a mock language model. No test here calls a live model.
- Use `MockLanguageModelV1` from `ai/test` for model tests.

## Checks

`mise run test:file tests/agent`
