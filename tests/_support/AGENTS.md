# tests/_support/AGENTS.md

Shared test helpers. The parent rules are in [tests/AGENTS.md](../AGENTS.md).

This folder holds no tests of its own. Other test folders import from it.

## What lives here

- Run and paths: `run.ts` (the `eff` runner and `tmpDir`), `root.ts` (repo root), `paths.ts` (paths through a machine), `repo-files.ts` (`fileChecks` and repo readers).
- Servers: `fixture.ts` (the local `Bun.serve` fixture), `routes.ts` (its route table), `scripted-server.ts` (a TCP server that replays scripted replies), `archive-fixture.ts` (stand-in archive indexes).
- Processes and env: `cli.ts` (spawn helper that drains stdout and stderr together), `mcp-env.ts` (the env an MCP host gives a server), `no-cache.ts` (preloaded by `bunfig.toml`).
- Analyzers: `limits.ts` (line and nesting limits), `exports.ts` (unused exports), `graph.ts` (the `mise.toml` task graph).

## Rules

- Keep route content static, so byte-level checks hold on every run.
- A helper that opens a server or a temp folder ties it to a scope, so it closes when the test ends.
- Add a helper only when two test folders need it.

## Checks

These helpers run inside the tests that import them. Run `mise run test:file tests/quality tests/ci` to cover the analyzers and the graph.
