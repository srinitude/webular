# Open research items

Each ranked change from the research lists has one line here, and each line carries one of three statuses right after its id. `landed in <sha>` means the change is in the code at that commit, and the line names the file and line that hold it. `closed (<reason>)` means the change leaves this list; the reason is `duplicate`, `superseded`, `measured no gain`, or `out of scope`, and the line says why. `waiting:` means the change is not done, and the line says what it still needs.

The totals and the method are in [research.md](../research.md). Each `#N` is that change's number in its topic list.

## Retrieval

The list is [retrieval-changes.md](retrieval-changes.md).

- #1, waiting: built at 2ac0c187; its keep round waits on load under 40. In the code: the free-source rank picks its half-life from the query: 30 days for a fresh query, 3,650 for a history query, and 365 for the rest (`src/lib/sources/rank.ts:11`). A dated hit outside a named year window, such as "in 2024", scores zero (`src/lib/sources/rank.ts:19`). The build adds month and relative windows and a lower score for doubtful dates. Still missing after it: "supersedes" or "deprecated" cues.
- #2, waiting: tune the RRF k and class weights on a dev split (`src/lib/search.ts:102`, `src/lib/local-index.ts:135`).
- #3, waiting: clue splitting beside the hop gate. In the code: "A vs B" questions search each entity at once (`src/lib/search-hop.ts:126`).
- #4, waiting: built at 2ae00508; its keep round waits on load under 40. The build adds a rerank skip gate on score margin and overlap in [`src/lib/search-chain.ts`](../../src/lib/search-chain.ts).
- #5, waiting: needs its own decision-models-first receipt before any Jev change. The change scores the top 16 hits in one Jev choice.
- #6, closed (out of scope): owned by task 11, which owns the local index. The change adds the query-to-question rewrite to the heading-tree chunks (`src/lib/local-chunks.ts:66`).
- #7, waiting: add domain tiers, min(trust, freshness), and an intent-by-source-type table (`src/lib/sources/catalog.ts:44`).
- #8, waiting: check each hit with HEAD and fall back to GET; a 404 is dead, a 403 is ignored.
- #9, waiting: open the top page for fresh-class queries in [`src/lib/search-chain.ts`](../../src/lib/search-chain.ts).
- #10, waiting: merge near copies only when results crowd, and drop repeated paragraphs in [`src/lib/fingerprints.ts`](../../src/lib/fingerprints.ts).
- #11, waiting: the exact-label shortcut, and the Jev gate for the hard tail, which needs its own decision-models-first receipt before any Jev change. In the code: an item with no official website (P856) falls back to its official blog (P1581) in the same call (`src/lib/sources/official-sites.ts:37`). Two articles about one item give one hit (`:57`). A claim word inside a domain name, such as "official-merch.com", does not make a query navigational (`:20`).
- #12, waiting: needs its own decision-models-first receipt before any Jev change. The change adds quoted, how-to, comparison, definition, and date intents, and the top-two union (`src/lib/jev/decisions/search-intent.ts:19`).
- #14, closed (out of scope): owned by task 52, which owns [`scripts/bench`](../../scripts/bench). The change adds a benchmark-host blocklist and a no-search baseline there.

## Extraction

The list is [extraction-changes.md](extraction-changes.md).

