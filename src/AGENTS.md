# src/AGENTS.md

The CLI source; the root [AGENTS.md](../AGENTS.md) holds the commands and the repo-wide gates.

## Rules

### Effect

- Write every module in Effect 4 (`effect` and `@effect/platform-bun`). No bare `Promise`, `async` function, callback, `throw`, or module-level mutable singleton. Source: [Effect-TS/effect@effect@4.0.5](https://github.com/Effect-TS/effect).
- Wrap a Promise API once at its edge with `Effect.tryPromise`, and give it a typed error.
- Typed errors extend `Data.TaggedError`. A CLI failure carries its exit code through [`src/core/effect.ts`](core/effect.ts), the one process edge.
- Read files and run processes through Effect services (`FileSystem`, `ChildProcessSpawner`), not `node:fs` or `Bun.spawn` in place.
- Decode outside data with `Schema` or `zod` at the boundary. Read secrets with `Config.Redacted`.
- Bound every fan-out with a numeric `concurrency` option, and every retry with a schedule and a limit. This covers every `Effect.forEach` and `Effect.all` over a collection.
- Name reusable functions with `Effect.fn("name")`. Name layers `layer`, never `Default` or `Live`. Source: [Effect-TS/effect@effect@4.0.5](https://github.com/Effect-TS/effect/blob/effect%404.0.5/LLMS.md).
- No `try`/`catch` in an Effect generator, no floating Effect, and no `Effect.run*` inside an Effect. Source: [Effect-TS/language-service@0.87.5](https://github.com/Effect-TS/language-service/blob/@effect/language-service@0.87.5/README.md).
- In zod, use `z.strictObject`, `.extend()`, and `z.url()`, not `.strict()`, `.merge()`, or `z.string().url()`. Source: [colinhacks/zod@v4.6.7](https://github.com/colinhacks/zod/tree/v4.6.7).
- Import core modules from `effect/*` and keep platform code in `@effect/platform-bun`. Use `Context.Service`, the `Semaphore` module, and `Effect.forkChild`, `forkScoped`, or `forkDetach`. Do not use `Context.Tag`, `Effect.makeSemaphore` (it does not exist in `effect@4.0.5`), `Effect.fork`, or `Effect.forkDaemon`. Source: [Effect-TS/effect@effect@4.0.5](https://github.com/Effect-TS/effect/blob/effect%404.0.5/migration/services.md).
- Bun runs JavaScriptCore and has no V8 heap flags. To cut memory, lower concurrency first, then measure RSS with and without `--smol`. Source: [Bun docs](https://bun.com/docs).

### Commands and flows

- Each command in [`src/commands/`](commands/) has a workflow in [`src/workflows/`](workflows/) and a flow in [`src/machines/`](machines/).
- A flow is an XState machine. [`tests/machines/flow-coverage.test.ts`](../tests/machines/flow-coverage.test.ts) fails when a command or MCP tool has no machine, or a machine has no test. Source: [statelyai/xstate@xstate@5.33.3](https://github.com/statelyai/xstate).
- Exit codes live in [`src/cli/exit-codes.ts`](cli/exit-codes.ts). Never reuse a code for another meaning.
- Each CLI command and its MCP tool share one name, one input shape, and one error text.

### Jev and decision models

- Only [`src/lib/jev/`](lib/jev/) asks Jev or calls a model. Everything else goes through `defineDecision`, by way of `decisionStep` or `machineDecision` ([`tests/jev/no-direct-calls.test.ts`](../tests/jev/no-direct-calls.test.ts)).
- Each decision has a labeled eval file in [`tests/jev/evals/`](../tests/jev/evals/), the 0.95 confidence bar, a code fallback, and a code check after the pick.
- When a Jev result is wrong, fix its input payload. Never lower the bar.

## Checks

```bash
mise run typecheck
mise run jev:check
mise run test:file tests/machines tests/quality
```

## Children

Each folder below [`src/`](./) holds its own AGENTS.md, such as [cli/AGENTS.md](cli/AGENTS.md) and [lib/jev/AGENTS.md](lib/jev/AGENTS.md).
