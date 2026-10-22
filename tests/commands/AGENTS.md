# tests/commands/AGENTS.md

One test file per command, run against the local fixture. The parent rules are in [tests/AGENTS.md](../AGENTS.md).

- Each command in [`src/commands/`](../../src/commands/) has a file named for it, such as [`scrape.test.ts`](scrape.test.ts), [`crawl.test.ts`](crawl.test.ts), and [`answer.test.ts`](answer.test.ts).
- A `-fallback` file, such as [`search-fallback.test.ts`](search-fallback.test.ts), covers the free source chain used when the first source fails.
- Archive files ([`archive-chain.test.ts`](archive-chain.test.ts), [`crawl-wayback.test.ts`](crawl-wayback.test.ts)) use the stand-in indexes from [`tests/_support/archive-fixture.ts`](../_support/archive-fixture.ts).
- MCP files ([`mcp.test.ts`](mcp.test.ts), [`mcp-server.test.ts`](mcp-server.test.ts)) check the stdio server's tools.
- Per command: [`act.test.ts`](act.test.ts), [`audit.test.ts`](audit.test.ts), [`batch.test.ts`](batch.test.ts), [`diagram.test.ts`](diagram.test.ts), [`doctor.test.ts`](doctor.test.ts), [`extract.test.ts`](extract.test.ts), [`feed.test.ts`](feed.test.ts), [`jev.test.ts`](jev.test.ts), [`map.test.ts`](map.test.ts), [`media.test.ts`](media.test.ts), [`media-accuracy.test.ts`](media-accuracy.test.ts), [`monitor.test.ts`](monitor.test.ts), [`parse.test.ts`](parse.test.ts), [`research.test.ts`](research.test.ts), [`search.test.ts`](search.test.ts), [`summarize.test.ts`](summarize.test.ts), [`tasks.test.ts`](tasks.test.ts), [`tokens.test.ts`](tokens.test.ts).
- [`answer-conflict.test.ts`](answer-conflict.test.ts) checks that when two pages give different figures, the answer adds a note that names both.
- Fallbacks: [`answer-fallback.test.ts`](answer-fallback.test.ts), [`crawl-fallback.test.ts`](crawl-fallback.test.ts), [`feed-fallback.test.ts`](feed-fallback.test.ts), [`map-fallback.test.ts`](map-fallback.test.ts), [`monitor-fallback.test.ts`](monitor-fallback.test.ts), [`research-fallback.test.ts`](research-fallback.test.ts), [`summarize-fallback.test.ts`](summarize-fallback.test.ts), [`summarize-extractive.test.ts`](summarize-extractive.test.ts), [`search-sources.test.ts`](search-sources.test.ts).
- Accuracy evals score a command offline against a gold set written from the fixture design. Each also checks that the same input run twice gives the same output: [`batch-accuracy.test.ts`](batch-accuracy.test.ts), [`crawl-accuracy.test.ts`](crawl-accuracy.test.ts), [`extract-accuracy.test.ts`](extract-accuracy.test.ts), [`feed-accuracy.test.ts`](feed-accuracy.test.ts), [`map-accuracy.test.ts`](map-accuracy.test.ts), and [`summarize-accuracy.test.ts`](summarize-accuracy.test.ts). Summarize also prints faithfulness and the best ROUGE that any pick of the same size could reach. Each eval asserts the value that [`bench/scoreboard.json`](../../bench/scoreboard.json) records for it.
- Failures and safety: [`batch-http-errors.test.ts`](batch-http-errors.test.ts), [`batch-schemes.security.test.ts`](batch-schemes.security.test.ts), [`fail-fast.test.ts`](fail-fast.test.ts), [`hardening.test.ts`](hardening.test.ts), [`unreachable-host.mcp-cli.test.ts`](unreachable-host.mcp-cli.test.ts), [`sdk-errors.mcp-cli.test.ts`](sdk-errors.mcp-cli.test.ts), [`sdk-errors-proto-name.mcp-cli.test.ts`](sdk-errors-proto-name.mcp-cli.test.ts).
- MCP and flags: [`mcp-tools.test.ts`](mcp-tools.test.ts), [`mcp-input.mcp-cli.test.ts`](mcp-input.mcp-cli.test.ts), [`mcp-progress.mcp-cli.test.ts`](mcp-progress.mcp-cli.test.ts), [`list-flags-help.mcp-cli.test.ts`](list-flags-help.mcp-cli.test.ts).
- [`act.test.ts`](act.test.ts) drives a real browser tool only when its binary is on PATH.

## Rules

- Spawn the command with [`tests/_support/cli.ts`](../_support/cli.ts). Never call the workflow directly when a user would call the CLI.
- A command gets a file here when it gets a file in [`src/commands/`](../../src/commands/).

## Checks

`mise run test:file tests/commands`
