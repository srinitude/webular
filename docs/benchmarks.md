# Benchmarks

This page shows how webular scores against other web research tools on the same tasks, and it shows losses as plainly as wins.
Every number on this page comes from one committed results file, and each one links to that file.
Read it as one small run, not as a final ranking.
On webular's side, every score comes from its own open-source parts and Jev, TypeSafe's decision model, with no paid web API. [The README](../README.md) lists what webular is built on.

## Source files

<!-- bench:start run -->
All numbers come from one committed peer run, with 3 runs per task (sha256 `b529ddc7af62`):

- [peers-2026-10-22T00-58-50-543Z.json](../bench/results/peers-2026-10-22T00-58-50-543Z.json): one row per tool, task, and run, with its status and accuracy.
- [peers-2026-10-22T00-58-50-543Z.txt](../bench/results/peers-2026-10-22T00-58-50-543Z.txt): the harness's text report for the same run.
<!-- bench:end -->

The results file holds no confidence intervals, no paired tests, and no p values.
So this page gives none, and it calls no win or loss as proven.
`mise run bench:docs` writes every number on this page from the results file. A test fails when a number here differs from that file.

## Short answer

<!-- bench:start short -->
- **answer:** webular scores 0.714 on 7 tasks; exa scores 1.000 on 7 tasks. Source: [peers-2026-10-22T00-58-50-543Z.json](../bench/results/peers-2026-10-22T00-58-50-543Z.json).
- **scrape:** webular scores 1.000 on 6 tasks; exa scores 1.000 on 3 tasks; firecrawl scores 0.667 on 3 tasks; readability scores 0.333 on 3 tasks. Source: [peers-2026-10-22T00-58-50-543Z.json](../bench/results/peers-2026-10-22T00-58-50-543Z.json).
- **search:** webular scores 1.000 on 4 tasks; exa scores 1.000 on 4 tasks; firecrawl scores 1.000 on 4 tasks. Source: [peers-2026-10-22T00-58-50-543Z.json](../bench/results/peers-2026-10-22T00-58-50-543Z.json).
- **Where webular leads:** it runs offline, needs 0 keys, and costs 0 USD per call. Source: [the text report](../bench/results/peers-2026-10-22T00-58-50-543Z.txt).
<!-- bench:end -->

## What ran

<!-- bench:start ran -->
The run has 17 tasks: 4 search, 6 scrape, 7 answer.
Source: [peers-2026-10-22T00-58-50-543Z.json](../bench/results/peers-2026-10-22T00-58-50-543Z.json).
<!-- bench:end -->

Rows per tool, from the results file:

<!-- bench:start status -->
| tool | ok | error | unsupported | skipped | unrecorded |
| --- | --- | --- | --- | --- | --- |
| webular | 51 | 0 | 0 | 0 | 0 |
| perplexity | 0 | 0 | 30 | 0 | 21 |
| searxng | 0 | 0 | 0 | 51 | 0 |
| trafilatura | 0 | 0 | 0 | 51 | 0 |
| tavily | 0 | 0 | 18 | 0 | 33 |
| spider | 0 | 0 | 0 | 51 | 0 |
| parallel | 0 | 0 | 18 | 0 | 33 |
| contextdev | 0 | 0 | 0 | 51 | 0 |
| linkup | 0 | 0 | 0 | 51 | 0 |
| jina | 0 | 0 | 30 | 0 | 21 |
| zyte | 0 | 0 | 0 | 51 | 0 |
| readability | 9 | 0 | 33 | 0 | 9 |
| scrapegraph | 0 | 0 | 0 | 102 | 0 |
| exa | 20 | 0 | 9 | 22 | 0 |
| serper | 0 | 0 | 0 | 51 | 0 |
| browserbase | 0 | 0 | 30 | 0 | 21 |
| valyu | 0 | 0 | 0 | 51 | 0 |
| brave | 0 | 0 | 0 | 51 | 0 |
| nimble | 0 | 0 | 0 | 51 | 0 |
| gemini | 0 | 0 | 30 | 0 | 21 |
| apify | 0 | 0 | 0 | 51 | 0 |
| curl-html2text | 0 | 0 | 0 | 51 | 0 |
| serpapi | 0 | 0 | 0 | 51 | 0 |
| brightdata | 0 | 0 | 0 | 51 | 0 |
| tinyfish | 0 | 0 | 0 | 51 | 0 |
| openai-web-search | 0 | 0 | 0 | 51 | 0 |
| youcom | 0 | 0 | 39 | 0 | 12 |
| vertex-grounding | 0 | 0 | 0 | 51 | 0 |
| firecrawl | 20 | 0 | 30 | 1 | 0 |
| crawl4ai | 0 | 0 | 0 | 51 | 0 |
| bing-grounding | 0 | 0 | 0 | 51 | 0 |
| anthropic-web | 0 | 0 | 0 | 51 | 0 |
<!-- bench:end -->

- A tool with no `ok` rows has no score. A missing score is never a zero.
- A tool with no key is skipped. The harness reads keys from the environment or the Keychain, and the text report names the missing key.

## Scores per job

Each score keeps only rows with status `ok`.
It averages each task over its runs, then takes the mean across tasks.

