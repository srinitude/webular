# tests/engine/AGENTS.md

Tests for the engine that fetches, parses, and ranks pages. The parent rules are in [tests/AGENTS.md](../AGENTS.md).

## What lives here

- Fetch and parse: `http.test.ts`, `scrape.test.ts`, `parse.test.ts`, `parse-pool.test.ts`, `parse-size.test.ts`, `html.test.ts`, `json-ld-metadata.test.ts`, `decode.test.ts`, `download.test.ts`.
- PDF limits: `parse-pdf-caps.test.ts` checks the page cap and the time limit on one PDF's text. `WEBULAR_PDF_MAX_PAGES` and `WEBULAR_PDF_TIMEOUT_MS` override them. An early stop keeps the pages read and adds a truncation note.
- PDF and docx edge cases: `parse-pdf-docx-edges.parsing.test.ts` checks that a Node Buffer reads like a Uint8Array, that an encrypted, corrupt, or textless PDF fails with a plain `parse:` message, and that a corrupt docx names its file.
- Hidden text: `sanitize-injection.test.ts` checks that text a reader never sees does not reach the Markdown or plain text.
- Crawl and map: `crawl.test.ts`, `crawl-limit.test.ts`, `map.test.ts`, `map-order.test.ts`, `map-dedupe.test.ts`, `canonical-url.test.ts` (one canonical URL for every dedupe key), `map-gzip.test.ts`.
- Search: `search-chain.test.ts`, `search-hop.test.ts`, `search-hop-nested.test.ts`, `search-hop-overlap.test.ts`, `search-intent-late.test.ts`, `search-rank.test.ts`, `search-settle.test.ts`, `search-trace.test.ts`, `pick-sources-survey.test.ts`, `wikipedia-keywords.test.ts`, plus `sources.test.ts` and `source-subject.test.ts`. Other search files start with `search-`.
- Answer and summarize: `answer-passage.test.ts`, `summarize.test.ts`, `summarize-extractive.test.ts`, `summarize-focus.test.ts`, `summarize-lead-pin.test.ts`, `summarize-scaling.test.ts`.
- Cua (background GUI driver): `cua-act-guard.test.ts`, `cua-background.test.ts`, `cua-fixtures.test.ts`, `cua-goal.test.ts`, `cua-jev.test.ts`, `cua-os.test.ts`, `cua-plan.test.ts`, `cua-session-leak.effect.test.ts`, `cua-jev-fixtures.ts`, `cua-open-once.ts`, plus `driver.test.ts`.
- Robots: `robots-gate.test.ts`, `robots-commands.security.test.ts`, `fetch-robots.security.test.ts`, `crawl-root-robots.security.test.ts`.
- Workflows and reliability: `batch-dedupe.test.ts`, `map-sitemap-error.effect.test.ts`, `map-sitemap-xml.parsing.test.ts`, `reliability.test.ts`, `retry-after-fail-fast.test.ts`, `schemas.test.ts`, `scrape-decide-parallel.effect.test.ts`, `scrape-page-candidate.test.ts`, `workflow-abort.test.ts`.

## Rules

- Bug classes here ([bug classes](../../docs/bug-classes.md)): URL, charset, gzip, and injection guards. Guard tasks: `mise run bugs:parsing`, `bugs:security`.
- Driver tests run on recorded output in [tests/fixtures/driver/](../fixtures/driver/). They start no browser and send no input.
- `cua-live.test.ts` runs only when `WEBULAR_TEST_LIVE=1` is set.
- `cua-jev.eval.ts` is an eval, not a test. Run it with `bun tests/engine/cua-jev.eval.ts`.
- `parse-worker-dist.test.ts` needs `mise run build` first.

## Checks

`mise run test:file tests/engine`
