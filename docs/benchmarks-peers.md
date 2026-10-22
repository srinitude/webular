# Benchmarks: webular against each peer

This page holds the full per-peer comparison from the committed peer run. [The benchmark report](benchmarks.md) gives the short answer, the scores per job, the method, and the harness biases. `mise run bench:docs` writes every number on this page from the results file, and a test fails when a number here differs from that file.

## Shared tasks

These rows compare webular with one peer only on the tasks both tools answered.

<!-- bench:start shared -->
| metric | webular | firecrawl (7 shared tasks) | webular | exa (14 shared tasks) | webular | tavily (11 shared tasks) | webular | perplexity (7 shared tasks) | webular | parallel (11 shared tasks) | webular | youcom (4 shared tasks) | webular | jina (7 shared tasks) | webular | browserbase (7 shared tasks) | webular | gemini (7 shared tasks) | webular | readability (3 shared tasks) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| accuracy | 1 | 0.85 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 0.3 | 1 | 0 | 1 | 0 | 1 | 0.333 |
| citation precision | n/a | n/a | n/a | 0.932 | n/a | 0.867 | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |
| latency p50 (ms) | 735 | 552 | 1124 | 1203 | 1342 | 1113 | 1978 | 1606 | 1342 | 1380 | 798 | 167 | 735 | 60000 | 735 | 60000 | 1978 | 60000 | 321 | 1 |
| latency p95 (ms) | 991 | 1141 | 2598 | 1808 | 2677 | 2798 | 2677 | 2035 | 2677 | 2868 | 1124 | 961 | 991 | 60000 | 991 | 60000 | 2677 | 60000 | 4387 | 3 |
| success rate | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 0.45 | 1 | 0 | 1 | 0 | 1 | 1 |
| determinism | 0.429 | 1 | 0.571 | 0.5 | 0.455 | 1 | 0.714 | 0.429 | 0.455 | 0.111 | 0 | 1 | 0.429 | 1 | 0.429 | 1 | 0.714 | 1 | 1 | 1 |
| cost per call (USD) | 0 | 0.00129 | 0 | 0.005 | 0 | 0.008 | 0 | 0.00504 | 0 | 0.0064 | 0 | 0.005 | 0 | 0.000929 | 0 | n/a | 0 | n/a | 0 | 0 |
| keys needed | 0 | 1 | 0 | 1 | 0 | 1 | 0 | 1 | 0 | 1 | 0 | 1 | 0 | 1 | 0 | 1 | 0 | 1 | 0 | 0 |

Across all of its own tasks, webular has an accuracy of 1, a success rate of 1, a p50 latency of 991 ms, and a p95 latency of 2677 ms.
Source: [the text report](../bench/results/peers-2026-10-22T09-01-56-691Z.txt).
<!-- bench:end -->

### What the numbers say

- Webular costs nothing per call and needs no key. Its zero cost is also one of the [harness biases](benchmarks.md#harness-biases).

<!-- bench:start notes -->
- On the 7 tasks it shares with firecrawl, webular leads on accuracy, 1 against 0.85.
- On the 14 tasks it shares with exa, webular ties on accuracy, 1 against 1.
- On the 11 tasks it shares with tavily, webular ties on accuracy, 1 against 1.
- On the 7 tasks it shares with perplexity, webular ties on accuracy, 1 against 1.
- On the 11 tasks it shares with parallel, webular ties on accuracy, 1 against 1.
- On the 4 tasks it shares with youcom, webular ties on accuracy, 1 against 1.
- On the 7 tasks it shares with jina, webular leads on accuracy, 1 against 0.3.
- On the 7 tasks it shares with browserbase, webular leads on accuracy, 1 against 0.
- On the 7 tasks it shares with gemini, webular leads on accuracy, 1 against 0.
- On the 3 tasks it shares with readability, webular leads on accuracy, 1 against 0.333.
- Webular is slower than firecrawl at p50 (735 ms against 552 ms), and faster than exa at p50 (1124 ms against 1203 ms), and slower than tavily at p50 (1342 ms against 1113 ms), and slower than perplexity at p50 (1978 ms against 1606 ms), and faster than parallel at p50 (1342 ms against 1380 ms), and slower than youcom at p50 (798 ms against 167 ms), and faster than jina at p50 (735 ms against 60000 ms), and faster than browserbase at p50 (735 ms against 60000 ms), and faster than gemini at p50 (1978 ms against 60000 ms), and slower than readability at p50 (321 ms against 1 ms).
- The task counts are very small: 7 answer, 6 scrape, 4 search tasks. Treat every gap as a sign, not a proof.
<!-- bench:end -->
