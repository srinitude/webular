# tests/ci/AGENTS.md

Contract tests for the CI/CD task graph. The parent rules are in [tests/AGENTS.md](../AGENTS.md).

- `graph.test.ts` checks the real `mise.toml` graph, the one every CLI call routes through: no cycles, and each task has the parents it should.
- `workflow.test.ts` checks that local and remote CI share one `mise` entrypoint, and that `mise` can resolve the graph.

## Rules

- Test the real `mise.toml`, never a copy of it. `tests/_support/graph.ts` loads it.
- Check behavior, not how a task is written.

## Checks

`mise run test:file tests/ci`
