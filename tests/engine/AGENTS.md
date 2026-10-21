# tests/engine/AGENTS.md

Tests for the engine that fetches, parses, and ranks pages. The parent rules are in [tests/AGENTS.md](../AGENTS.md).

## What lives here

- Fetch and parse: `http.test.ts`, `scrape.test.ts`, `parse.test.ts`, `parse-pool.test.ts`, `html.test.ts`, `decode.test.ts`, `download.test.ts`.
- Crawl and map: `crawl.test.ts`, `crawl-limit.test.ts`, `map.test.ts`, `map-order.test.ts`, `map-dedupe.test.ts`.
- Search: files that start with `search-`, plus `sources.test.ts` and `source-subject.test.ts`.
- Answer and summarize: `answer-passage.test.ts` and files that start with `summarize-`.
- Cua (background GUI driver): files that start with `cua-`, plus `driver.test.ts`.

## Rules

- Driver tests run on recorded output in `tests/fixtures/driver/`. They start no browser and send no input.
- `cua-live.test.ts` runs only when `WEBULAR_TEST_LIVE=1` is set.
- `cua-jev.eval.ts` is an eval, not a test. Run it with `bun tests/engine/cua-jev.eval.ts`.
- `parse-worker-dist.test.ts` needs `mise run build` first.

## Checks

`mise run test:file tests/engine`
