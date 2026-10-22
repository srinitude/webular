# src/lib/AGENTS.md

Capability code behind the workflows, under [src/AGENTS.md](../AGENTS.md).

## What lives here

- Fetching: [fetch-layer](fetch-layer.ts) is the one fetch layer: deadline, conditional GET, jittered retry, validator cache. [http](fetch-http.ts), [cache](fetch-cache.ts), [types](fetch-types.ts) support it.
- Search: [search](search.ts), [search-chain](search-chain.ts), and `search-*.ts` fuse free-source lists. [sources-search](sources-search.ts) and [sources](sources.ts) fetch evidence for `answer` and `research`.
- Crawl: [crawl](crawl.ts), [frontier](crawl-frontier.ts), [heap](crawl-heap.ts), [resume](crawl-resume.ts), [polite-crawler](polite-crawler.ts).
- robots.txt: [robots](robots-txt.ts) reads it. [robots-gate](robots-gate.ts) gates scrape, batch, and map's root page ([map-root](map-root.ts)), caching each origin's rules for `ROBOTS_TTL_MS`.
- Pages and text: [html](html.ts), [table](html-table.ts), [parse](parse.ts), [select](select.ts), [summarize](summarize.ts), [simhash](simhash.ts), [readability](readability-chain.ts), [json-ld](json-ld.ts).
- Browser drivers: [driver](driver.ts) runs headless Chrome. [cua](driver-cua.ts) and `cua-*.ts` drive the user's window.
- Local state: [snapshot](snapshot.ts) and [index](local-index.ts) use `bun:sqlite`.
- Run settings: [as-of](as-of.ts) sets the run date; `WEBULAR_AS_OF` pins it. `WEBULAR_DETERMINISTIC=1` drops the search chain's settle cutoff.

## Rules

- A driver never shows or focuses a window on the user's screen.
- Only the jev folder calls Jev. Take a decision from [decisions](jev/decisions.ts) and keep a rule-based fallback.
- Size every fan-out from [budget](../core/budget.ts), never a fixed one.
- Return results in input order and failures in attempt order.
- A free source is an adapter in the sources folder, named in its catalog, never hard-coded in the search chain.
- Stream response bodies through the byte-capped reader in [decode](../core/decode.ts), never `res.text()` then a size check. Check `Bun.file` `size` before `.text()` or `.arrayBuffer()`.
- One global socket cap plus a per-host permit; never set `keepalive: false`. Coalesce concurrent fetches of one URL. Bound every queue: the crawl frontier spills to SQLite past its memory cap.
- Be polite per host: a request gap, `Crawl-delay`, one shared deadline for queue wait, retries, and tiers.
- Each `bun:sqlite` database sets WAL, `synchronous = NORMAL`, and `busy_timeout`, batches writes in one transaction, and opens through `acquireRelease`. On macOS, run `wal_checkpoint(TRUNCATE)` before `close()`, or `-wal` and `-shm` files stay. Use `db.prepare()` for dynamic SQL and `safeIntegers: true` for 64-bit values such as SimHash.
- Give each parse Worker one permit; `unref` idle Workers. Cap memo caches, with eviction. `Effect.retry` always passes a schedule or `while` matching retryable failures.
- Readability: `parse()` changes the DOM, so read titles and links first or pass a clone. It returns `null` with no article and never sanitizes. linkedom lacks layout and `documentURI`, so relative links need a `<base href>`.
- Sanitize HTML before turndown (unverified). Pass unpdf a `Uint8Array`. A PDF read stops at 2,000 pages or 60 seconds (`WEBULAR_PDF_MAX_PAGES`, `WEBULAR_PDF_TIMEOUT_MS`), returning its pages with a truncation note. Treat agent-browser output as untrusted: pass `--content-boundaries`, `--max-output`, `--allowed-domains`.
- An unreachable robots.txt (timeout, DNS, refused) means disallow all, crawl root included. Send the webular User-Agent that robots.txt groups match, never a browser one. Source: [RFC 9309](https://www.rfc-editor.org/rfc/rfc9309).

## Checks

```bash
mise run test:file tests/lib tests/core tests/commands/search.test.ts
```

[crawl](crawl.ts) fetches the root before a robots check. [http](fetch-http.ts) sends no User-Agent and [search](search.ts) a Chrome one. [snapshot](snapshot.ts) and [resume](crawl-resume.ts) skip WAL. [driver](driver.ts) and [cua](driver-cua.ts) name layers `Live`.

## Children

- [jev](jev/AGENTS.md)
- [sources](sources/AGENTS.md)
