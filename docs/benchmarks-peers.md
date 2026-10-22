# Benchmarks: webular against each peer

This page holds the full per-peer comparison from the committed peer run. [The benchmark report](benchmarks.md) gives the short answer, the scores per job, the method, and the harness biases. `mise run bench:docs` writes every number on this page from the results file, and a test fails when a number here differs from that file.

## Shared tasks

These rows compare webular with one peer only on the tasks both tools answered.

<!-- bench:start shared -->
| metric | webular | firecrawl (17 shared tasks) | webular | exa (19 shared tasks) | webular | tavily (16 shared tasks) | webular | perplexity (10 shared tasks) | webular | readability (3 shared tasks) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| accuracy | 0.824 | 0.735 | 0.895 | 0.947 | 0.875 | 0.75 | 0.9 | 1 | 1 | 0.333 |
| citation precision | n/a | n/a | n/a | 0.964 | n/a | 0.886 | n/a | n/a | n/a | n/a |
| latency p50 (ms) | 594 | 576 | 1897 | 1505 | 1250 | 298 | 2775 | 1815 | 33 | 3 |
| latency p95 (ms) | 4794 | 13835 | 5839 | 17813 | 4141 | 60000 | 5839 | 4524 | 3208 | 6 |
| success rate | 1 | 1 | 1 | 1 | 1 | 0.938 | 1 | 1 | 1 | 1 |
| determinism | 0.941 | 0.706 | 0.789 | 0.474 | 0.813 | 0.813 | 0.7 | 0.5 | 1 | 1 |
| cost per call (USD) | 0 | 0.00178 | 0 | 0.0826 | 0 | 0.00907 | 0 | 0.0185 | 0 | 0 |
| keys needed | 0 | 1 | 0 | 1 | 0 | 1 | 0 | 1 | 0 | 0 |

Across all of its own tasks, webular has an accuracy of 0.824, a success rate of 1, a p50 latency of 1080 ms, and a p95 latency of 5970 ms.
Source: [the text report](../bench/results/peers-2026-10-22T14-51-52-746Z.txt).
<!-- bench:end -->

### What the numbers say

- Webular costs nothing per call and needs no key. Its zero cost is also one of the [harness biases](benchmarks.md#harness-biases).

<!-- bench:start notes -->
- On the 17 tasks it shares with firecrawl, webular leads on accuracy, 0.824 against 0.735.
- On the 19 tasks it shares with exa, webular trails on accuracy, 0.895 against 0.947.
- On the 16 tasks it shares with tavily, webular leads on accuracy, 0.875 against 0.75.
- On the 10 tasks it shares with perplexity, webular trails on accuracy, 0.9 against 1.
- On the 3 tasks it shares with readability, webular leads on accuracy, 1 against 0.333.
- Webular is slower than firecrawl at p50 (594 ms against 576 ms), and slower than exa at p50 (1897 ms against 1505 ms), and slower than tavily at p50 (1250 ms against 298 ms), and slower than perplexity at p50 (2775 ms against 1815 ms), and slower than readability at p50 (33 ms against 3 ms).
- The task counts are very small: 2 batch, 2 crawl, 7 answer, 3 extract, 6 scrape, 2 media, 4 search, 1 monitor, 3 research, 2 summarize, 1 act, 1 parse, 3 map tasks. Treat every gap as a sign, not a proof.
<!-- bench:end -->