- #3, closed (out of scope): owned by task 11, which owns the crawl code. The change adds a Chao1 coverage estimate to [`src/workflows/map.ts`](../../src/workflows/map.ts) and [`src/lib/crawl-resume.ts`](../../src/lib/crawl-resume.ts).
- #4, closed (out of scope): owned by task 11, which owns the crawl code. The change adds an anchor-text and DOM drift check to [`src/lib/crawl.ts`](../../src/lib/crawl.ts).
- #7, waiting: join two extractors instead of picking the fuller one ([`src/lib/html.ts`](../../src/lib/html.ts)).
- #8, landed in 365d7f75: each `math` element becomes its alt text, TeX source, or plain text before the sanitizer drops it (`src/lib/html-sanitize.ts:78`).
- #9, landed in 365d7f75: alt text stops at 300 characters, and the image list skips hidden images (`src/lib/html-images.ts:30` and `:38`).
- #10, waiting: built at 23433d16; its keep round waits on load under 40. In the code: stacked header rows join into one header-path row, such as "Price / 2024" (`src/lib/html-table.ts:54`). The build adds "Header: value" output for table rows in [`src/lib/html-table.ts`](../../src/lib/html-table.ts).
- #11, waiting: reuse a page's XHR or JSON endpoint in [`src/lib/driver.ts`](../../src/lib/driver.ts).
- #12, closed (out of scope): owned by task 11, which owns the local index. The remainder is to chunk table rows with their header in [`src/lib/local-chunks.ts`](../../src/lib/local-chunks.ts). In the code: a chunk under 8 words joins the chunk after it, so a snippet is never a lone stub (`src/lib/local-chunks.ts:44`).
- #13, waiting: finish the locator ladder (text, repeated sibling, per-host cache) in [`src/lib/select.ts`](../../src/lib/select.ts).
- #14, landed in 365d7f75: the archive fallback keeps only HTML captures that returned status 200, each one once (`src/lib/archive-urls.ts:14`).

## Answer quality

The list is [answer-quality-changes.md](answer-quality-changes.md).

- #1, closed (out of scope): owned by task 52, which owns [`scripts/bench`](../../scripts/bench). The remainder is to count a hedge as not attempted, and grade strict, then lenient ([`scripts/bench/grade.ts`](../../scripts/bench/grade.ts)). In the code: the grader reads scientific notation, superscripts, and digits from any script, such as "４２" (`scripts/bench/grade-text.ts:19`).
- #2, waiting: needs its own decision-models-first receipt before any Jev change. The change adds a sufficiency and abstain gate to [`src/workflows/answer.ts`](../../src/workflows/answer.ts). An abstain line must not count as an unbacked claim in [`tests/_support/citation-score.ts`](../../tests/_support/citation-score.ts).
- #3, waiting: a sweep of the lead weight and `LAMBDA` in `summarize-rank.ts`.
- #4, closed (out of scope): owned by task 52, which owns [`scripts/bench`](../../scripts/bench). The remainder is multi-reference scoring ([`scripts/bench/scoreboard-rows.ts`](../../scripts/bench/scoreboard-rows.ts)). In the code: a guard checks that each summary sentence is a verbatim substring at its offsets (`tests/commands/summarize-accuracy.test.ts:108`).
- #5, closed (out of scope): owned by task 52, which owns [`scripts/bench`](../../scripts/bench). The remainder is to show the resolution ratio and the smallest detectable gap in each report row, and to add a repeated-split bootstrap for a tuned configuration. In the code: both numbers are in `scripts/bench/stats.ts:129` and `:133`, and the verdict gate uses the ratio.
- #6, closed (duplicate): the same benchmark-host blocklist as retrieval #14, here in [`scripts/bench/run.ts`](../../scripts/bench/run.ts).
- #7, waiting: needs its own decision-models-first receipt before any Jev change. The change adds a planted-text probe and a URL resolve check to the citation decision.
- #8, landed in eb0a5a52: the judge's calibration reports its flip rate on swapped answer order, and a judge that changes 2% or more of its labels is refused (`scripts/bench/judge.ts:28` and `:62`).
- #9, closed (out of scope): owned by task 52, which owns [`scripts/bench`](../../scripts/bench). The change adds a penalty-aware score and canaries there.
- #10, waiting: restate the question, check completeness, and cross-check sources in [`src/workflows/answer.ts`](../../src/workflows/answer.ts).

## Decision models

The list is [decision-models-changes.md](decision-models-changes.md). Each item changes a Jev payload or metric, so each one needs its own decision-models-first receipt before any Jev change.

