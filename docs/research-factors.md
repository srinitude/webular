# Research factors

Web research is worth having only when its answers are right, quick, cheap, and the same on every run.
This page lists each factor behind those goals, plus robustness and safety.
For each factor it names the code and the test that guard it.
When nothing guards a factor yet, the page says so and names what would close the gap.

## How to read this page

- **Guarded** means code enforces the factor, and a test fails when that code breaks.
- **Gap** means nothing enforces the factor yet. The entry names the missing piece.
- Paths start at the repo root. Quoted names are test titles.

## Correctness

- **Source quality: guarded.**
  - Code: `domainSignal` and `OFFICIAL_BOOST` in [src/lib/search.ts](../src/lib/search.ts), plus the Jev checks `answer.hits` and `answer.sources` in [src/workflows/answer.ts](../src/workflows/answer.ts).
  - Tests: [tests/engine/search-rank.test.ts](../tests/engine/search-rank.test.ts) ("the official domain outranks a higher-placed Wikipedia hit"). Jev evals: [answer.hits.json](../tests/jev/evals/answer.hits.json) and [answer.sources.json](../tests/jev/evals/answer.sources.json).
- **Citation faithfulness: guarded.**
  - Code: `citationBaseline` in [src/lib/jev/decisions/answer-citation.ts](../src/lib/jev/decisions/answer-citation.ts). A word-for-word quote counts as supported. Jev can overrule that only when both option orders agree at 0.95.
  - Test: Jev eval [answer.citation.json](../tests/jev/evals/answer.citation.json).
- **Freshness of the run and the cache: guarded.**
  - Code: [src/lib/as-of.ts](../src/lib/as-of.ts) stamps the run date, and [src/core/cache.ts](../src/core/cache.ts) checks freshness.
  - Tests: [tests/lib/as-of.test.ts](../tests/lib/as-of.test.ts) and [tests/core/cache-fresh.test.ts](../tests/core/cache-fresh.test.ts).
- **Freshness of each source: gap.** Search hits and fetched pages carry no published or changed date, so nothing ranks or flags a stale page. To close it, read JSON-LD `datePublished`, `article:modified_time`, or `Last-Modified` into each source entry, then add an age signal to `scoreHits`.
- **Dedupe: guarded.**
  - Code: `dedupeKey` in [src/core/url.ts](../src/core/url.ts), used by search ranking and by `fetchSources` in [src/lib/sources.ts](../src/lib/sources.ts). `fetchSources` serves `answer --urls` and `research`. It keeps the first copy of a page and drops later spellings that differ only by fragment, tracking parameters, or query order.
  - Tests: [tests/engine/sources.test.ts](../tests/engine/sources.test.ts) ("one page under several URL spellings is fetched and cited once"), [tests/lib/search-hitkey.test.ts](../tests/lib/search-hitkey.test.ts), and [tests/core/near-duplicate.test.ts](../tests/core/near-duplicate.test.ts).
- **Canonical URLs for crawl scope: guarded.**
  - Code: `normalizeUrl` and `canonicalUrl` in [src/core/url.ts](../src/core/url.ts).
  - Test: [tests/engine/canonical-url.test.ts](../tests/engine/canonical-url.test.ts) ("ignores an off-host canonical so crawl scope never moves").
- **Canonical URLs in citations: gap.** `answer` and `research` cite the URL they fetched, not the page's `rel="canonical"` link. The fix is to set the entry URL from `canonicalUrl` in [src/lib/sources/fetch-one.ts](../src/lib/sources/fetch-one.ts). That changes the URLs in Jev payloads, so it needs fresh Jev recordings.

## Speed

- **Bounded concurrency: guarded.**
  - Code: [src/core/budget.ts](../src/core/budget.ts) sizes the limit to the host, from 1 to 16, with an override capped at 32.
  - Tests: [tests/core/budget.test.ts](../tests/core/budget.test.ts). The grep gate "every fan-out has a numeric concurrency bound" in [tests/quality/rule-greps.test.ts](../tests/quality/rule-greps.test.ts) blocks `unbounded`, `inherit`, and `Infinity` in [src/](../src/).
- **Caching: guarded.**
  - Code: [src/core/cache.ts](../src/core/cache.ts) keeps a disk cache capped by bytes and entries. It evicts the entry used longest ago, and it never stores a `no-store` response.
  - Tests: [tests/core/cache.test.ts](../tests/core/cache.test.ts) and [tests/core/fetch-cache.test.ts](../tests/core/fetch-cache.test.ts).
- **Conditional GET for text pages: guarded.**
  - Code: [src/core/cache.ts](../src/core/cache.ts) sends `If-None-Match` and `If-Modified-Since`, then reuses the stored body on a 304.
  - Test: [tests/core/cache.test.ts](../tests/core/cache.test.ts) ("stores a hit, then revalidates with If-None-Match and reuses the body on 304").
