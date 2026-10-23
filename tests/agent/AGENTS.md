# tests/agent/AGENTS.md

These tests prove that the Stately agent reaches the machines. The parent rules are in [tests/AGENTS.md](../AGENTS.md).

- [`stately-agent-reach.test.ts`](stately-agent-reach.test.ts) shows that the Stately agent (`@statelyai/agent`) reaches every machine in [`src/machines/`](../../src/machines/). It also shows the agent can take only an event the machine allows from its current state.
- [`stately-agent-sync.test.ts`](stately-agent-sync.test.ts) shows that the `machine.next` enum, the `diagram` command, and the machine and tool docs name exactly the machine files and tool ids in the code.
- Every model answer is recorded, from a planner or a mock language model. No test here calls a live model.
- For model tests, pass `decideNext` a recorded `AgentDecisionExecutor`, never a live model.

## Checks

`mise run test:file tests/agent`
