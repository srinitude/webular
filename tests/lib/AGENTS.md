# tests/lib/AGENTS.md

Tests for helpers in [src/lib/](../../src/lib/). The parent rules are in [tests/AGENTS.md](../AGENTS.md).

## What lives here

- [answer-country.test.ts](answer-country.test.ts) checks that a country answer names the country with the demonym.
- [as-of.test.ts](as-of.test.ts) checks that `WEBULAR_AS_OF` pins the run date; else the clock gives an ISO date.
- [home-fallback.test.ts](home-fallback.test.ts) checks that Windows, with `USERPROFILE` but no `HOME`, keeps Jev state in the user folder.
- [driver.test.ts](driver.test.ts) checks that the `agent-browser` driver retries a failed render once, only when a retry can fix it.
- [json-ld.test.ts](json-ld.test.ts) checks JSON-LD facts: valid, `@graph`, bad, oversized blocks.
- [extract-locators.test.ts](extract-locators.test.ts) checks that extract finds a field by name, no model (role, test id, aria-label, then label text), picks one selector for repeated listing records, keeps Legislation and Dataset JSON-LD, and takes date, author, offer from structured data first.
- [snapshot-normalize.test.ts](snapshot-normalize.test.ts) checks that monitor snapshots ignore whitespace churn but catch repeated-line edits.
- [snapshot-diff-bound.test.ts](snapshot-diff-bound.test.ts) checks that a small change gives a diff, and a huge rewrite gives a "diff too large" note.
- [html-thin-union.parsing.test.ts](html-thin-union.parsing.test.ts) checks that when Readability keeps a thin scrap, the fuller body comes back, code and math included.
- [parse-pdf-layout.test.ts](parse-pdf-layout.test.ts) checks the PDF layout helpers on fake items: repeated page lines drop, columns read left then right, a poor page gets flagged.
- [sqlite-pragmas.test.ts](sqlite-pragmas.test.ts) checks the shared SQLite open: busy timeout always, WAL only on request.
- Parsing: [`html-extract-rest.parsing.test.ts`](html-extract-rest.parsing.test.ts), [`html-extraction.parsing.test.ts`](html-extraction.parsing.test.ts), [`html-links-base.parsing.test.ts`](html-links-base.parsing.test.ts), [`html-readability-cap.parsing.test.ts`](html-readability-cap.parsing.test.ts), [`html-turndown-cap.parsing.test.ts`](html-turndown-cap.parsing.test.ts), [`json-ld-tolerant.parsing.test.ts`](json-ld-tolerant.parsing.test.ts), [`json-ld.parsing.test.ts`](json-ld.parsing.test.ts), [`rel-host-base.parsing.test.ts`](rel-host-base.parsing.test.ts), [`source-published.parsing.test.ts`](source-published.parsing.test.ts), [`summarize-sentences-zwsp.parsing.test.ts`](summarize-sentences-zwsp.parsing.test.ts).
- Security: [`doctor-body-release.security.test.ts`](doctor-body-release.security.test.ts), [`download-timeout.security.test.ts`](download-timeout.security.test.ts), [`fetch-cache-key.security.test.ts`](fetch-cache-key.security.test.ts), [`invisible-titles.security.test.ts`](invisible-titles.security.test.ts), [`search-user-agent.security.test.ts`](search-user-agent.security.test.ts).
- Time limits and deadlines: [`pdf-load-options.effect.test.ts`](pdf-load-options.effect.test.ts), [`search-deterministic-deadline.effect.test.ts`](search-deterministic-deadline.effect.test.ts), [`sources-worker-timeout.effect.test.ts`](sources-worker-timeout.effect.test.ts).
- Search and scholarly: [`driver-screenshot.test.ts`](driver-screenshot.test.ts), [`scholarly-openalex.test.ts`](scholarly-openalex.test.ts), [`search-entity-variant.test.ts`](search-entity-variant.test.ts), [`search-diversify.test.ts`](search-diversify.test.ts), [`search-hitkey.test.ts`](search-hitkey.test.ts), [`search-hop-fusion.test.ts`](search-hop-fusion.test.ts), [`search-query.test.ts`](search-query.test.ts), [`search-source-score.effect.test.ts`](search-source-score.effect.test.ts), [`search-web-index.test.ts`](search-web-index.test.ts).
- [sources/](sources/) holds the source adapter tests. See [tests/lib/sources/AGENTS.md](sources/AGENTS.md).

## Rules

- Mock a module in one file only, because Bun keeps its first mock for the whole run. Inject a service when you can, like `PdfLoader`.

## Checks

`mise run test:file tests/lib`