- **Conditional GET for binary and media: gap.** Byte downloads skip the disk cache. Closing this means a byte-storing cache path next to the text one.
- **Early exit: guarded.**
  - Code: the `worker` loop in [src/lib/polite-crawler.ts](../src/lib/polite-crawler.ts) stops at `maxPages`, and crawl output reports `limitReached`.
  - Test: [tests/core/polite-crawler.test.ts](../tests/core/polite-crawler.test.ts) ("crawl: stops fetching once maxPages is reached, even with spare workers").

## Cost

- **Token caps: guarded.**
  - Code: `JEV_TOKEN_CAP` in [src/lib/jev/payload/canonical.ts](../src/lib/jev/payload/canonical.ts), plus the output and byte caps in [src/core/output.ts](../src/core/output.ts) and [src/core/capped-bytes.ts](../src/core/capped-bytes.ts).
  - Tests: [tests/jev/framework-bounds.test.ts](../tests/jev/framework-bounds.test.ts) ("a payload over the cap fails with a typed error") and [tests/core/fetch-body-cap.test.ts](../tests/core/fetch-body-cap.test.ts).
- **Request budget for live Jev calls: guarded.**
  - Code: `makeAsk` in [src/lib/jev/store.ts](../src/lib/jev/store.ts) counts live calls. Past `WEBULAR_JEV_MAX_CALLS` (500 by default), a call sends nothing and fails with a `budget` error, so the decision's fixed fallback answers. Cache and replay hits cost nothing.
  - Test: [tests/jev/call-budget.test.ts](../tests/jev/call-budget.test.ts) ("live calls past the cap fail with a budget error and send nothing").
- **Other request budgets: guarded.** Jev runs at most 8 calls at once (`JEV_CONCURRENCY` in [src/lib/jev/client.ts](../src/lib/jev/client.ts)). Each decision gets half the fetch timeout (`withJevBudget` in [src/lib/jev/budget.ts](../src/lib/jev/budget.ts)). Retries follow the flags in [src/lib/jev/errors.ts](../src/lib/jev/errors.ts), tested in [tests/jev/retry-errors.test.ts](../tests/jev/retry-errors.test.ts).
- **Free sources first: gap in its test.** [src/lib/search-chain.ts](../src/lib/search-chain.ts) asks the free keyless APIs first, and DuckDuckGo only when they return nothing. Cache and replay come before any live Jev call. No test pins the DuckDuckGo-last order, so a test in [tests/engine/search-chain.test.ts](../tests/engine/search-chain.test.ts) that counts calls per source would close the gap.

## Determinism

- **Replay: guarded.** `replay()` in [src/machines/agent.ts](../src/machines/agent.ts) replays recorded events. [tests/bench/replay.ts](../tests/bench/replay.ts) feeds recorded replies through the real schema decode.
- **Fixed seeds: guarded.** `fullJitterDelay` in [src/core/fetch-policy.ts](../src/core/fetch-policy.ts) takes its random value as an argument. [tests/core/fetch-layer.test.ts](../tests/core/fetch-layer.test.ts) uses a seeded generator, and [tests/bench/peers-order.test.ts](../tests/bench/peers-order.test.ts) checks "the same seed gives the same order".
- **Sorted output: guarded.** `stableJson` in [src/core/output.ts](../src/core/output.ts) sorts keys at every depth. Test: [tests/core/output.test.ts](../tests/core/output.test.ts) ("identical input gives identical output").
- **Stable ranking: guarded.**
  - Code: `scoreHits` in [src/lib/search.ts](../src/lib/search.ts) keeps first-seen order on ties. Cache eviction in [src/core/cache.ts](../src/core/cache.ts) breaks ties on last use by file name, never by directory order.
  - Tests: [tests/quality/search-determinism.test.ts](../tests/quality/search-determinism.test.ts) and [tests/core/cache-evict-tie.test.ts](../tests/core/cache-evict-tie.test.ts) ("entries tied on last use are evicted in file-name order").
- **NDJSON list field: gap.** `toNdjson` in [src/core/output.ts](../src/core/output.ts) picks the first list field in build order. Each command builds its output in one fixed order, so its NDJSON stays stable. A named list field per output shape would close the gap.
- **Recorded fixtures: guarded.** [tests/fixtures/](../tests/fixtures/) holds recorded pages and replies. [tests/_support/fixture.ts](../tests/_support/fixture.ts) and [tests/_support/scripted-server.ts](../tests/_support/scripted-server.ts) serve them.

## Robustness

