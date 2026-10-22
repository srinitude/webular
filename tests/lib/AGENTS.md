# tests/lib/AGENTS.md

Tests for helpers in [src/lib/](../../src/lib/). The parent rules are in [tests/AGENTS.md](../AGENTS.md).

## What lives here

- [answer-country.test.ts](answer-country.test.ts) checks that an answer to a country question names the country beside the demonym.
- [as-of.test.ts](as-of.test.ts) checks date grounding: `WEBULAR_AS_OF` pins the run date, and without it the clock gives an ISO date.
- [home-fallback.test.ts](home-fallback.test.ts) checks that Windows, which sets `USERPROFILE` but not `HOME`, keeps Jev state in the user's folder.
- [driver.test.ts](driver.test.ts) checks that the `agent-browser` driver retries a failed render once, only when a retry can fix it.
- [json-ld.test.ts](json-ld.test.ts) checks JSON-LD facts: valid, `@graph`, malformed, and oversized blocks.
- [sqlite-pragmas.test.ts](sqlite-pragmas.test.ts) checks the shared SQLite open: busy timeout always, WAL only on request.
- Parsing: [`html-extract-rest.parsing.test.ts`](html-extract-rest.parsing.test.ts), [`html-extraction.parsing.test.ts`](html-extraction.parsing.test.ts), [`html-links-base.parsing.test.ts`](html-links-base.parsing.test.ts), [`json-ld-tolerant.parsing.test.ts`](json-ld-tolerant.parsing.test.ts), [`json-ld.parsing.test.ts`](json-ld.parsing.test.ts), [`rel-host-base.parsing.test.ts`](rel-host-base.parsing.test.ts), [`summarize-sentences-zwsp.parsing.test.ts`](summarize-sentences-zwsp.parsing.test.ts).
- Security: [`doctor-body-release.security.test.ts`](doctor-body-release.security.test.ts), [`download-timeout.security.test.ts`](download-timeout.security.test.ts), [`fetch-cache-key.security.test.ts`](fetch-cache-key.security.test.ts), [`invisible-titles.security.test.ts`](invisible-titles.security.test.ts), [`search-user-agent.security.test.ts`](search-user-agent.security.test.ts).
- Time limits and deadlines: [`pdf-load-timeout.effect.test.ts`](pdf-load-timeout.effect.test.ts), [`search-deterministic-deadline.effect.test.ts`](search-deterministic-deadline.effect.test.ts), [`sources-worker-timeout.effect.test.ts`](sources-worker-timeout.effect.test.ts).
- Search and scholarly: [`driver-screenshot.test.ts`](driver-screenshot.test.ts), [`scholarly-openalex.test.ts`](scholarly-openalex.test.ts), [`search-entity-variant.test.ts`](search-entity-variant.test.ts), [`search-hitkey.test.ts`](search-hitkey.test.ts), [`search-web-index.test.ts`](search-web-index.test.ts).
- [sources/](sources/) holds the source adapter tests. See [tests/lib/sources/AGENTS.md](sources/AGENTS.md).

## Checks

`mise run test:file tests/lib`
