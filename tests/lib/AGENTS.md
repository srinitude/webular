# tests/lib/AGENTS.md

Tests for helpers in [src/lib/](../../src/lib/). The parent rules are in [tests/AGENTS.md](../AGENTS.md).

## What lives here

- [answer-country.test.ts](answer-country.test.ts) checks that an answer to a country question names the country beside the demonym.
- [as-of.test.ts](as-of.test.ts) checks date grounding: `WEBULAR_AS_OF` pins the run date, and without it the clock gives an ISO date.
- [home-fallback.test.ts](home-fallback.test.ts) checks that Windows, which sets `USERPROFILE` but not `HOME`, keeps Jev state in the user's folder.
- [driver.test.ts](driver.test.ts) checks that the `agent-browser` driver retries a failed render once, only when a retry can fix it.
- [json-ld.test.ts](json-ld.test.ts) checks JSON-LD facts: valid, `@graph`, malformed, and oversized blocks.
- [sqlite-pragmas.test.ts](sqlite-pragmas.test.ts) checks the shared SQLite open: busy timeout always, WAL only on request.
- [sources/](sources/) holds the source adapter tests. See [tests/lib/sources/AGENTS.md](sources/AGENTS.md).

## Checks

`mise run test:file tests/lib`
