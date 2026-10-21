# src/lib/AGENTS.md

Rules for the capability code behind the workflows, under [src/AGENTS.md](../AGENTS.md).

## What lives here

Files group by name prefix:

- Fetching: `fetch-layer.ts` is the one fetch layer, with deadline, conditional GET, jittered retry, and a validator cache. `fetch-http.ts`, `fetch-cache.ts`, and `fetch-types.ts` support it.
- Search: `search.ts`, `search-chain.ts`, and the other `search-*.ts` files ask the free sources and fuse their lists. `sources-search.ts` and `sources.ts` fetch the evidence for `answer` and `research`.
- Crawl: `crawl.ts` plus `crawl-frontier.ts`, `crawl-heap.ts`, `crawl-resume.ts`, and `polite-crawler.ts`. `robots-txt.ts` reads `robots.txt`.
- Pages and text: `html.ts`, `html-table.ts`, `parse.ts`, `select.ts`, `summarize.ts`, `simhash.ts`, and `readability-chain.ts`.
- Browser drivers: `driver.ts` runs a headless Chrome. `driver-cua.ts` and the `cua-*.ts` files drive the user's own window.
- Local state: `snapshot.ts` and `local-index.ts` use `bun:sqlite`.
- Folders: `jev/` holds every Jev decision. `sources/` holds the free source adapters.

## Rules

- A driver never shows or focuses a window on the user's screen.
- Jev calls live in `jev/` only. Code here takes a decision from `jev/decisions.ts` and keeps a rule-based fallback.
- Every fan-out takes its size from `src/core/budget.ts`, never a fixed number.
- Keep results in input order, not completion order. Failures come back in attempt order.
- A free source is an adapter in `sources/`, named in its catalog. Do not hard-code it in the search chain.
- Stream every response body through the byte-capped reader in `src/core/decode.ts`. Never call `res.text()` and check the size afterward. Check `Bun.file` `size` against the budget before `.text()` or `.arrayBuffer()`.
- Keep one global socket cap plus a per-host permit, and never set `keepalive: false`. Coalesce concurrent fetches of one URL. Bound every queue: the crawl frontier spills to SQLite past its memory cap.
- Keep per-host politeness: a request gap, `Crawl-delay`, and one shared deadline for queue wait, retries, and tiers.
- Every `bun:sqlite` database sets WAL, `synchronous = NORMAL`, and `busy_timeout`, batches writes in one transaction, and opens through `acquireRelease`. On macOS, run `wal_checkpoint(TRUNCATE)` before `close()`, or the `-wal` and `-shm` files stay. Use `db.prepare()` for dynamic SQL, and `safeIntegers: true` for 64-bit values such as SimHash.
- Cap the parse Worker pool with one permit per Worker, and `unref` idle Workers. Give memo caches a size cap with eviction. `Effect.retry` always passes a schedule or `while` that matches retryable failures.
- Readability: `parse()` changes the DOM, so read titles and links first or pass a clone. It returns `null` without an article and does not sanitize. linkedom has no layout, and no `documentURI`, so relative links need a `<base href>`.
- Sanitize HTML before turndown (unverified). Pass unpdf a `Uint8Array`, and cap `numPages` and the extraction time. Treat agent-browser output as untrusted: pass `--content-boundaries`, `--max-output`, and `--allowed-domains`.
- An unreachable robots.txt (timeout, DNS, refused) means disallow all, and the crawl root is checked too. Send the webular User-Agent that robots.txt groups match, never a browser one. Source: [RFC 9309](https://www.rfc-editor.org/rfc/rfc9309).

## Checks

```bash
mise run test:file tests/lib tests/core tests/commands/search.test.ts
```

- crawl.ts:101 turns a failed robots.txt fetch into status 0, read as allow-all. crawl.ts:196 fetches the root before any robots check.
- fetch-http.ts:56 sends no User-Agent, and search.ts:18 sends a Chrome one.
- snapshot.ts:29 and crawl-resume.ts:14 open SQLite with no WAL pragma.
- driver.ts:131 and driver-cua.ts:197 name layers with a Live suffix.

## Children

- [jev/AGENTS.md](jev/AGENTS.md)
- [sources/AGENTS.md](sources/AGENTS.md)
