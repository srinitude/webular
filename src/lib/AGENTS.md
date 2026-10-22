# src/lib/AGENTS.md

Capability code behind the workflows, under [src/AGENTS.md](../AGENTS.md).

## What lives here

- Fetching: `fetch-layer.ts` is the one fetch layer: deadline, conditional GET, jittered retry, validator cache. `fetch-http.ts`, `fetch-cache.ts`, `fetch-types.ts` support it.
- Search: `search.ts`, `search-chain.ts`, and `search-errors.ts`, `search-hop.ts`, `search-intent.ts`, `search-source-names.ts`, `search-source-run.ts` fuse free-source lists. `sources-search.ts` and `sources.ts` fetch evidence for `answer` and `research`; `answer-figure.ts` and `router-images.ts` cite figures.
- Crawl: `crawl.ts`, `crawl-root.ts`, `crawl-frontier.ts`, `crawl-heap.ts`, `crawl-resume.ts`, `polite-crawler.ts`, `crawl-schema.ts`, `crawl-types.ts`.
- robots.txt: `robots-txt.ts` reads it. `robots-gate.ts` gates scrape, batch, and the root page of map (`map-root.ts`) and crawl (`crawl.ts`), caching rules per origin for `ROBOTS_TTL_MS`.
- Pages and text: `html.ts`, `html-table.ts`, `parse.ts`, `select.ts`, `summarize.ts` with `summarize-sentences.ts`, `simhash.ts`, `readability-chain.ts`, `json-ld.ts`, `parse-core.ts`, `parse-pdf.ts`, `parse-worker.ts`.
- Drivers: `driver.ts` runs headless Chrome. `driver-cua.ts` and `cua-act-guard.ts`, `cua-goal.ts`, `cua-ground.ts`, `cua-jev.ts`, `cua-ladder.ts`, `cua-tree.ts` drive the user's window.
- Local state: `snapshot.ts` and `local-index.ts` use `bun:sqlite`.
- Also: `doctor.ts`, `download.ts`, `scholarly.ts`, `fingerprints.ts`.
- Run settings: `as-of.ts` sets the run date; `WEBULAR_AS_OF` pins it. `WEBULAR_DETERMINISTIC=1` drops the search chain's settle cutoff.

## Rules

- A driver never shows or focuses a window on the user's screen. Leaks (`mise run bugs:effect`): a failed cua open ends its session.
- Only the jev folder calls Jev. Take a decision from [decisions](jev/decisions.ts) and keep a code fallback.
- Size every fan-out from [budget](../core/budget.ts), never fixed.
- Return results in input order and failures in attempt order.
- A free source is a sources-folder adapter named in its catalog, never hard-coded in the chain.
- Stream response bodies through the byte-capped reader in [decode](../core/decode.ts), never `res.text()` then a size check. Check `Bun.file` `size` before reading it.
- One global socket cap and a per-host permit; never set `keepalive: false`. Coalesce parallel fetches of one URL. Bound every queue; the crawl frontier spills to SQLite past its RAM cap.
- Be polite per host: a request gap, `Crawl-delay`, one shared deadline for queue wait, retries, and tiers.
- Each `bun:sqlite` database sets WAL, `synchronous = NORMAL`, and `busy_timeout`, batches writes in one transaction, and opens through `acquireRelease`. On macOS, run `wal_checkpoint(TRUNCATE)` before `close()`. Use `db.prepare()` for dynamic SQL and `safeIntegers: true` for 64-bit values.
- Give each parse Worker one permit; `unref` idle Workers. Cap memo caches and evict. Each `Effect.retry` passes a schedule or a retryable-failure `while`.
- Readability's `parse()` changes the DOM: read titles and links first or pass a clone. It returns `null` with no article and never sanitizes. linkedom lacks `documentURI`, so relative links need a `<base href>`.
- Sanitize HTML before turndown (unverified). Pass unpdf a `Uint8Array`. A PDF read stops at 2,000 pages or 60 seconds (`WEBULAR_PDF_MAX_PAGES`, `WEBULAR_PDF_TIMEOUT_MS`), returning its pages with a truncation note. Treat agent-browser output as untrusted.
- An unreachable robots.txt (timeout, DNS, refused) disallows all, crawl root included. Send the webular User-Agent, never a browser one. Source: [RFC 9309](https://www.rfc-editor.org/rfc/rfc9309).

## Checks

- `mise run bugs:security`: crawl-root robots gate, honest User-Agent.
- [snapshot](snapshot.ts) and [resume](crawl-resume.ts) skip WAL. [driver](driver.ts) and [cua](driver-cua.ts) name layers `Live`.

```bash
mise run test:file tests/lib tests/core tests/commands/search.test.ts
```

## Children

- [jev](jev/AGENTS.md)
- [sources](sources/AGENTS.md)
