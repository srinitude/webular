# tests/_support/AGENTS.md

Shared test helpers. The parent rules are in [tests/AGENTS.md](../AGENTS.md).

This folder holds no tests of its own. Other test folders import from it.

## What lives here

- Run and paths: [`run.ts`](run.ts) (the `eff` runner and `tmpDir`), [`root.ts`](root.ts) (repo root), [`paths.ts`](paths.ts) (paths through a machine), [`repo-files.ts`](repo-files.ts) (`fileChecks` and repo readers).
- Servers: [`fixture.ts`](fixture.ts) (the local `Bun.serve` fixture), [`routes.ts`](routes.ts) (its route table), [`scripted-server.ts`](scripted-server.ts) (a TCP server that replays scripted replies), [`archive-fixture.ts`](archive-fixture.ts) (stand-in archive indexes), [`pdf-fixture.ts`](pdf-fixture.ts) (a small PDF built in memory).
- Processes and env: [`cli.ts`](cli.ts) (spawn helper that drains stdout and stderr together), [`mcp-env.ts`](mcp-env.ts) (the env an MCP host gives a server), [`mcp-client.ts`](mcp-client.ts) (an MCP client for tests), [`no-cache.ts`](no-cache.ts) (preloaded by [`bunfig.toml`](../../bunfig.toml)).
- Analyzers: [`limits.ts`](limits.ts) (line and nesting limits), [`exports.ts`](exports.ts) (unused exports), [`graph.ts`](graph.ts) (the [`mise.toml`](../../mise.toml) task graph), [`agents-sync.ts`](agents-sync.ts) (AGENTS.md drift against the code).

## Rules

- Keep route content static, so byte-level checks hold on every run.
- A helper that opens a server or a temp folder ties it to a scope, so it closes when the test ends.
- Add a helper only when two test folders need it.

## Checks

These helpers run inside the tests that import them. Run `mise run test:file tests/quality tests/ci` to cover the analyzers and the graph.
