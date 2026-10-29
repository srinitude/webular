# tests/ci/AGENTS.md

Contract tests for the CI/CD task graph. The parent rules are in [tests/AGENTS.md](../AGENTS.md).

## What lives here

- [graph.test.ts](graph.test.ts) checks the real [mise.toml](../../mise.toml) graph, the one every CLI call routes through. It has no cycles, and each task has the parents it should.
- [workflow.test.ts](workflow.test.ts) checks that local and remote CI share one `mise` entrypoint, and that `mise` can resolve the graph.
- [action-pins.test.ts](action-pins.test.ts) checks that every workflow `uses:` is pinned to the commit its version comment names (an annotated tag's own id is not a commit).
- [workflow-hardening.test.ts](workflow-hardening.test.ts) checks that every workflow starts with read-only or empty permissions, interpolates no `${{ }}` into `run:`, avoids `pull_request_target`, and publishes to npm by OIDC with provenance and no stored token. GitHub Packages gets only the short-lived token of the run itself.
- [checkout-credentials.test.ts](checkout-credentials.test.ts) checks that every workflow checkout drops its token from `.git/config`, and that no job pushes to main. Only [prune.yml](../../.github/workflows/prune.yml) runs `git push`, and only to its own `prune/auto-*` branch.
- [workflow-matrix.test.ts](workflow-matrix.test.ts) checks that no speedup shrinks what CI runs. Every workflow keeps its jobs, its systems, and its lint, typecheck, build, and test steps. A system whose tests are split into shards has shards 1 through n of n, so each test file runs once on it.
- [push-covered-by-pr.test.ts](push-covered-by-pr.test.ts) runs the push lookup in `ci.yml` and `plugin.yml` against a stand-in `gh`. A push skips its matrix only when the open pull request is `MERGEABLE`. GitHub makes no `pull_request` run for a pull request with merge conflicts, so a push to one still runs the full matrix.
- [repo-settings.test.ts](repo-settings.test.ts) checks the shape of `.github/repo-settings.json` and that its workflow is read-only and runs `repo:settings:check`.

## Rules

- Test the real [`mise.toml`](../../mise.toml), never a copy of it. [tests/_support/graph.ts](../_support/graph.ts) loads it.
- Check behavior, not how a task is written.

## Checks

`mise run test:file tests/ci`

Workflow pins and hardening bugs: `mise run bugs:tests-build`.
