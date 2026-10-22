# src/mise/AGENTS.md

Rules for the one place that talks to mise, under [src/AGENTS.md](../AGENTS.md).

## What lives here

[`gateway.ts`](gateway.ts) looks up mise for the commands that use mise itself. `doctor` reports its version and `tasks` lists the task graph.

## Rules

- Only commands that report on mise may import this folder. A command does not need mise to start (see [`src/cli/dispatch.ts`](../cli/dispatch.ts)).
- `tasks` keeps only tasks from this repo's [`mise.toml`](../../mise.toml), so user and parent configs never leak into a report.
- Run mise through [`src/core/proc.ts`](../core/proc.ts), with an argv array and a timeout.

## Checks

```bash
mise run test:file tests/cli/gateway.test.ts tests/commands/tasks.test.ts tests/commands/doctor.test.ts
```
