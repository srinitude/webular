# Benchmarks: webular against each peer

This page holds the full per-peer comparison from the committed peer run. [The benchmark report](benchmarks.md) gives the short answer, the scores per job, the method, and the harness biases. `mise run bench:docs` writes every number on this page from the results file, and a test fails when a number here differs from that file.

## Shared tasks

These rows compare webular with one peer only on the tasks both tools answered.

<!-- bench:start shared -->
| metric | webular | firecrawl (7 shared tasks) | webular | exa (14 shared tasks) | webular | tavily (11 shared tasks) | webular | perplexity (7 shared tasks) | webular | parallel (11 shared tasks) | webular | youcom (4 shared tasks) | webular | jina (7 shared tasks) | webular | browserbase (7 shared tasks) | webular | gemini (7 shared tasks) | webular | readability (6 shared tasks) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| accuracy | 1 | 0.85 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 0.3 | 1 | 0 | 1 | 0 | 1 | 0.333 |
| citation precision | n/a | n/a | n/a | 0.938 | n/a | 0.723 | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |
| latency p50 (ms) | 472 | 257 | 675 | 536 | 825 | 49 | 1093 | 1673 | 825 | 1626 | 399 | 99 | 472 | 60000 | 472 | 60000 | 1093 | 60000 | 374 | 2 |
| latency p95 (ms) | 1005 | 990 | 2445 | 1717 | 2455 | 165 | 2445 | 2083 | 2455 | 3777 | 2505 | 570 | 1005 | 60000 | 1005 | 60000 | 2445 | 60000 | 2082 | 330 |
| success rate | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 0.45 | 1 | 0 | 1 | 0 | 1 | 1 |
| determinism | 0.714 | 0.857 | 0.714 | 0.667 | 0.636 | 1 | 0.714 | 0.571 | 0.636 | 0 | 0.5 | 1 | 0.714 | 1 | 0.714 | 1 | 0.714 | 1 | 1 | 1 |
| cost per call (USD) | 0 | 0.00129 | 0 | 0.0045 | 0 | 0.008 | 0 | 0.00504 | 0 | 0.00685 | 0 | 0.005 | 0 | 0.000929 | 0 | n/a | 0 | n/a | 0 | 0 |
| keys needed | 0 | 1 | 0 | 1 | 0 | 1 | 0 | 1 | 0 | 1 | 0 | 1 | 0 | 1 | 0 | 1 | 0 | 1 | 0 | 0 |

Across all of its own tasks, webular has an accuracy of 1, a success rate of 1, a p50 latency of 665 ms, and a p95 latency of 2445 ms.
Source: [the text report](../bench/results/peers-2026-10-22T12-35-03-944Z.txt).
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
- On the 6 tasks it shares with readability, webular leads on accuracy, 1 against 0.333.
- Webular is slower than firecrawl at p50 (472 ms against 257 ms), and slower than exa at p50 (675 ms against 536 ms), and slower than tavily at p50 (825 ms against 49 ms), and faster than perplexity at p50 (1093 ms against 1673 ms), and faster than parallel at p50 (825 ms against 1626 ms), and slower than youcom at p50 (399 ms against 99 ms), and faster than jina at p50 (472 ms against 60000 ms), and faster than browserbase at p50 (472 ms against 60000 ms), and faster than gemini at p50 (1093 ms against 60000 ms), and slower than readability at p50 (374 ms against 2 ms).
- The task counts are very small: 7 answer, 4 search, 6 scrape tasks. Treat every gap as a sign, not a proof.
<!-- bench:end -->
