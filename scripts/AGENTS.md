# scripts/AGENTS.md

Build and maintenance scripts that `mise` tasks run. The root [AGENTS.md](../AGENTS.md) holds the repo-wide rules.

## What lives here

- `scripts/gen-dispatch.ts` writes `src/cli/dispatch-table.ts` from the `run:*` tasks in `mise.toml`. `mise run build` runs it first, and a test fails on drift.
- `scripts/clean.ts` deletes build output on every OS.
- `scripts/jev-docs.ts` refreshes and proves the Jev docs snapshot for `mise run jev:docs`.
- `scripts/install.sh` and `scripts/install.ps1` install a release binary.

## Rules

- Each script runs from a `mise` task. Add the task with the script.
- Scripts stay portable: the Windows task shell has no `rm`, `touch`, or glob expansion.

## Checks

- `scripts/jev-docs.ts:45` ends with `Effect.runPromise(...)` instead of `BunRuntime.runMain`.

```bash
mise run build
mise run test:file tests/release tests/ci
```

## Children

- [bench/AGENTS.md](bench/AGENTS.md)