- **Retries: guarded.**
  - Code: [src/core/fetch-policy.ts](../src/core/fetch-policy.ts) retries only 408, 429, 502, 503, and 504, with jittered backoff. [src/core/http.ts](../src/core/http.ts) runs it.
  - Tests: [tests/core/fetch-policy-jitter.test.ts](../tests/core/fetch-policy-jitter.test.ts) and [tests/core/fault-injection.test.ts](../tests/core/fault-injection.test.ts).
- **Rate limits on one fetch: guarded.** [src/core/retry-after.ts](../src/core/retry-after.ts) reads `Retry-After` in seconds or as a date, up to 10 s. Tests: [tests/core/retry-after.parsing.test.ts](../tests/core/retry-after.parsing.test.ts) and [tests/core/http-wait.security.test.ts](../tests/core/http-wait.security.test.ts).
- **Per-host pacing: guarded.**
  - Code: `nextDelay` in [src/lib/crawl-types.ts](../src/lib/crawl-types.ts) and the per-host release in [src/lib/polite-crawler.ts](../src/lib/polite-crawler.ts). The crawler waits out a 429 or 5xx `Retry-After` before it asks that host again.
  - Tests: [tests/core/polite-crawler-frontier.test.ts](../tests/core/polite-crawler-frontier.test.ts) and [tests/core/polite-crawler-retry-after.test.ts](../tests/core/polite-crawler-retry-after.test.ts) ("crawl: the next request to a host waits out its 429 Retry-After").
- **Long Retry-After in a crawl: gap.** The crawler's wait tops out at 2.5 s, so it shortens a longer `Retry-After`. Lifting that cap for `Retry-After` alone would close it.
- **robots.txt: guarded.** [src/lib/robots-txt.ts](../src/lib/robots-txt.ts) follows RFC 9309, and [src/lib/robots-gate.ts](../src/lib/robots-gate.ts) checks every redirect hop. Tests: [tests/core/robots-txt.test.ts](../tests/core/robots-txt.test.ts) and [tests/engine/crawl-root-robots.security.test.ts](../tests/engine/crawl-root-robots.security.test.ts).
- **Timeouts: guarded.** `send()` in [src/core/http.ts](../src/core/http.ts) times out each attempt, 30 s by default. A run deadline caps retries and waits. Test: [tests/core/fault-injection.test.ts](../tests/core/fault-injection.test.ts).

## Safety

- **SSRF to private addresses: guarded.**
  - Code: `isPrivateIp` and `guardTarget` in [src/core/address-guard.ts](../src/core/address-guard.ts). They also catch a private IPv4 hidden in NAT64 (`64:ff9b::/96`) or IPv4-compatible (`::/96`) form.
  - Test: [tests/lib/private-address.security.test.ts](../tests/lib/private-address.security.test.ts) (such as "private: 64:ff9b::a9fe:a9fe").
- **SSRF through redirects: guarded.** `drive` in [src/core/http.ts](../src/core/http.ts) checks every hop with `guardTarget`. Test: [tests/lib/private-address.security.test.ts](../tests/lib/private-address.security.test.ts) ("a redirect from a public origin to a private address is blocked").
- **DNS rebinding: gap.** The guard looks up the address, then connects in a separate step. Closing it needs a fetch that connects to the address the guard checked.
- **6to4, Teredo, and site-local IPv6: gap.** The guard does not decode the IPv4 inside `2002::/16` or Teredo addresses, and it does not list `fec0::/10`.
- **Sandbox for files: guarded.** `outPath` and `confine` in [src/core/safepath.ts](../src/core/safepath.ts) resolve symlinks. Test: [tests/core/safepath.security.test.ts](../tests/core/safepath.security.test.ts).
- **Sandbox for child processes: guarded.** [src/core/proc.ts](../src/core/proc.ts) passes an argument list with no shell, always sets a timeout, and caps output. Tests: [tests/core/proc.test.ts](../tests/core/proc.test.ts) and [tests/core/proc-child-cap.test.ts](../tests/core/proc-child-cap.test.ts).
- **Secrets across redirects: guarded.** `hop` in [src/core/auth-headers.ts](../src/core/auth-headers.ts) drops auth headers on a cross-host redirect. Test: [tests/core/redirect-auth-headers.security.test.ts](../tests/core/redirect-auth-headers.security.test.ts).
- **Secrets in cache keys: guarded.** [src/lib/fetch-cache.ts](../src/lib/fetch-cache.ts) strips secret query parameters. Test: [tests/lib/fetch-cache-key.security.test.ts](../tests/lib/fetch-cache-key.security.test.ts).
- **Secrets in network error text: gap.** `errMsg` in [src/core/http.ts](../src/core/http.ts) does not pass the URL through `safeUrl`. Routing it through `safeUrl` would close it.