<!-- bench:start jobs -->
| job | tool | tasks | mean accuracy |
| --- | --- | --- | --- |
| answer | exa | 7 | 1.000 |
| answer | webular | 7 | 0.714 |
| scrape | exa | 3 | 1.000 |
| scrape | firecrawl | 3 | 0.667 |
| scrape | readability | 3 | 0.333 |
| scrape | webular | 6 | 1.000 |
| search | exa | 4 | 1.000 |
| search | firecrawl | 4 | 1.000 |
| search | webular | 4 | 1.000 |
<!-- bench:end -->

## Shared tasks

These rows compare webular with one peer only on the tasks both tools answered.

<!-- bench:start shared -->
| metric | webular | firecrawl (7 shared tasks) | webular | exa (14 shared tasks) | webular | readability (3 shared tasks) |
| --- | --- | --- | --- | --- | --- | --- |
| accuracy | 1 | 0.85 | 0.857 | 1 | 1 | 0.333 |
| citation precision | n/a | n/a | n/a | 0.977 | n/a | n/a |
| latency p50 (ms) | 696 | 534 | 1693 | 1270 | 469 | 6 |
| latency p95 (ms) | 2873 | 782 | 3301 | 1695 | 1132 | 47 |
| success rate | 1 | 1 | 1 | 1 | 1 | 1 |
| determinism | 0.429 | 1 | 0.571 | 0.5 | 1 | 1 |
| cost per call (USD) | 0 | 0.00129 | 0 | 0.005 | 0 | 0 |
| keys needed | 0 | 1 | 0 | 1 | 0 | 0 |

Across all of its own tasks, webular has an accuracy of 0.882, a success rate of 1, a p50 latency of 1361 ms, and a p95 latency of 3301 ms.
Source: [the text report](../bench/results/peers-2026-10-22T00-58-50-543Z.txt).
<!-- bench:end -->

### What the numbers say

- Webular costs nothing per call and needs no key. Its zero cost is also one of the harness biases listed below.

<!-- bench:start notes -->
- On the 7 tasks it shares with firecrawl, webular leads on accuracy, 1 against 0.85.
- On the 14 tasks it shares with exa, webular trails on accuracy, 0.857 against 1.
- On the 3 tasks it shares with readability, webular leads on accuracy, 1 against 0.333.
- Webular is slower than firecrawl at p50 (696 ms against 534 ms), and slower than exa at p50 (1693 ms against 1270 ms), and slower than readability at p50 (469 ms against 6 ms).
- The task counts are very small: 4 search, 6 scrape, 7 answer tasks. Treat every gap as a sign, not a proof.
<!-- bench:end -->

## Method

The full method lives in the spec:

- [Benchmark spec](../bench/spec/benchmark-spec.md): task families, quotas, and where gold answers come from.
- [Grading and statistics](../bench/spec/spec-grading-and-stats.md): graders, paired tests, win rules, latency, and cost.
- [Integrity and report](../bench/spec/spec-integrity-and-report.md): fairness, caching, guard tests, and the report format.
- [Audit fixes](../bench/spec/spec-audit-fixes.md): the biases an audit found in the harness, and how to fix each one.

The task sets live in [bench/tasks](../bench/tasks/), with their sources in [SOURCES.md](../bench/tasks/SOURCES.md).
Each peer has one adapter in [scripts/bench/peers](../scripts/bench/peers/).

## Harness biases

The audit in [bench/spec/spec-audit-fixes.md](../bench/spec/spec-audit-fixes.md) lists 16 biases.
The commit that fixes several of them, `2cc33fb9` on the branch `bench-harness-fairness`, is not part of this branch.
<!-- bench:start fields -->
The results file has these top-level fields: `runs`, `seed`, `records`.
<!-- bench:end -->
So treat all 16 biases as open for these results:

1. The answer job compares unlike things.
2. Warm and cold calls are mixed.
3. Webular state carries across runs.
4. Tasks were written from webular's misses and tuned on the same set.
5. Cost and ties are scored in webular's favor.
6. No confidence intervals; repeats are treated as independent.
7. Search tasks test homepage lookup.
8. Settings and result counts are not equal.
9. One process, one machine, and unlogged load.
10. Timeout, retry, and error handling differ.
11. ABBA order covers webular code variants only.
12. The grader has false passes and false fails.
13. Replay keys ignore the code version, and budgets drop rows.
14. Metric definitions are not comparable.
15. Gold answers carry no source or date.
16. Webular-only fixture tasks sit next to a self-comparison table.

## Reproduce the results

Replay the saved recordings. This is free and gives the same numbers each time:

```bash
mise run bench:peers
```

Run live against the keyed peers.
This spends paid API quota, at most 20 calls per peer, as [mise.toml](../mise.toml) states. Run it only on purpose:

```bash
mise run bench:peers:live
```

The live run writes a new results file into [bench/results](../bench/results/).

## Raw data policy

These rules come from [bench/AGENTS.md](../bench/AGENTS.md):

- Recordings live in [`bench/recordings/`](../bench/recordings/), keyed by the sha256 of each request.
- A results file is kept as written. To change a score, rerun the task instead of editing the file.
