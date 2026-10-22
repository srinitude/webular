# src/lib/sources/AGENTS.md

Rules for the free source adapters, under [src/lib/AGENTS.md](../AGENTS.md).

## What lives here

- Adapters, one topic per file: [`web.ts`](web.ts), [`news.ts`](news.ts), [`books.ts`](books.ts), [`scholarly.ts`](scholarly.ts), [`communities.ts`](communities.ts), [`archives.ts`](archives.ts), [`feeds.ts`](feeds.ts), [`documents.ts`](documents.ts), and [`wikidata-facts.ts`](wikidata-facts.ts).
- [`catalog.ts`](catalog.ts) names every adapter and holds `SOURCE_TRUST`, a fixed score in `[0, 1]` for how far each adapter's hits can be believed.
- [`registry.ts`](registry.ts) is the one entry point. It routes a command to adapters, sets the fallback order, and stamps each hit with its adapter and that score.
- [`rank.ts`](rank.ts) orders merged hits by the adapter's `SOURCE_TRUST` score times recency. Recency halves every 365 days, every 30 for a fresh query ("latest"), and every 3,650 for a history query. A dated hit outside a named year window ("in 2024") scores zero.
- [`polite.ts`](polite.ts) is the shared plumbing: one request in flight per host, a minimum gap, a contact User-Agent, and a schema-checked JSON GET.
- [`archive-copy.ts`](archive-copy.ts) fetches an archive capture when a live page is dead.
- [`fetch-one.ts`](fetch-one.ts) fetches one `answer` or `research` source, behind the address guard and robots.txt.

## Rules

- Every adapter is keyless. Do not add one that needs a key.
- Route all requests through [`polite.ts`](polite.ts) and [`src/core/http.ts`](../../core/http.ts). Never call `fetch` in place.
- Decode each reply with a `Schema`. An unexpected reply is a typed failure, not a guess.
- `WEBULAR_SOURCE_ORIGIN` swaps an adapter's origin so tests run against a local fixture server. Keep each adapter working with it.
- `WEBULAR_MAILTO` goes into the User-Agent. Respect each source's stated rate.
- Adding an adapter takes these steps: write it, name it in [`catalog.ts`](catalog.ts), add it to the order in [`registry.ts`](registry.ts), and test it.
- Ranking and merging stay in the search chain, not in an adapter.

## Checks

- `Retry-After` date parsing in [polite](polite.ts) has guards in `mise run bugs:parsing`.

```bash
mise run test:file tests/lib/sources tests/commands/search-sources.test.ts
```
