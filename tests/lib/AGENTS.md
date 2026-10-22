# tests/lib/AGENTS.md

Tests for helpers in [src/lib/](../../src/lib/). The parent rules are in [tests/AGENTS.md](../AGENTS.md).

## What lives here

- [answer-country.test.ts](answer-country.test.ts): a country answer names the country with the demonym.
- [as-of.test.ts](as-of.test.ts): `WEBULAR_AS_OF` pins the run date; otherwise the clock gives an ISO date.
- [home-fallback.test.ts](home-fallback.test.ts): on Windows, with `USERPROFILE` but no `HOME`, Jev state stays in the user folder.
- [driver.test.ts](driver.test.ts): the `agent-browser` driver retries a failed render once, only when a retry can fix it.
- [agentbrowser-bin.test.ts](agentbrowser-bin.test.ts): each capture runs the native binary, not the slower node shim.
- [json-ld.test.ts](json-ld.test.ts): JSON-LD facts from valid, `@graph`, bad, and oversized blocks.
- [extract-locators.test.ts](extract-locators.test.ts): extract finds a field by name with no model, picks one selector for repeated records, keeps Legislation and Dataset JSON-LD, and takes date, author, and offer from structured data first.
- [snapshot-normalize.test.ts](snapshot-normalize.test.ts): monitor snapshots ignore whitespace churn but catch repeated-line edits.
- [snapshot-diff-bound.test.ts](snapshot-diff-bound.test.ts): a small change gives a diff; a huge rewrite gives a "diff too large" note.
- [html-thin-union.parsing.test.ts](html-thin-union.parsing.test.ts): when Readability keeps a thin scrap, the fuller body comes back, code and math included.
- [parse-pdf-layout.test.ts](parse-pdf-layout.test.ts): PDF layout helpers drop repeated page lines, read columns left then right, and flag a poor page.
- [sqlite-pragmas.test.ts](sqlite-pragmas.test.ts): the shared SQLite open always sets a busy timeout, and WAL only on request.
- Parsing: [html-block-breaks](html-block-breaks.parsing.test.ts), [html-body-fallback](html-body-fallback.parsing.test.ts), [html-extract-rest](html-extract-rest.parsing.test.ts), [html-extraction](html-extraction.parsing.test.ts), [html-links-base](html-links-base.parsing.test.ts), [html-readability-cap](html-readability-cap.parsing.test.ts), [html-turndown-cap](html-turndown-cap.parsing.test.ts), [json-ld-tolerant](json-ld-tolerant.parsing.test.ts), [json-ld](json-ld.parsing.test.ts), [rel-host-base](rel-host-base.parsing.test.ts), [source-published](source-published.parsing.test.ts), [summarize-sentences-zwsp](summarize-sentences-zwsp.parsing.test.ts).
- Security: [doctor-body-release.security.test.ts](doctor-body-release.security.test.ts), [download-timeout.security.test.ts](download-timeout.security.test.ts), [embedded-v4-address.security.test.ts](embedded-v4-address.security.test.ts), [fetch-cache-key.security.test.ts](fetch-cache-key.security.test.ts), [invisible-titles.security.test.ts](invisible-titles.security.test.ts), [private-address.security.test.ts](private-address.security.test.ts), [search-user-agent.security.test.ts](search-user-agent.security.test.ts).
- Time limits: [pdf-load-options.effect.test.ts](pdf-load-options.effect.test.ts), [search-deterministic-deadline.effect.test.ts](search-deterministic-deadline.effect.test.ts), [sources-worker-timeout.effect.test.ts](sources-worker-timeout.effect.test.ts).
- Search and scholarly: [driver-screenshot.test.ts](driver-screenshot.test.ts), [scholarly-openalex.test.ts](scholarly-openalex.test.ts), [search-entity-variant.test.ts](search-entity-variant.test.ts), [search-diversify.test.ts](search-diversify.test.ts), [search-hitkey.test.ts](search-hitkey.test.ts), [search-hop-fusion.test.ts](search-hop-fusion.test.ts), [search-query.test.ts](search-query.test.ts), [search-source-score.effect.test.ts](search-source-score.effect.test.ts), [search-web-index.test.ts](search-web-index.test.ts).
- [sources/](sources/) holds the source adapter tests. See [tests/lib/sources/AGENTS.md](sources/AGENTS.md).

## Rules

- Mock a module in one file only, because Bun keeps its first mock for the whole run. Inject a service when you can, like `PdfLoader`.

## Checks

`mise run test:file tests/lib`
