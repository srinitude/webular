# tests/core/AGENTS.md

Tests for the shared Effect services in `src/core/`. The parent rules are in [tests/AGENTS.md](../AGENTS.md).

## What lives here

- Fetching: `fetch-layer.test.ts`, `http-client.test.ts`, `fault-injection.test.ts`, `budget.test.ts`.
- Cache: `cache.test.ts`, `cache-touch.test.ts`.
- Crawling: `polite-crawler.test.ts`, `polite-crawler-frontier.test.ts`, `robots-txt.test.ts`.
- Duplicates and index: `simhash.test.ts`, `near-duplicate.test.ts`, `local-index.test.ts`.
- Platform, paths, and processes: `platform.test.ts`, `platform-parity.test.ts`, `file-url-paths.test.ts`, `root.test.ts`, `proc.test.ts`.
- Helpers: `args.test.ts`, `output.test.ts`, `readability-chain.test.ts`.

## Rules

- `cache.test.ts` builds its own `ConfigProvider`, because `tests/_support/no-cache.ts` turns the cache off for every other test.
- Use `tests/_support/scripted-server.ts` to make network faults and hangs.

## Checks

`mise run test:file tests/core`
