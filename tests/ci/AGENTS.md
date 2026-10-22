# tests/ci/AGENTS.md

Contract tests for the CI/CD task graph. The parent rules are in [tests/AGENTS.md](../AGENTS.md).

## What lives here

- [graph.test.ts](graph.test.ts) checks the real [mise.toml](../../mise.toml) graph, the one every CLI call routes through: no cycles, and each task has the parents it should.
- [workflow.test.ts](workflow.test.ts) checks that local and remote CI share one `mise` entrypoint, and that `mise` can resolve the graph.
- [checkout-credentials.test.ts](checkout-credentials.test.ts) checks that every workflow checkout drops its token from `.git/config`, and that no job runs `git push`.
- [repo-settings.test.ts](repo-settings.test.ts) checks the shape of `.github/repo-settings.json` and that its workflow is read-only and runs `repo:settings:check`.

## Rules

- Test the real [`mise.toml`](../../mise.toml), never a copy of it. [tests/_support/graph.ts](../_support/graph.ts) loads it.
- Check behavior, not how a task is written.

## Checks

`mise run test:file tests/ci`