- #1, waiting: needs its own decision-models-first receipt before any Jev change. The change asks `crop-box` in both orders.
- #2, waiting: needs its own decision-models-first receipt before any Jev change. The change adds a rotated third order to `bothOrders` in [`src/lib/jev/payload/menu.ts`](../../src/lib/jev/payload/menu.ts).
- #3, waiting: needs its own decision-models-first receipt before any Jev change. The change tracks flip rate and skew in [`src/lib/jev/learn`](../../src/lib/jev/learn).
- #4, waiting: needs its own decision-models-first receipt before any Jev change. The change adds an empty-menu probe.
- #5, waiting: needs its own decision-models-first receipt before any Jev change. The change adds a none-recall metric.
- #6, waiting: needs its own decision-models-first receipt before any Jev change. The change adds tile, zoom, and mark steps to `crop-box`.
- #7, waiting: needs its own decision-models-first receipt before any Jev change. The change trims near-duplicate hits before `answer-evidence` sends up to 18.
- #8, waiting: needs its own decision-models-first receipt before any Jev change. The change cuts by meaning, not `slice(0, n)`, in [`src/lib/jev/payload/canonical.ts`](../../src/lib/jev/payload/canonical.ts).
- #9, waiting: needs its own decision-models-first receipt before any Jev change. The change adds `not_for` to `search-intent` and `image-router`.
- #10, waiting: needs its own decision-models-first receipt before any Jev change. The change adds a level-count lint to [`src/lib/jev/learn`](../../src/lib/jev/learn).
- #11, waiting: needs its own decision-models-first receipt before any Jev change. The change adds an effective-vote count to [`src/lib/jev/learn`](../../src/lib/jev/learn).
- #12, waiting: needs its own decision-models-first receipt before any Jev change. The change adds a fixed delimiter and a balanced-example rule to [`src/lib/jev/payload`](../../src/lib/jev/payload).
- #13, waiting: needs its own decision-models-first receipt before any Jev change. The change adds a scoring-method field to [`src/lib/jev/store.ts`](../../src/lib/jev/store.ts).

## Agents

The list is [agents-changes.md](agents-changes.md). Items marked "see the list" were not read closely; their next step is the change as the list writes it.

- #1, waiting: add Tool-Skip labels.
- #3, #4, #5, #6, #11, #12, waiting: each change as the list writes it; see the list.
- #7, waiting: add a zero-call retry.
- #8, waiting: add a sufficiency stop.
- #9, #10, #13, waiting: ground `act` steps as the list says.
- AGENTS.md #1, waiting: make each remaining rule a prohibition or pair it with a check.
- AGENTS.md #3, waiting: add a contradiction check across each nested chain ([`tests/quality/agents-md.test.ts`](../../tests/quality/agents-md.test.ts)).
- AGENTS.md #4, waiting: add one check per remaining Never or Ask-first line.
- AGENTS.md #5, waiting: add a smell list.

The root AGENTS.md sits at 12,282 of 12,288 bytes, so each addition must cut as much.

## Engineering

The list is [engineering-changes.md](engineering-changes.md).

- #1, waiting: built at 0782a088; its keep round waits on load under 40. The build adds a per-host retry budget and a breaker beside `retryPause`.
- #2, #4, #8, #10, #11, #14, #15, #16, #17, waiting: each change as the list writes it; see the list.
- #3, closed (out of scope): owned by task 52, which owns the bench spec in [`scripts/bench`](../../scripts/bench). The change flags a case as not resolvable there.
- #5, waiting: add a mutation gate.
- #6, waiting: a test that cancels each workflow at every await point and checks that cleanup ran. In the code: a grandchild dies on timeout and on cancel (`tests/core/proc-process-group.test.ts:42` and `:59`).
- #7, landed in b350fde9: when a site fails with a 5xx after the last retry, the stored copy comes back marked stale (`src/lib/fetch-http.ts:115`). Calls for one URL at the same time share one request (`src/lib/fetch-layer.ts:59`).
- #9, waiting: hedge slow sources in `search-chain.ts`.
- #12, waiting: add flaky-retry limits and a double-build hash check to `release.yml`.
- #18, landed in 7c2511f5: each Markdown image becomes a plain link whose text starts with `image:`, which loads nothing until someone opens it (`src/lib/html-images.ts:91`). Invisible characters are stripped in `src/lib/html-sanitize.ts:24`.

