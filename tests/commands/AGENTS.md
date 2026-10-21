# tests/commands/AGENTS.md

One test file per command, run against the local fixture. The parent rules are in [tests/AGENTS.md](../AGENTS.md).

- Each command in `src/commands/` has a file named for it, such as `scrape.test.ts`, `crawl.test.ts`, and `answer.test.ts`.
- A `-fallback` file, such as `search-fallback.test.ts`, covers the free source chain used when the first source fails.
- Archive files (`archive-chain.test.ts`, `crawl-wayback.test.ts`) use the stand-in indexes from `tests/_support/archive-fixture.ts`.
- MCP files (`mcp.test.ts`, `mcp-server.test.ts`) check the stdio server's tools.
- `act.test.ts` drives a real browser tool only when its binary is on PATH.

## Rules

- Spawn the command with `tests/_support/cli.ts`. Never call the workflow directly when a user would call the CLI.
- A command gets a file here when it gets a file in `src/commands/`.

## Checks

`mise run test:file tests/commands`
