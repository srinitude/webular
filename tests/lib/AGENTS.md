# tests/lib/AGENTS.md

Tests for helpers in [src/lib/](../../src/lib/). The parent rules are in [tests/AGENTS.md](../AGENTS.md).

## What lives here

- [answer-country](answer-country.test.ts): a country answer names the country with the demonym.
- [as-of](as-of.test.ts): `WEBULAR_AS_OF` pins the run date; otherwise the clock gives an ISO date.
- [home-fallback](home-fallback.test.ts): on Windows, with `USERPROFILE` but no `HOME`, Jev state stays in the user folder.
- [driver](driver.test.ts): the `agent-browser` driver retries a failed render once, only when a retry can fix it.
- [agentbrowser-bin](agentbrowser-bin.test.ts): each capture runs the native binary, not the node shim.
- [agentbrowser-pick](agentbrowser-pick.test.ts): a Windows launcher on PATH falls through to the native binary, and every native name is a shipped binary.
- [agentbrowser-sessions](agentbrowser-sessions.test.ts): browser batches use a named webular session with an idle timeout, and the run's end closes them.
- [json-ld](json-ld.test.ts): JSON-LD facts from valid, `@graph`, bad, and oversized blocks.
- [extract-locators](extract-locators.test.ts): extract finds a field by name with no model, picks one selector per repeated record, keeps Legislation and Dataset JSON-LD, and prefers structured date, author, and offer.
- [snapshot-normalize](snapshot-normalize.test.ts): monitor snapshots ignore whitespace churn but catch repeated-line edits.
- [snapshot-diff-bound](snapshot-diff-bound.test.ts): a small change gives a diff; a huge rewrite gives a "diff too large" note.
- [html-thin-union.parsing](html-thin-union.parsing.test.ts): when Readability keeps a thin scrap, the fuller body comes back with code and math.
- [parse-pdf-layout](parse-pdf-layout.test.ts): PDF layout drops repeated page lines, reads columns left then right, and flags a poor page.
- [sqlite-pragmas](sqlite-pragmas.test.ts): the shared SQLite open sets a busy timeout, and WAL only on request.
- Parsing: [html-block-breaks](html-block-breaks.parsing.test.ts), [html-body-fallback](html-body-fallback.parsing.test.ts), [html-extract-rest](html-extract-rest.parsing.test.ts), [html-extraction](html-extraction.parsing.test.ts), [html-links-base](html-links-base.parsing.test.ts), [html-readability-cap](html-readability-cap.parsing.test.ts), [html-turndown-cap](html-turndown-cap.parsing.test.ts), [json-ld-tolerant](json-ld-tolerant.parsing.test.ts), [json-ld](json-ld.parsing.test.ts), [rel-host-base](rel-host-base.parsing.test.ts), [source-published](source-published.parsing.test.ts), [summarize-sentences-zwsp](summarize-sentences-zwsp.parsing.test.ts).
- Security: [doctor-body-release](doctor-body-release.security.test.ts), [download-timeout](download-timeout.security.test.ts), [embedded-v4-address](embedded-v4-address.security.test.ts), [fetch-cache-key](fetch-cache-key.security.test.ts), [invisible-titles](invisible-titles.security.test.ts), [private-address](private-address.security.test.ts), [search-user-agent](search-user-agent.security.test.ts).
- Time limits: [doctor-timeout](doctor-timeout.test.ts), [pdf-load-options](pdf-load-options.effect.test.ts), [search-deterministic-deadline](search-deterministic-deadline.effect.test.ts), [sources-worker-timeout](sources-worker-timeout.effect.test.ts).
- Search and scholarly: [driver-screenshot](driver-screenshot.test.ts), [scholarly-openalex](scholarly-openalex.test.ts), [search-entity-variant](search-entity-variant.test.ts), [search-diversify](search-diversify.test.ts), [search-hitkey](search-hitkey.test.ts), [search-hop-fusion](search-hop-fusion.test.ts), [search-query](search-query.test.ts), [search-rerank-gate](search-rerank-gate.test.ts), [search-source-score.effect](search-source-score.effect.test.ts), [search-web-index](search-web-index.test.ts).
- [sources/](sources/) holds the source adapter tests. See [tests/lib/sources/AGENTS.md](sources/AGENTS.md).

## Rules

- Mock a module in one file only: Bun keeps its first mock for the whole run. Inject a service when you can, like `PdfLoader`.

## Checks

`mise run test:file tests/lib`
