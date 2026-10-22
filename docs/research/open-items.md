# Open research items

Each ranked change that is not in the code has a next step here. An "applied" line marks a change from this list that is in the code, and names the file and line that hold it. A "partly" item has some of the change in the code; the line says what is missing. The totals and the method are in [research.md](../research.md). Each `#N` is that change's number in its topic list.

## Retrieval

The list is [retrieval-changes.md](retrieval-changes.md).

- #1: add a query-class half-life and a date-window gate ([`src/lib/sources/rank.ts`](../../src/lib/sources/rank.ts) uses one fixed 365-day half-life).
- #2, partly: tune the RRF k and class weights on a dev split (`src/lib/search.ts:102`, `src/lib/local-index.ts:135`).
- #3, partly: add clue splitting and "A vs B" detection beside the hop gate (`src/lib/search-hop.ts:99`).
- #4: add a rerank skip gate on score margin and overlap in [`src/lib/search-chain.ts`](../../src/lib/search-chain.ts).
- #5: score the top 16 hits in one Jev choice. This needs a decision-models-first receipt.
- #6, partly: add the query-to-question rewrite to the heading-tree chunks (`src/lib/local-chunks.ts:47`).
- #7, partly: add domain tiers, min(trust, freshness), and an intent-by-source-type table (`src/lib/sources/catalog.ts:44`).
- #8: check each hit with HEAD and fall back to GET; a 404 is dead, a 403 is ignored.
- #9: open the top page for fresh-class queries in [`src/lib/search-chain.ts`](../../src/lib/search-chain.ts).
- #10, partly: merge near copies only when results crowd, and drop repeated paragraphs in [`src/lib/fingerprints.ts`](../../src/lib/fingerprints.ts).
- #11: add the exact-match shortcut and the P856 fallback in [`src/lib/sources/official-sites.ts`](../../src/lib/sources/official-sites.ts).
- #12, partly: add quoted, how-to, comparison, definition, and date intents, and the top-two union (`src/lib/jev/decisions/search-intent.ts:19`).
- #14: add a benchmark-host blocklist and a no-search baseline to [`scripts/bench`](../../scripts/bench).

## Extraction

The list is [extraction-changes.md](extraction-changes.md).

- #3: add a Chao1 coverage estimate to [`src/workflows/map.ts`](../../src/workflows/map.ts) and [`src/lib/crawl-resume.ts`](../../src/lib/crawl-resume.ts).
- #4, partly: add an anchor-text and DOM drift check to [`src/lib/crawl.ts`](../../src/lib/crawl.ts).
- #7, partly: join two extractors instead of picking the fuller one ([`src/lib/html.ts`](../../src/lib/html.ts)).
- #8, applied: each `math` element becomes its alt text, TeX source, or plain text before the sanitizer drops it (`src/lib/html-sanitize.ts:78`).
- #9, applied: alt text stops at 300 characters, and the image list skips hidden images (`src/lib/html-images.ts:30` and `:38`).
- #10, partly: stacked header rows join into one header-path row, such as "Price / 2024" (`src/lib/html-table.ts:54`). Still missing: "header: value" output for table rows in [`src/lib/html-table.ts`](../../src/lib/html-table.ts).
- #11: reuse a page's XHR or JSON endpoint in [`src/lib/driver.ts`](../../src/lib/driver.ts).
- #12, partly: merge small chunks and chunk table rows with their header ([`src/lib/local-chunks.ts`](../../src/lib/local-chunks.ts)).
- #13, partly: finish the locator ladder (text, repeated sibling, per-host cache) in [`src/lib/select.ts`](../../src/lib/select.ts).
- #14, applied: the archive fallback keeps only HTML captures that returned status 200, each one once (`src/lib/archive-urls.ts:14`).

## Answer quality

The list is [answer-quality-changes.md](answer-quality-changes.md).

- #1, partly: the grader reads scientific notation, superscripts, and digits from any script, such as "４２" (`scripts/bench/grade-text.ts:19`). Still missing: count a hedge as not attempted, and grade strict, then lenient ([`scripts/bench/grade.ts`](../../scripts/bench/grade.ts)).
- #2: add a sufficiency and abstain gate to [`src/workflows/answer.ts`](../../src/workflows/answer.ts). This needs a decision-models-first receipt. An abstain line must not count as an unbacked claim in [`tests/_support/citation-score.ts`](../../tests/_support/citation-score.ts).
- #3: sweep the lead weight and `LAMBDA` in `summarize-rank.ts`.
- #4, partly: a guard checks that each summary sentence is a verbatim substring at its offsets (`tests/commands/summarize-accuracy.test.ts:108`). Still missing: multi-reference scoring ([`scripts/bench/scoreboard-rows.ts`](../../scripts/bench/scoreboard-rows.ts)).
- #5, partly: the resolution ratio and the smallest detectable gap are in `scripts/bench/stats.ts:129` and `:133`, and the verdict gate uses the ratio. Still missing: show both in each report row, and add a repeated-split bootstrap for a tuned configuration.
- #6: add a benchmark-host blocklist to [`scripts/bench/run.ts`](../../scripts/bench/run.ts).
- #7: add a planted-text probe and a URL resolve check to the citation decision.
- #8, applied: the judge's calibration reports its flip rate on swapped answer order, and a judge that changes 2% or more of its labels is refused (`scripts/bench/judge.ts:28` and `:62`).
- #9: add a penalty-aware score and canaries to [`scripts/bench`](../../scripts/bench).
- #10, partly: restate the question, check completeness, and cross-check sources in [`src/workflows/answer.ts`](../../src/workflows/answer.ts).

## Decision models

