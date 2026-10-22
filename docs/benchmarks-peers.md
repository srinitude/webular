# Benchmarks: webular against each peer

**What this measures:** webular against each paid rival, or peer, one at a time, only on the tasks both tools answered. Those are called shared tasks. Each pair of columns is one match-up: webular on the left, the rival on the right.

**Why it matters:** a fair head-to-head needs the same questions on both sides. This page shows, for each rival, whether webular is more often right, faster, steadier, and cheaper.

**How to read the numbers:** the "better is" column says which way is good for each row. Accuracy, citation precision, success rate, and determinism run from 0 to 1, and higher is better. Waits are in ms (thousandths of a second), and lower is better. "n/a" means the measure does not apply, for example a tool that lists no sources. The task counts are small, so a gap is a sign, not proof. [How to read the benchmarks](benchmarks-guide.md) defines every term.

[The benchmark report](benchmarks.md) gives the short answer, the scores per job, the method, and the harness biases. `mise run bench:docs` writes every number on this page from the results file, and a test fails when a number here differs from that file.

## Shared tasks

Each row is one measure. The notes below the table say in words where webular leads and where it trails.

<!-- bench:start shared -->
| metric | better is | webular | firecrawl (19 shared tasks) | webular | exa (20 shared tasks) | webular | readability (3 shared tasks) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| accuracy (share right) | higher | 0.895 | 0.8 | 0.95 | 0.95 | 1 | 0.333 |
| citation precision (sources that back the answer) | higher | n/a | n/a | n/a | 0.964 | n/a | n/a |
| median wait, p50 (ms) | lower | 512 | 918 | 1312 | 1357 | 161 | 1 |
| slow-case wait, p95 (ms) | lower | 5393 | 14829 | 4114 | 9728 | 2051 | 7 |
| success rate (calls with no error) | higher | 1 | 1 | 1 | 1 | 1 | 1 |
| determinism (same output each run) | higher | 0.842 | 0 | 0.65 | n/a | 1 | 1 |
| cost per call (USD) | lower | 0 | 0.00178 | 0 | 0.0786 | 0 | 0 |
| keys needed | fewer | 0 | 1 | 0 | 1 | 0 | 0 |

Across all of its own tasks, webular has an accuracy of 0.88, a success rate of 1, a median wait (p50) of 712 ms, and a slow-case wait (p95) of 5245 ms. One ms is a thousandth of a second.
Source: [the text report](../bench/results/peers-2026-10-22T17-42-50-204Z.txt).
<!-- bench:end -->

### What the numbers say

- Webular costs nothing per call and needs no key. Its zero cost is also one of the [harness biases](benchmarks.md#harness-biases).

<!-- bench:start notes -->
- On the 19 tasks it shares with firecrawl, webular leads on accuracy, 0.895 against 0.8.
- On the 20 tasks it shares with exa, webular ties on accuracy, 0.95 against 0.95.
- On the 3 tasks it shares with readability, webular leads on accuracy, 1 against 0.333.
- Against firecrawl, webular's median wait (p50) is faster, 512 ms against 918 ms. Its slow-case wait (p95) is faster, 5393 ms against 14829 ms.
- Against exa, webular's median wait (p50) is faster, 1312 ms against 1357 ms. Its slow-case wait (p95) is faster, 4114 ms against 9728 ms.
- Against readability, webular's median wait (p50) is slower, 161 ms against 1 ms. Its slow-case wait (p95) is slower, 2051 ms against 7 ms.
- The task counts are very small: 4 search, 6 scrape, 3 extract, 4 batch, 7 answer, 2 crawl, 3 map, 2 media, 2 summarize, 3 research, 1 act, 1 monitor, 1 parse tasks. Treat every gap as a sign, not a proof.
<!-- bench:end -->