## Dependencies: top 10

The dependency research is not published in this folder, so each line here names the change in full.

- #1, waiting: add `overrides` and upgrade the MCP `server` and `node` packages.
- #2, waiting: set `maxRequestBodySize` and `maxToolInputElements` in [`plugins/webular/src`](../../plugins/webular/src).
- #3, waiting: every machine that runs the tasks needs mise `2026.10.0` or a higher release; then raise `min_version` in [`mise.toml`](../../mise.toml) to `2026.10.0`. A higher `min_version` than the installed binary stops every `mise run`.
- #4, waiting: run PDF conversion in a child process or worker.
- #5, landed in 68a73633: a SIGTERM during startup still exits 143 (`tests/cli/dispatch.test.ts:142`).
- #6, waiting: bump `effect` with `@effect/platform-bun`.
- #7, waiting: drop the `@effect/language-service` plugin entry from `tsconfig.json:25`.
- #9, waiting: take `@mastra/mcp` `2.5.0` with `@mastra/core` `1.79.0`, and add a test that fails if the private `createServerInstance` cast in [`plugins/webular/src/server.ts`](../../plugins/webular/src/server.ts) disappears.
- #10, waiting: test dropping `agent-browser` from `trustedDependencies`.

## Dependencies: all rows

Each row's next step is its `change` field in the dependency research, which this folder does not publish. The row numbers, grouped by package:

- `effect` and `@effect/platform-bun` #1, #2, #3, #4, #5, waiting: each row's `change` field.
- `@effect/language-service` #7, closed (duplicate): the same change as top 10 #7.
- `@mastra/core` and `@mastra/mcp` #9, #10, #13, #14, #15, waiting: each row's `change` field.
- `@statelyai/agent` and `xstate` #18, #19, #21, #23, waiting: each row's `change` field.
- `@statelyai/agent` and `xstate` #22, waiting: a sync test for `_nodes`.
- `zod` #30, #31, waiting: each row's `change` field.
- `zod` #29, waiting: the rest of its `change` field beyond `.max(64)` in `web-register.ts`.
- `@modelcontextprotocol/*` #32, #33, #34, #35, #36, #38, #39, #40, waiting: each row's `change` field.
- `@firecrawl/anydoc` #41, #42, #43, #44, waiting: each row's `change` field.
- `@mozilla/readability` #46, waiting: try a lower `charThreshold`.
- `linkedom` #48, #49, #50, #51, waiting: each row's `change` field.
- `mammoth` #52, waiting: its `change` field.
- `mammoth` #53, landed in 6eb2974b: `WEBULAR_DOCX_TIMEOUT_MS` bounds `convertToHtml` (`src/lib/parse.ts:74`).
- `turndown` #55, waiting: its `change` field.
- `turndown` #56, landed in 365d7f75: a `<br>` inside `<pre>` stays a line break (`src/lib/html-sanitize.ts:84`).
- `unpdf` #59, waiting: its `change` field.
- `@types/bun`, `@biomejs/biome`, `knip` #64, #65, #67, waiting: each row's `change` field.
- `deepsec` #68, waiting: its `change` field.
- `mise` and `mise-action` #69, #75, waiting: each row's `change` field.
- `agent-browser` #70, #71, waiting: each row's `change` field.
- `bun` #72, #73, #74, waiting: each row's `change` field.
- Jev requests #77, waiting: needs its own decision-models-first receipt before any Jev change.
