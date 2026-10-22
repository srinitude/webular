# Engineering research: ranked changes for webular

This page ranks the changes that the engineering reading group supports. The group read papers on effect systems, concurrency, durable workflows, state machines, build and CI, testing, HTTP client robustness, latency, and web-client security.

The full paper ledger is [papers.jsonl](papers.jsonl), topic `engineering`. It has one row per paper.

## What was read

- 1,260 distinct arXiv papers, all from 2025 and 2026.
- 45 were read in full text. The other 1,215 were read at the abstract only.
- Verdicts: 410 apply, 79 already done, 771 not applicable.
- Dates are `YYYY-MM-DD` for 192 rows and `YYYY-MM` (taken from the arXiv id) for 1,068 rows. No day was invented.
- Rows are sorted by arXiv id, highest first. Id order tracks submission order but is not exact.
- Many "apply" verdicts rest on abstracts and a keyword search of the code. Treat them as leads. The 45 full-text rows are the firm ones, and each change below says which papers were read in full.
- One reader claimed [`src/workflows/batch.ts`](../../src/workflows/batch.ts) has resume tokens. A full-text reader checked and found that batch has no checkpoints, so the checkpoint and resume papers do not apply to the code as it stands.

## How to prove each change

Every change names a test that fails on the unchanged code and passes with the change in place. Write that test first, watch it fail, then make the change.

## Ranked changes

1. **A per-host retry budget and circuit breaker.**
   - Files: [`src/core/fetch-policy.ts`](../../src/core/fetch-policy.ts) and [`src/core/http.ts`](../../src/core/http.ts), with the state kept per host. [`src/workflows/batch.ts`](../../src/workflows/batch.ts) shares the budget across a batch.
   - Change: each request retries up to twice with no shared limit, so a failing host sees about three times the load. Cap retries at about 20% of recent requests to a host. Add a per-host adaptive token bucket fed by 429 and `Retry-After`, and a breaker that trips on a rolling failure rate.
   - Papers: 2608.25403 (full text), 2511.23278, 2602.21315, 2604.17111, 2510.04516, 2608.26225.
   - Moves: robustness, cost, and requests per success. One study cut 429s by up to 97% with an adaptive bucket, and another cut retry storms by 98%.
   - Test that fails first: send 50 URLs to a fake host that always answers 503, and assert total attempts are at most 50 x 1.2 plus a small constant. The unchanged code makes about 150.

2. **Content checks on results that look successful.**
   - Files: `src/lib/sources/*.ts` (the JSON fetch path), [`src/workflows/batch.ts`](../../src/workflows/batch.ts) (`scrapeOne`), [`src/workflows/scrape.ts`](../../src/workflows/scrape.ts), and [`src/core/http-body.ts`](../../src/core/http-body.ts).
   - Change: treat a 200 response with an `error` field or a missing expected field as a typed source failure. Treat a 200 with an empty body as `ok:false`. Treat a truncated body as a failure, never as complete. The unchanged code reports each of these as success or as empty hits.
   - Papers: 2610.10062 (full text), 2608.19303 (full text), 2610.25480, 2607.17525, 2608.22676, 2604.03173.
   - Moves: correctness. Agents notice loud errors 91% of the time but quiet wrong values only 59%.
   - Test that fails first: a mock source returns 200 with `{"error":"x"}`, a mock page returns 200 with an empty body, and a third stream ends early. Assert a typed failure for the first, `ok:false` for the second, and a truncation failure for the third.

3. **Benchmark statistics that can support "better than Exa, Firecrawl, Tavily".**
   - Files: [`bench/spec/spec-grading-and-stats.md`](../../bench/spec/spec-grading-and-stats.md) and the [`scripts/bench`](../../scripts/bench) generator that writes the benchmark docs.
   - Change: run each case several times, report a measured noise floor, use paired tests, and print the smallest difference the sample can resolve. Print "not resolvable" when a gap is below it.
   - Papers: 2609.25173 (full text), 2602.07150, 2604.11581, 2609.17394, 2606.13685, 2610.12083, 2607.10198.
   - Moves: the honesty of every rival comparison. A 100-item benchmark resolves only about 18 points, and a true 5-point gap is ranked backwards about 21% of the time.
   - Test that fails first: run the generator with n=100 and a 5-point gap, and assert the output carries an interval and a "not resolvable" flag. The unchanged generator has neither.

