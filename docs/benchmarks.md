# Benchmarks

This page shows how webular scores against other web research tools on the same tasks, and it shows losses as plainly as wins.
Every number on this page comes from one committed results file, and each one links to that file.
Read it as one small run, not as a final ranking.

## Source files

<!-- bench:start run -->
All numbers come from one committed peer run, with 3 runs per task (sha256 `fc2653bb0e73`):

- [peers-2026-10-21T03-51-21-982Z.json](../bench/results/peers-2026-10-21T03-51-21-982Z.json): one row per tool, task, and run, with its status and accuracy.
- [peers-2026-10-21T03-51-21-982Z.txt](../bench/results/peers-2026-10-21T03-51-21-982Z.txt): the harness's text report for the same run.
<!-- bench:end -->

The results file holds no confidence intervals, no paired tests, and no p values.
So this page gives none, and it calls no win or loss as proven.
`mise run bench:docs` writes every number on this page from the results file. A test fails when a number here differs from that file.

## Short answer

<!-- bench:start short -->
- **answer:** webular scores 0.000 on 6 tasks; exa scores 1.000 on 6 tasks. Source: [peers-2026-10-21T03-51-21-982Z.json](../bench/results/peers-2026-10-21T03-51-21-982Z.json).
- **scrape:** webular scores 0.400 on 5 tasks; exa scores 1.000 on 3 tasks; firecrawl scores 0.333 on 3 tasks. Source: [peers-2026-10-21T03-51-21-982Z.json](../bench/results/peers-2026-10-21T03-51-21-982Z.json).
- **search:** webular scores 0.222 on 3 tasks; exa scores 1.000 on 3 tasks; firecrawl scores 1.000 on 3 tasks. Source: [peers-2026-10-21T03-51-21-982Z.json](../bench/results/peers-2026-10-21T03-51-21-982Z.json).
- **Where webular leads:** it runs offline, needs 0 keys, and costs 0 USD per call. Source: [the text report](../bench/results/peers-2026-10-21T03-51-21-982Z.txt).
<!-- bench:end -->

## What ran

<!-- bench:start ran -->
The run has 15 tasks: 6 scrape, 3 search, 6 answer.
Source: [peers-2026-10-21T03-51-21-982Z.json](../bench/results/peers-2026-10-21T03-51-21-982Z.json).
<!-- bench:end -->

Rows per tool, from the results file:

<!-- bench:start status -->
| tool | ok | error | unsupported | skipped | unrecorded |
| --- | --- | --- | --- | --- | --- |
| webular | 42 | 3 | 0 | 0 | 0 |
| firecrawl | 18 | 0 | 27 | 0 | 0 |
| exa | 20 | 0 | 9 | 16 | 0 |
| tavily | 0 | 0 | 18 | 0 | 27 |
| perplexity | 0 | 0 | 27 | 0 | 18 |
| parallel | 0 | 0 | 0 | 45 | 0 |
<!-- bench:end -->

- A tool with no `ok` rows has no score. A missing score is never a zero.
- A tool with no key is skipped. The harness reads keys from the environment or the Keychain, and the text report names the missing key.

## Scores per job

Each score keeps only rows with status `ok`.
It averages each task over its runs, then takes the mean across tasks.

<!-- bench:start jobs -->
| job | tool | tasks | mean accuracy |
| --- | --- | --- | --- |
| answer | exa | 6 | 1.000 |
| answer | webular | 6 | 0.000 |
| scrape | exa | 3 | 1.000 |
| scrape | firecrawl | 3 | 0.333 |
| scrape | webular | 5 | 0.400 |
| search | exa | 3 | 1.000 |
| search | firecrawl | 3 | 1.000 |
| search | webular | 3 | 0.222 |
<!-- bench:end -->

## Shared tasks

These rows compare webular with one peer only on the tasks both tools answered.

<!-- bench:start shared -->
| metric | webular | firecrawl (6 shared tasks) | webular | exa (12 shared tasks) |
| --- | --- | --- | --- | --- |
| accuracy | 0.444 | 0.667 | 0.222 | 1 |
| citation precision | n/a | n/a | n/a | 0.969 |
| latency p50 (ms) | 683 | 501 | 194 | 998 |
| latency p95 (ms) | 1163 | 1247 | 750 | 2217 |
| success rate | 0.833 | 1 | 0.917 | 1 |
| determinism | 0.5 | 1 | 0.75 | 0.75 |
| cost per call (USD) | 0 | 0.00125 | 0 | 0.0044 |
| keys needed | 0 | 1 | 0 | 1 |

Across all of its own tasks, webular has an accuracy of 0.178, a success rate of 0.933, a p50 latency of 161 ms, and a p95 latency of 730 ms.
Source: [the text report](../bench/results/peers-2026-10-21T03-51-21-982Z.txt).
<!-- bench:end -->

### What the numbers say

- Webular costs nothing per call and needs no key. Its zero cost is also one of the harness biases listed below.

<!-- bench:start notes -->
- On the 6 tasks it shares with firecrawl, webular trails on accuracy, 0.444 against 0.667.
- On the 12 tasks it shares with exa, webular trails on accuracy, 0.222 against 1.
- Webular is slower than firecrawl at p50 (683 ms against 501 ms), and faster than exa at p50 (194 ms against 998 ms).
- The task counts are very small: 6 scrape, 3 search, 6 answer tasks. Treat every gap as a sign, not a proof.
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
The results file has these top-level fields: `runs`, `records`. It saves no seed or task order.
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
