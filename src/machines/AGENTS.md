# src/machines/AGENTS.md

Rules for the XState flow machines, under [src/AGENTS.md](../AGENTS.md).

## What lives here

- Flows: [`cli-dispatch.ts`](cli-dispatch.ts) (route or answer locally), [`command-lifecycle.ts`](command-lifecycle.ts) (validate, run, render), [`fetch.ts`](fetch.ts) (retry, redirect, failure), [`scrape-fallback.ts`](scrape-fallback.ts) (render or read a PDF), [`jev-command.ts`](jev-command.ts) (the `jev` command), and [`mcp-serve.ts`](mcp-serve.ts) (serve over stdio).
- Agent: [`agent.ts`](agent.ts) is a Stately agent that picks the next event of a machine. [`agent-model.ts`](agent-model.ts) chooses its model from `WEBULAR_AGENT_MODEL`. [`agent-jev.ts`](agent-jev.ts) lets Jev be the planner.

## Rules

- Bug classes here ([bug classes](../../docs/bug-classes.md)): machine drift. Guard tasks: `mise run bugs:jev`.
- A machine is the flow doc. Do not draw a diagram of it.
- A final state carries an `exit-<code>` tag from [`src/cli/exit-codes.ts`](../cli/exit-codes.ts).
- Code that runs a flow reads its decisions from the machine. [`src/core/http.ts`](../core/http.ts) performs only what [`fetch.ts`](fetch.ts) asks.
- [`tests/machines/flow-coverage.test.ts`](../../tests/machines/flow-coverage.test.ts) needs a machine for every command and MCP tool, and a test for every machine.
- The agent takes an event only when the machine allows it from the current state. Jev's pick counts only at the bar. Otherwise the observed event stays.
- Jev is the agent's only model provider. Its key comes from `TYPESAFE_API_KEY` or the macOS Keychain, through the shared Jev client. The agent package loads lazily.

### XState and the Stately agent

- Build each machine with `setup({ types, actions, guards, actors })` and then `.createMachine`. A named guard or action missing from `setup` throws at run time. Source: [statelyai/xstate@xstate@5.33.3](https://github.com/statelyai/xstate/blob/xstate@5.33.3/packages/core/src/setup.ts).
- Put actors in `setup({ actors })` as `fromPromise` or `fromCallback`, invoke them by name, and give them typed `input`. Source: [statelyai/xstate@xstate@5.33.3](https://github.com/statelyai/xstate/blob/xstate@5.33.3/packages/core/src/actors/promise.ts).
- Start an actor with `createActor(logic, { input }).start()`, and end it with `actor.stop()`. Source: [statelyai/xstate@xstate@5.33.3](https://github.com/statelyai/xstate/blob/xstate@5.33.3/packages/core/src/createActor.ts).
- `agent.decide` resolves to a plan or `undefined`, so handle `undefined`. Without `execute`, it only proposes the event, and the machine still applies it. Source: [statelyai/agent@v1.1.6](https://github.com/statelyai/agent/blob/v1.1.6/src/decision.ts).
- Each agent keeps its own memory, so make a fresh agent per decision. Source: [statelyai/agent@v1.1.6](https://github.com/statelyai/agent/blob/v1.1.6/src/agent.ts).

## Checks

- `src/machines/agent-jev.ts:78` and `:83` call `runPromise` inside a machine.

```bash
mise run test:file tests/machines
```