4. **Grader integrity and contamination controls.**
   - Files: [`bench/spec/spec-grading-and-stats.md`](../../bench/spec/spec-grading-and-stats.md), [`bench/spec/spec-integrity-and-report.md`](../../bench/spec/spec-integrity-and-report.md), and [`tests/bench`](../../tests/bench).
   - Change: add known-answer controls (an empty answer scores 0, the gold answer scores 1, grading twice gives the same score in any row order). Add a no-tools baseline, block benchmark hosts during runs, and use questions written after the model cutoff. Split the citation metric into link resolves, topic fits, and fact supported.
   - Papers: 2610.16067 (full text), 2607.02577, 2606.05241, 2508.13180, 2605.06635, 2607.20527, 2610.05830.
   - Moves: every benchmark metric. One reward bug moved a reported success rate from 94% to 65%.
   - Test that fails first: grade an empty result for `search.known-item` and assert recall 0 and MRR 0, then grade the gold URL and assert 1.

5. **Mutation checks on the small pure parsers.**
   - Files: [`mise.toml`](../../mise.toml) (a new task) and [`tests/quality`](../../tests/quality), aimed at [`src/core/retry-after.ts`](../../src/core/retry-after.ts), [`src/core/safepath.ts`](../../src/core/safepath.ts), [`src/core/fetch-policy.ts`](../../src/core/fetch-policy.ts), and the freshness code in [`src/core/cache.ts`](../../src/core/cache.ts).
   - Change: add a mutation gate. Start with hand-written mutants so no new dependency is needed. Add one fixture per input dimension that a mutant survives. The repo has no mutation or property-based testing.
   - Papers: 2610.02928 (full text), 2609.24341 (full text), 2609.35841, 2506.02954, 2603.08806.
   - Moves: test strength. Line coverage can be 100% with a mutation score near 4%.
   - Test that fails first: flip the `Retry-After` 10-second cap comparison, drop the 429 retry, and allow off-host redirects. Assert each mutant breaks at least one test. A surviving mutant names a missing fixture.

6. **Cancelling a command must kill its child processes.**
   - File: [`src/core/proc.ts`](../../src/core/proc.ts).
   - Change: on cancel or timeout, kill the whole child tree and fence any later effect from the timed-out call. Do it the same way on macOS, Windows, and Linux.
   - Papers: 2607.14166, 2510.03461, 2610.18831.
   - Moves: resource safety and a leak-free exit.
   - Test that fails first: spawn a child that starts a grandchild, time it out, and assert both are gone. Add a test that cancels each workflow at every await point and checks cleanup ran.

7. **Stale-if-error and single-flight in the cache.**
   - File: [`src/core/cache.ts`](../../src/core/cache.ts).
   - Change: when the origin fails with a 5xx and a stored copy exists, serve the copy and mark it stale. Join identical in-flight GETs into one request. Keep exact-key caching only.
   - Papers: 2607.04281, 2501.16535, 2607.22578, 2605.27494, 2601.23088.
   - Moves: speed, robustness, and cost.
   - Tests that fail first: start ten concurrent fetches of one URL and assert the origin saw one request. Make the origin answer 503 after a stored hit and assert the stale body returns with a stale flag.
   - Left out on purpose: a learned TTL (2609.11515). A full-text reader found the cache already revalidates safely with ETag or Last-Modified, so a learned TTL adds risk.

8. **Host-aware crawl budget.**
   - File: [`src/lib/polite-crawler.ts`](../../src/lib/polite-crawler.ts).
   - Change: sample a few pages per host, then spend the page budget on hosts whose samples score well. Use sitemap `lastmod` as a noisy change signal for refresh.
   - Papers: 2610.13321, 2502.13347, 2602.11874, 2502.02430, 2506.16146.
   - Moves: crawl value per fetched page.
   - Test that fails first: build a seeded fake web with rich and empty hosts. Assert that at the same page cap the crawl returns more useful pages than the uniform crawl.

