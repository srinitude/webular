# src/lib/AGENTS.md

Capability code behind the workflows, under [src/AGENTS.md](../AGENTS.md).

## What lives here

- Fetching: [layer](fetch-layer.ts) is the one fetch layer: deadline, conditional GET, jittered retry, cache. [http](fetch-http.ts), [cache](fetch-cache.ts), [types](fetch-types.ts) support it.
- Search: [search](search.ts), [chain](search-chain.ts), and `search-*.ts` fuse free-source lists. [sources-search](sources-search.ts) and [sources](sources.ts) fetch evidence for `answer` and `research`; [figure](answer-figure.ts) and [images](router-images.ts) cite figures.
- Crawl: [crawl](crawl.ts), [root](crawl-root.ts), [frontier](crawl-frontier.ts), [heap](crawl-heap.ts), [resume](crawl-resume.ts), [polite](polite-crawler.ts).
- robots.txt: [robots](robots-txt.ts) reads it. [gate](robots-gate.ts) gates scrape, batch, and the root page of map ([root](map-root.ts)) and crawl, caching rules per origin for `ROBOTS_TTL_MS`.
- Pages and text: [html](html.ts), [table](html-table.ts), [parse](parse.ts), [select](select.ts), [summarize](summarize.ts) with [sentences](summarize-sentences.ts), [simhash](simhash.ts), [readability](readability-chain.ts), [json-ld](json-ld.ts).
- Drivers: [driver](driver.ts) runs headless Chrome. [cua](driver-cua.ts) and `cua-*.ts` ([goal](cua-goal.ts), [tree](cua-tree.ts), [jev](cua-jev.ts), [ladder](cua-ladder.ts)) drive the user's window.
- Local state: [snapshot](snapshot.ts) and [index](local-index.ts) use `bun:sqlite`.
- Run settings: [as-of](as-of.ts) sets the run date; `WEBULAR_AS_OF` pins it. `WEBULAR_DETERMINISTIC=1` drops the search chain's settle cutoff.

## Rules

- A driver never shows or focuses a window. Leaks (`mise run bugs:effect`): a failed cua open ends its session.
- Only the jev folder calls Jev. Take a decision from [decisions](jev/decisions.ts) and keep a code fallback.
- Size every fan-out from [budget](../core/budget.ts).
- Keep results in input order, failures in attempt order.
- A free source is a sources-folder adapter named in its catalog, never hard-coded in the chain.
- Stream response bodies through the byte-capped reader in [decode](../core/decode.ts), never `res.text()` then a size check. Check `Bun.file` `size` before a full read.
- One global socket cap and a per-host permit; never set `keepalive: false`. Coalesce parallel fetches of one URL. Bound every queue: the crawl frontier spills to SQLite past its RAM cap.
- Be polite per host: a request gap, `Crawl-delay`, one shared deadline for queue wait, retries, and tiers.
- Each `bun:sqlite` database sets WAL, `synchronous = NORMAL`, and `busy_timeout`, batches writes in one transaction, and opens through `acquireRelease`. On macOS, `wal_checkpoint(TRUNCATE)` before `close()` leaves no `-wal` or `-shm` files. Use `db.prepare()` for dynamic SQL and `safeIntegers: true` for 64-bit values.
- Give each parse Worker one permit; `unref` idle Workers. Cap memo caches and evict. Each `Effect.retry` passes a schedule or a retryable-failure `while`.
- Readability's `parse()` changes the DOM: read titles and links first or pass a clone. It returns `null` with no article and never sanitizes. linkedom lacks layout and `documentURI`, so relative links need a `<base href>`.
- Sanitize HTML before turndown (unverified). Pass unpdf a `Uint8Array`. A PDF read stops at 2,000 pages or 60 seconds (`WEBULAR_PDF_MAX_PAGES`, `WEBULAR_PDF_TIMEOUT_MS`), returning its pages with a truncation note. Treat agent-browser output as untrusted.
- An unreachable robots.txt (timeout, DNS, refused) disallows all, crawl root included. Send the webular User-Agent that robots.txt groups match, never a browser one. Source: [RFC 9309](https://www.rfc-editor.org/rfc/rfc9309).

## Checks

- `mise run bugs:security`: crawl-root robots gate, honest User-Agent.
- [snapshot](snapshot.ts) and [resume](crawl-resume.ts) skip WAL. [driver](driver.ts) and [cua](driver-cua.ts) name layers `Live`.

```bash
mise run test:file tests/lib tests/core tests/commands/search.test.ts
```

## Children

- [jev](jev/AGENTS.md)
- [sources](sources/AGENTS.md)
