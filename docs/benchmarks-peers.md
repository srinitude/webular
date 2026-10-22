# Benchmarks: webular against each peer

**What this measures:** webular against each paid rival, or peer, one at a time, only on the tasks both tools answered. Those are called shared tasks. Each pair of columns is one match-up: webular on the left, the rival on the right.

**Why it matters:** a fair head-to-head needs the same questions on both sides. This page shows, for each rival, whether webular is more often right, faster, steadier, and cheaper.

**How to read the numbers:** the "better is" column says which way is good for each row. Accuracy, citation precision, success rate, and determinism run from 0 to 1, and higher is better. Waits are in ms (thousandths of a second), and lower is better. "n/a" means the measure does not apply, for example a tool that lists no sources. The task counts are small, so a gap is a sign, not proof. [How to read the benchmarks](benchmarks-guide.md) defines every term.

[The benchmark report](benchmarks.md) gives the short answer, the scores per job, the method, and the harness biases. `mise run bench:docs` writes every number on this page from the results file, and a test fails when a number here differs from that file.

## Shared tasks

Each row is one measure. The notes below the table say in words where webular leads and where it trails.

<!-- bench:start shared -->
| metric | better is | webular | firecrawl (17 shared tasks) | webular | exa (19 shared tasks) | webular | tavily (16 shared tasks) | webular | perplexity (10 shared tasks) | webular | readability (3 shared tasks) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| accuracy (share right) | higher | 0.824 | 0.735 | 0.895 | 0.947 | 0.875 | 0.75 | 0.9 | 1 | 1 | 0.333 |
| citation precision (sources that back the answer) | higher | n/a | n/a | n/a | 0.964 | n/a | 0.886 | n/a | n/a | n/a | n/a |
| median wait, p50 (ms) | lower | 594 | 576 | 1897 | 1505 | 1250 | 298 | 2775 | 1815 | 33 | 3 |
| slow-case wait, p95 (ms) | lower | 4794 | 13835 | 5839 | 17813 | 4141 | 60000 | 5839 | 4524 | 3208 | 6 |
| success rate (calls with no error) | higher | 1 | 1 | 1 | 1 | 1 | 0.938 | 1 | 1 | 1 | 1 |
| determinism (same output each run) | higher | 0.941 | 0.706 | 0.789 | 0.474 | 0.813 | 0.813 | 0.7 | 0.5 | 1 | 1 |
| cost per call (USD) | lower | 0 | 0.00178 | 0 | 0.0826 | 0 | 0.00907 | 0 | 0.0185 | 0 | 0 |
| keys needed | fewer | 0 | 1 | 0 | 1 | 0 | 1 | 0 | 1 | 0 | 0 |

Across all of its own tasks, webular has an accuracy of 0.824, a success rate of 1, a median wait (p50) of 1080 ms, and a slow-case wait (p95) of 5970 ms. One ms is a thousandth of a second.
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
- Against firecrawl, webular's median wait (p50) is slower, 594 ms against 576 ms. Its slow-case wait (p95) is faster, 4794 ms against 13835 ms.
- Against exa, webular's median wait (p50) is slower, 1897 ms against 1505 ms. Its slow-case wait (p95) is faster, 5839 ms against 17813 ms.
- Against tavily, webular's median wait (p50) is slower, 1250 ms against 298 ms. Its slow-case wait (p95) is faster, 4141 ms against 60000 ms.
- Against perplexity, webular's median wait (p50) is slower, 2775 ms against 1815 ms. Its slow-case wait (p95) is slower, 5839 ms against 4524 ms.
- Against readability, webular's median wait (p50) is slower, 33 ms against 3 ms. Its slow-case wait (p95) is slower, 3208 ms against 6 ms.
- The task counts are very small: 2 batch, 2 crawl, 7 answer, 3 extract, 6 scrape, 2 media, 4 search, 1 monitor, 3 research, 2 summarize, 1 act, 1 parse, 3 map tasks. Treat every gap as a sign, not a proof.
<!-- bench:end -->