9. **Hedged requests across search providers.**
   - Files: [`src/lib/search-chain.ts`](../../src/lib/search-chain.ts) and [`src/core/http.ts`](../../src/core/http.ts).
   - Change: if the first provider has not answered by its recent p95 latency, start a second one and take the first good reply. Rank providers by quality per unit of latency.
   - Papers: 2607.19215, 2605.14241, 2607.10198, 2510.16276.
   - Moves: tail latency. Web latency was up to 53.7% of end-to-end time in one study.
   - Test that fails first: make the first fake provider answer after 2 s and the second after 100 ms. Assert the total time is under 500 ms and the slow request was cancelled.

10. **Record and replay at the machine boundaries.**
    - Files: [`src/machines/agent.ts`](../../src/machines/agent.ts) (`AgentAnswers`) and [`tests/machines`](../../tests/machines).
    - Change: serve the k-th crossing of a boundary its k-th recorded answer, and raise when the call counts differ. Feed recorded real traces through the XState machines in CI.
    - Papers: 2609.20625 (full text), 2607.16200, 2601.11836, 2605.26521, 2604.05289.
    - Moves: determinism, and agreement between code and machine.
    - Test that fails first: replay a recording with one extra decision call and assert replay raises. The full-text reader rated this the weakest of its five and did not confirm the gap, so read the code first.

11. **Monitor snapshots must not depend on delivery order.**
    - Files: [`src/workflows/monitor.ts`](../../src/workflows/monitor.ts) and [`src/lib/snapshot.ts`](../../src/lib/snapshot.ts) (`compareAndStore`).
    - Change: make the final snapshot and diff equal a batch recompute under repeated and reordered pages.
    - Papers: 2610.02363 (full text).
    - Moves: monitor correctness.
    - Test that fails first: store pages A, B, A and then A, A, B. Assert the same final snapshot and no false "changed" on a repeat of A. The test has not been run, so it may already pass.

12. **CI fixes.**
    - Files: `.github/workflows/ci.yml`, `.github/workflows/release.yml`, and [`mise.toml`](../../mise.toml).
    - Change, in four parts:
      - retry network and install steps at most twice, and report them as flaky rather than failed;
      - scan tasks for swallowed exit codes (pipes without `pipefail`, `|| true`);
      - check that the release SBOM matches [`bun.lock`](../../bun.lock);
      - build the binary twice and compare hashes, setting `SOURCE_DATE_EPOCH`.
    - Papers: 2602.02307, 2509.14347, 2511.20313, 2609.19920, 2501.15919, 2604.17890.
    - Moves: CI reliability and release trust.
    - Tests that fail first: a `mise` task that greps every task for `|| true` and an unguarded pipe, and one that diffs two builds. Both fail until fixed or allow-listed.
    - Already in place, so not changed: SHA-pinned actions, a default of no permissions, job timeouts, `--frozen-lockfile`, a six-variant OS matrix, an attested SBOM, npm provenance, and a seven-day dependabot cooldown.

13. **Test order and shared state.**
    - Files: [`mise.toml`](../../mise.toml) (`test`) and [`bunfig.toml`](../../bunfig.toml).
    - Change: add a random-order test pass with a printed seed, if the pinned Bun supports it. Reset mock state between tests.
    - Papers: 2501.12680, 2509.00466, 2510.26171.
    - Moves: flaky-test detection.
    - Test that fails first: add a seeded shuffled run in CI. Any order-dependent test fails there and prints the seed that reproduces it.

