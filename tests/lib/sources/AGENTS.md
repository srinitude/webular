# tests/lib/sources/AGENTS.md

Tests for the free search source adapters. The parent rules are in [tests/lib/AGENTS.md](../AGENTS.md).

## What lives here

- Adapters: [`books.test.ts`](books.test.ts), [`communities.test.ts`](communities.test.ts), [`documents.test.ts`](documents.test.ts), [`feeds.test.ts`](feeds.test.ts), [`news.test.ts`](news.test.ts), [`archives.test.ts`](archives.test.ts), [`archive-copy.test.ts`](archive-copy.test.ts), [`scholarly-works.test.ts`](scholarly-works.test.ts), [`web-scholarly.test.ts`](web-scholarly.test.ts), [`wikidata-facts.test.ts`](wikidata-facts.test.ts).
- More adapter and parsing tests: [`creator-products.test.ts`](creator-products.test.ts), [`documents.parsing.test.ts`](documents.parsing.test.ts), [`official-sites.test.ts`](official-sites.test.ts), [`rank-published-zone.parsing.test.ts`](rank-published-zone.parsing.test.ts).
- Key safety: [`openalex-key-redacted.security.test.ts`](openalex-key-redacted.security.test.ts).
- Rate limits: [`github-ratelimit.test.ts`](github-ratelimit.test.ts), [`openalex-ratelimit.test.ts`](openalex-ratelimit.test.ts).
- Ranking and merge: [`rank.test.ts`](rank.test.ts), [`search-feed-sources.test.ts`](search-feed-sources.test.ts), [`github-raw.test.ts`](github-raw.test.ts).
- [`support.ts`](support.ts) is shared plumbing, not a test.

## Rules

- Bodies are recorded. They live in [`tests/fixtures/sources/`](../../fixtures/sources/) and in the JSON files beside it in [`tests/fixtures/`](../../fixtures/).
- Point an adapter at the local fixture through `WEBULAR_SOURCE_ORIGIN` with [`support.ts`](support.ts). Never call a source host.
- Give each test a fresh per-host slot table, so rate limits do not leak between tests.

## Checks

`mise run test:file tests/lib/sources`
