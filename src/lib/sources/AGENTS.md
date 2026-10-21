# src/lib/sources/AGENTS.md

Rules for the free source adapters, under [src/lib/AGENTS.md](../AGENTS.md).

## What lives here

- Adapters, one topic per file: `web.ts`, `news.ts`, `books.ts`, `scholarly.ts`, `communities.ts`, `archives.ts`, `feeds.ts`, `documents.ts`, and `wikidata-facts.ts`.
- `catalog.ts` names every adapter and says how far its hits can be believed.
- `registry.ts` is the one entry point. It routes a command to adapters and sets the fallback order.
- `rank.ts` orders merged hits by trust times recency.
- `polite.ts` is the shared plumbing: one request in flight per host, a minimum gap, a contact User-Agent, and a schema-checked JSON GET.
- `archive-copy.ts` fetches an archive capture when a live page is dead.

## Rules

- Every adapter is keyless. Do not add one that needs a key.
- Route all requests through `polite.ts` and `src/core/http.ts`. Never call `fetch` in place.
- Decode each reply with a `Schema`. An unexpected reply is a typed failure, not a guess.
- `WEBULAR_SOURCE_ORIGIN` swaps an adapter's origin so tests run against a local fixture server. Keep each adapter working with it.
- `WEBULAR_MAILTO` goes into the User-Agent. Respect each source's stated rate.
- Adding an adapter takes these steps: write it, name it in `catalog.ts`, add it to the order in `registry.ts`, and test it.
- Ranking and merging stay in the search chain, not in an adapter.

## Checks

```bash
mise run test:file tests/lib/sources tests/commands/search-sources.test.ts
```