14. **Extraction quality by page type.**
    - Files: [`src/workflows/scrape.ts`](../../src/workflows/scrape.ts) and [`bench/tasks`](../../bench/tasks).
    - Change: score extraction by page type (article, forum, product, listing, table, code), not by one article score.
    - Papers: 2605.21097, 2511.16397, 2602.19548, 2604.08538.
    - Moves: scrape and extract quality. Extractors score F1 0.93 on articles but 0.41 to 0.84 on forums, products, and listings.
    - Test that fails first: add forum and listing fixtures with a known gold text. Assert a per-type score is reported and that the weak type is named.

## Web-client security

Another owner covers DNS rebinding, 6to4 and Teredo IPv6 tunnels, and secrets in network error text, so those are not repeated here. Papers on them (2609.09345, 2609.23042, 2606.04141) are in the ledger as not applicable or already done.

The remaining security changes, ranked:

15. **Treat non-rendered HTML as untrusted and cover class-hidden text.**
    - Files: [`src/lib/html-sanitize.ts`](../../src/lib/html-sanitize.ts), [`src/core/decode.ts`](../../src/core/decode.ts), and [`src/workflows/extract.ts`](../../src/workflows/extract.ts).
    - Change: strip or label `meta`, `aria-label`, `alt`, `title`, and response headers as untrusted channels before anything reaches a model. Handle text hidden by stylesheet classes, which a code note in `html-sanitize.ts` already names as a gap.
    - Papers: 2604.27202, 2509.00124, 2509.05831, 2508.17884, 2610.17457, 2605.11868.
    - Moves: prompt-injection resistance. About 70% of injections in the wild sit in non-rendered HTML.
    - Test that fails first: use the paired clean and attacked pages from those papers as a sanitizer corpus in `bench`. Assert the injected text never reaches the output.

16. **Label third-party regions and source origin in output.**
    - Files: [`src/lib/html-sanitize.ts`](../../src/lib/html-sanitize.ts) and [`src/workflows/scrape.ts`](../../src/workflows/scrape.ts).
    - Change: mark iframe, ad, and user-generated regions, and add a source-origin label to each block of markdown or JSON, so a downstream agent can drop third-party spans.
    - Papers: 2607.05277, 2607.08147, 2610.22697, 2610.24277.
    - Test that fails first: a page with an ad iframe should yield output whose blocks carry origin labels. The unchanged output carries none.

17. **Parse a URL once and fetch exactly what the guard checked.**
    - File: [`src/core/url.ts`](../../src/core/url.ts), used by [`src/core/address-guard.ts`](../../src/core/address-guard.ts) and [`src/core/http.ts`](../../src/core/http.ts).
    - Change: guard and fetch must use the same parsed `href`. Add host-level lexical checks for homoglyphs, `user@host` spoofing, and subdomain spoofing.
    - Papers: 2608.06508, 2510.09952, 2503.10846, 2601.18113.
    - Test that fails first: feed a URL pair that two parsers read differently. Assert the guard and the fetch see the same host.

18. **Invisible Unicode and auto-loading Markdown images.**
    - Files: [`src/lib/html-sanitize.ts`](../../src/lib/html-sanitize.ts) and the Markdown output path.
    - Change: confirm the Unicode tag block (U+E0000), zero-width joiners, and bidi controls are stripped. Do not emit auto-loading image URLs or reference-style links from untrusted pages without marking them.
    - Papers: 2603.00164, 2509.10540.
    - Test that fails first: a page with tag-block characters and a reference-style image link. Assert the characters are gone and the image URL is marked.

## Not changed, and why

- Idempotency keys and verify-before-retry (2609.29095, 2610.05622): webular's fetch path only sends GET, so retry is safe. `act` has no write verbs. Revisit if it gains them.
- Checkpoint and resume (2608.03836, 2608.29381): batch has no checkpoints.
- Learned cache TTL (2609.11515): the cache already revalidates when the server sends no max-age.
- Dependabot cooldown (2609.16605): already set to seven days.
- OS matrix and path checks (2609.25531): the matrix covers three operating systems, and `safepath.ts` rejects escaping paths.
- OpenAlex rate limits (2609.00392): `OpenAlexLimit` in [`src/lib/scholarly.ts`](../../src/lib/scholarly.ts) already skips a host after a 429.
