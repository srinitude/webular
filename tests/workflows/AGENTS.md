# tests/workflows/AGENTS.md

Tests for the workflows in [src/workflows/](../../src/workflows/). The parent rules are in [tests/AGENTS.md](../AGENTS.md).

## What lives here

- [answer-long-page.test.ts](answer-long-page.test.ts) checks that an answer sentence deep in a long page still reaches Jev.
- [answer-guard.test.ts](answer-guard.test.ts) checks that an answer cites only pages it fetched, opens a year or count answer with the bare figure, and adds a note when sources disagree.
- [answer-headings.test.ts](answer-headings.test.ts) checks that an answer uses whole sentences: a heading never leads it, and a sentence that ends in citation markers still counts.
- [research-report.test.ts](research-report.test.ts) checks that the research report drops repeated sentences, flags number conflicts, and lists failed sources under "Gaps".
- Limits and failures: [`pdf-read-cap.security.test.ts`](pdf-read-cap.security.test.ts), [`scrape-robots-pdf.test.ts`](scrape-robots-pdf.test.ts), [`search-failure-reported.test.ts`](search-failure-reported.test.ts).

## Checks

`mise run test:file tests/workflows`