The list is [decision-models-changes.md](decision-models-changes.md). Each item changes a Jev payload or metric, so each one needs a decision-models-first receipt before work starts.

- #1: ask `crop-box` in both orders.
- #2: add a rotated third order to `bothOrders` in [`src/lib/jev/payload/menu.ts`](../../src/lib/jev/payload/menu.ts).
- #3: track flip rate and skew in [`src/lib/jev/learn`](../../src/lib/jev/learn).
- #4: add an empty-menu probe.
- #5: add a none-recall metric.
- #6: add tile, zoom, and mark steps to `crop-box`.
- #7: trim near-duplicate hits before `answer-evidence` sends up to 18.
- #8: cut by meaning, not `slice(0, n)`, in [`src/lib/jev/payload/canonical.ts`](../../src/lib/jev/payload/canonical.ts).
- #9: add `not_for` to `search-intent` and `image-router`.
- #10: add a level-count lint to [`src/lib/jev/learn`](../../src/lib/jev/learn).
- #11: add an effective-vote count to [`src/lib/jev/learn`](../../src/lib/jev/learn).
- #12: add a fixed delimiter and a balanced-example rule to [`src/lib/jev/payload`](../../src/lib/jev/payload).
- #13: add a scoring-method field to [`src/lib/jev/store.ts`](../../src/lib/jev/store.ts).

## Agents

The list is [agents-changes.md](agents-changes.md). Items marked "see the list" were not read closely; their next step is the change as the list writes it.

- #1: add Tool-Skip labels.
- #3, #4, #5, #6, #11, #12: see the list.
- #7: add a zero-call retry.
- #8: add a sufficiency stop.
- #9, #10, #13: ground `act` steps as the list says.
- AGENTS.md #1, partly: make each rule a prohibition or pair it with a check.
- AGENTS.md #3, partly: add a contradiction check across each nested chain ([`tests/quality/agents-md.test.ts`](../../tests/quality/agents-md.test.ts)).
- AGENTS.md #4, partly: add one check per Never or Ask-first line.
- AGENTS.md #5, partly: add a smell list.

The root AGENTS.md sits at 12,282 of 12,288 bytes, so each addition must cut as much.

## Engineering

The list is [engineering-changes.md](engineering-changes.md).

- #1: add a per-host retry budget and a breaker beside `retryPause`.
- #2, #4, #8, #10, #11, #14, #15, #16, #17: see the list.
- #3: flag a case as not resolvable in the bench spec.
- #5: add a mutation gate.
- #6, partly: a grandchild dies on timeout and on cancel (`tests/core/proc-process-group.test.ts:42` and `:59`). Still missing: a test that cancels each workflow at every await point and checks that cleanup ran.
- #7: add stale-if-error and single-flight to the fetch cache.
- #9: hedge slow sources in `search-chain.ts`.
- #12, partly: add flaky-retry limits and a double-build hash check to `release.yml`.
- #18, applied: each Markdown image becomes a plain link whose text starts with `image:`, which loads nothing until someone opens it (`src/lib/html-images.ts:91`). Invisible characters are stripped in `src/lib/html-sanitize.ts:24`.

## Dependencies: top 10

The dependency research is not published in this folder, so each line here names the change in full.

- #1: add `overrides` and upgrade the MCP `server` and `node` packages.
- #2: set `maxRequestBodySize` and `maxToolInputElements` in [`plugins/webular/src`](../../plugins/webular/src).
- #3: raise `min_version` in [`mise.toml`](../../mise.toml) to `2026.10.0` once every machine that runs the tasks has that mise release or later; a higher `min_version` than the installed binary stops every `mise run`.
- #4: run PDF conversion in a child process or worker.
- #5, applied: a SIGTERM during startup still exits 143 (`tests/cli/dispatch.test.ts:142`).
- #6: bump `effect` with `@effect/platform-bun`.
- #7: drop the `@effect/language-service` plugin entry from `tsconfig.json:25`.
- #9: take `@mastra/mcp` `2.5.0` with `@mastra/core` `1.79.0`, and add a test that fails if the private `createServerInstance` cast in [`plugins/webular/src/server.ts`](../../plugins/webular/src/server.ts) disappears.
- #10: test dropping `agent-browser` from `trustedDependencies`.

## Dependencies: all rows

Each row's next step is its `change` field in the dependency research, which this folder does not publish. The row numbers, grouped by package:

- `effect` and `@effect/platform-bun`: #1, #2, #3, #4, #5.
- `@effect/language-service`: #7.
- `@mastra/core` and `@mastra/mcp`: #9, #10, #13, #14, #15.
- `@statelyai/agent` and `xstate`: #18, #19, #21, #23; #22 partly (a sync test for `_nodes`).
- `zod`: #30, #31; #29 partly (`.max(64)` in `web-register.ts`).
- `@modelcontextprotocol/*`: #32, #33, #34, #35, #36, #38, #39, #40.
- `@firecrawl/anydoc`: #41, #42, #43, #44.
- `@mozilla/readability`: #46 (try a lower `charThreshold`).
- `linkedom`: #48, #49, #50, #51.
- `mammoth`: #52. Row #53 is applied: `WEBULAR_DOCX_TIMEOUT_MS` bounds `convertToHtml` (`src/lib/parse.ts:74`).
- `turndown`: #55. Row #56 is applied: a `<br>` inside `<pre>` stays a line break (`src/lib/html-sanitize.ts:84`).
- `unpdf`: #59.
- `@types/bun`, `@biomejs/biome`, `knip`: #64, #65, #67.
- `deepsec`: #68.
- `mise` and `mise-action`: #69, #75.
- `agent-browser`: #70, #71.
- `bun`: #72, #73, #74.
- Jev requests: #77.
