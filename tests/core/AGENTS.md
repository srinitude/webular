# tests/core/AGENTS.md

These tests cover the shared Effect services in [src/core/](../../src/core/). The parent rules are in [tests/AGENTS.md](../AGENTS.md).

## What lives here

- Fetching: [`fetch-layer.test.ts`](fetch-layer.test.ts), [`fetch-layer-path.test.ts`](fetch-layer-path.test.ts), [`fetch-layer-user-agent.test.ts`](fetch-layer-user-agent.test.ts), [`fetch-body-cap.test.ts`](fetch-body-cap.test.ts), [`fetch-error-secret-url.security.test.ts`](fetch-error-secret-url.security.test.ts), [`dns-rebinding.security.test.ts`](dns-rebinding.security.test.ts), [`fetch-policy-jitter.test.ts`](fetch-policy-jitter.test.ts), [`http-wait.security.test.ts`](http-wait.security.test.ts), [`redirect-auth-headers.security.test.ts`](redirect-auth-headers.security.test.ts), [`retry-after.parsing.test.ts`](retry-after.parsing.test.ts), [`feed-http.parsing.test.ts`](feed-http.parsing.test.ts), [`budget-concurrency.effect.test.ts`](budget-concurrency.effect.test.ts), [`http-client.test.ts`](http-client.test.ts), [`fault-injection.test.ts`](fault-injection.test.ts), [`budget.test.ts`](budget.test.ts).
- Cache: [`cache.test.ts`](cache.test.ts), [`cache-fresh.test.ts`](cache-fresh.test.ts), [`cache-evict-tie.test.ts`](cache-evict-tie.test.ts), [`cache-touch.test.ts`](cache-touch.test.ts), [`fetch-cache.test.ts`](fetch-cache.test.ts), [`cache-expires-zone.parsing.test.ts`](cache-expires-zone.parsing.test.ts), [`archive-nearest.test.ts`](archive-nearest.test.ts).
- Crawling: [`polite-crawler.test.ts`](polite-crawler.test.ts), [`polite-crawler-frontier.test.ts`](polite-crawler-frontier.test.ts), [`polite-crawler-retry-after.test.ts`](polite-crawler-retry-after.test.ts), [`crawl-priority.test.ts`](crawl-priority.test.ts), [`crawl-robots-tags.test.ts`](crawl-robots-tags.test.ts), [`robots-txt.test.ts`](robots-txt.test.ts), [`sitemap-rest.parsing.test.ts`](sitemap-rest.parsing.test.ts), [`private-hosts.test.ts`](private-hosts.test.ts).
- Duplicates and index: [`simhash.test.ts`](simhash.test.ts), [`near-duplicate.test.ts`](near-duplicate.test.ts), [`local-index.test.ts`](local-index.test.ts).
- Platform, paths, and processes: [`platform.test.ts`](platform.test.ts), [`platform-parity.test.ts`](platform-parity.test.ts), [`file-url-paths.test.ts`](file-url-paths.test.ts), [`root.test.ts`](root.test.ts), [`safepath.security.test.ts`](safepath.security.test.ts), [`proc.test.ts`](proc.test.ts), [`proc-child-cap.test.ts`](proc-child-cap.test.ts).
- Helpers: [`args.test.ts`](args.test.ts), [`output.test.ts`](output.test.ts), [`readability-chain.test.ts`](readability-chain.test.ts), [`no-nested-run.test.ts`](no-nested-run.test.ts).
- Text and URLs: [`charset-detection.parsing.test.ts`](charset-detection.parsing.test.ts), [`charset-prescan.parsing.test.ts`](charset-prescan.parsing.test.ts), [`unicode-text.parsing.test.ts`](unicode-text.parsing.test.ts), [`url-normalize-edges.parsing.test.ts`](url-normalize-edges.parsing.test.ts), [`url-query.parsing.test.ts`](url-query.parsing.test.ts).

## Rules

- Bug classes here ([bug classes](../../docs/bug-classes.md)): network, Effect, and platform guards. Guard tasks: `mise run bugs:security`, `bugs:effect`, `bugs:os`.
- [`cache.test.ts`](cache.test.ts) builds its own `ConfigProvider`, because [tests/_support/no-cache.ts](../_support/no-cache.ts) turns the cache off for every other test.
- Use [tests/_support/scripted-server.ts](../_support/scripted-server.ts) to script network faults and hangs.

## Checks

`mise run test:file tests/core`
