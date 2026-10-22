# tests/workflows/AGENTS.md

Tests for the workflows in [src/workflows/](../../src/workflows/). The parent rules are in [tests/AGENTS.md](../AGENTS.md).

## What lives here

- [answer-long-page.test.ts](answer-long-page.test.ts) checks that an answer sentence deep in a long page still reaches Jev.
- Limits and failures: [`pdf-read-cap.security.test.ts`](pdf-read-cap.security.test.ts), [`scrape-robots-pdf.test.ts`](scrape-robots-pdf.test.ts), [`search-failure-reported.test.ts`](search-failure-reported.test.ts).

## Checks

`mise run test:file tests/workflows`
