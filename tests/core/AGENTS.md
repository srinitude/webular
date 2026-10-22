# tests/core/AGENTS.md

Tests for the shared Effect services in [src/core/](../../src/core/). The parent rules are in [tests/AGENTS.md](../AGENTS.md).

## What lives here

- Fetching: [`fetch-layer.test.ts`](fetch-layer.test.ts), [`fetch-layer-path.test.ts`](fetch-layer-path.test.ts), [`fetch-layer-user-agent.test.ts`](fetch-layer-user-agent.test.ts), [`fetch-body-cap.test.ts`](fetch-body-cap.test.ts), [`fetch-policy-jitter.test.ts`](fetch-policy-jitter.test.ts), [`http-client.test.ts`](http-client.test.ts), [`fault-injection.test.ts`](fault-injection.test.ts), [`budget.test.ts`](budget.test.ts).
- Cache: [`cache.test.ts`](cache.test.ts), [`cache-fresh.test.ts`](cache-fresh.test.ts), [`cache-touch.test.ts`](cache-touch.test.ts), [`fetch-cache.test.ts`](fetch-cache.test.ts).
- Crawling: [`polite-crawler.test.ts`](polite-crawler.test.ts), [`polite-crawler-frontier.test.ts`](polite-crawler-frontier.test.ts), [`robots-txt.test.ts`](robots-txt.test.ts), [`private-hosts.test.ts`](private-hosts.test.ts).
- Duplicates and index: [`simhash.test.ts`](simhash.test.ts), [`near-duplicate.test.ts`](near-duplicate.test.ts), [`local-index.test.ts`](local-index.test.ts).
- Platform, paths, and processes: [`platform.test.ts`](platform.test.ts), [`platform-parity.test.ts`](platform-parity.test.ts), [`file-url-paths.test.ts`](file-url-paths.test.ts), [`root.test.ts`](root.test.ts), [`proc.test.ts`](proc.test.ts), [`proc-child-cap.test.ts`](proc-child-cap.test.ts).
- Helpers: [`args.test.ts`](args.test.ts), [`output.test.ts`](output.test.ts), [`readability-chain.test.ts`](readability-chain.test.ts), [`no-nested-run.test.ts`](no-nested-run.test.ts).

## Rules

- [`cache.test.ts`](cache.test.ts) builds its own `ConfigProvider`, because [tests/_support/no-cache.ts](../_support/no-cache.ts) turns the cache off for every other test.
- Use [tests/_support/scripted-server.ts](../_support/scripted-server.ts) to make network faults and hangs.

## Checks

`mise run test:file tests/core`
