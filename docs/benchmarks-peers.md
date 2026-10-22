# Benchmarks: webular against each peer

This page holds the full per-peer comparison from the committed peer run. [The benchmark report](benchmarks.md) gives the short answer, the scores per job, the method, and the harness biases. `mise run bench:docs` writes every number on this page from the results file, and a test fails when a number here differs from that file.

## Shared tasks

These rows compare webular with one peer only on the tasks both tools answered.

<!-- bench:start shared -->
| metric | webular | firecrawl (7 shared tasks) | webular | exa (14 shared tasks) | webular | tavily (11 shared tasks) | webular | perplexity (7 shared tasks) | webular | parallel (11 shared tasks) | webular | youcom (4 shared tasks) | webular | jina (7 shared tasks) | webular | browserbase (7 shared tasks) | webular | gemini (7 shared tasks) | webular | readability (3 shared tasks) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| accuracy | 1 | 0.85 | 0.857 | 1 | 0.818 | 1 | 0.714 | 1 | 0.818 | 1 | 1 | 1 | 1 | 0.3 | 1 | 0 | 0.714 | 0 | 1 | 0.333 |
| citation precision | n/a | n/a | n/a | 0.963 | n/a | 0.908 | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |
| latency p50 (ms) | 526 | 613 | 1594 | 1169 | 1825 | 1504 | 2737 | 1532 | 1825 | 1751 | 459 | 122 | 526 | 60000 | 526 | 60000 | 2737 | 60000 | 362 | 4 |
| latency p95 (ms) | 3741 | 1142 | 3741 | 1581 | 3460 | 2049 | 3460 | 1805 | 3460 | 3114 | 782 | 820 | 3741 | 60000 | 3741 | 60000 | 3460 | 60000 | 1457 | 42 |
| success rate | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 0.45 | 1 | 0 | 1 | 0 | 1 | 1 |
| determinism | 0.571 | 0.857 | 0.5 | 0.5 | 0.364 | 1 | 0.429 | 0.286 | 0.364 | 0.111 | 0.25 | 1 | 0.571 | 1 | 0.571 | 1 | 0.429 | 1 | 1 | 1 |
| cost per call (USD) | 0 | 0.00129 | 0 | 0.0048 | 0 | 0.008 | 0 | 0.00504 | 0 | 0.00685 | 0 | 0.005 | 0 | 0.000929 | 0 | n/a | 0 | n/a | 0 | 0 |
| keys needed | 0 | 1 | 0 | 1 | 0 | 1 | 0 | 1 | 0 | 1 | 0 | 1 | 0 | 1 | 0 | 1 | 0 | 1 | 0 | 0 |

Across all of its own tasks, webular has an accuracy of 0.882, a success rate of 1, a p50 latency of 997 ms, and a p95 latency of 3741 ms.
Source: [the text report](../bench/results/peers-2026-10-22T07-59-24-916Z.txt).
<!-- bench:end -->

### What the numbers say

- Webular costs nothing per call and needs no key. Its zero cost is also one of the [harness biases](benchmarks.md#harness-biases).

<!-- bench:start notes -->
- On the 7 tasks it shares with firecrawl, webular leads on accuracy, 1 against 0.85.
- On the 14 tasks it shares with exa, webular trails on accuracy, 0.857 against 1.
- On the 11 tasks it shares with tavily, webular trails on accuracy, 0.818 against 1.
- On the 7 tasks it shares with perplexity, webular trails on accuracy, 0.714 against 1.
- On the 11 tasks it shares with parallel, webular trails on accuracy, 0.818 against 1.
- On the 4 tasks it shares with youcom, webular ties on accuracy, 1 against 1.
- On the 7 tasks it shares with jina, webular leads on accuracy, 1 against 0.3.
- On the 7 tasks it shares with browserbase, webular leads on accuracy, 1 against 0.
- On the 7 tasks it shares with gemini, webular leads on accuracy, 0.714 against 0.
- On the 3 tasks it shares with readability, webular leads on accuracy, 1 against 0.333.
- Webular is faster than firecrawl at p50 (526 ms against 613 ms), and slower than exa at p50 (1594 ms against 1169 ms), and slower than tavily at p50 (1825 ms against 1504 ms), and slower than perplexity at p50 (2737 ms against 1532 ms), and slower than parallel at p50 (1825 ms against 1751 ms), and slower than youcom at p50 (459 ms against 122 ms), and faster than jina at p50 (526 ms against 60000 ms), and faster than browserbase at p50 (526 ms against 60000 ms), and faster than gemini at p50 (2737 ms against 60000 ms), and slower than readability at p50 (362 ms against 4 ms).
- The task counts are very small: 6 scrape, 7 answer, 4 search tasks. Treat every gap as a sign, not a proof.
<!-- bench:end -->
