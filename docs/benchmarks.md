# Benchmarks

This page shows how webular scores against other web research tools on the same tasks, and it shows losses as plainly as wins. Every number on this page comes from one committed results file, and each one links to that file. Read it as one small run, not as a final ranking. On webular's side, every score comes from its own open-source parts and Jev, TypeSafe's decision model, with no paid web API. [The README](../README.md) lists what webular is built on.

## Source files

<!-- bench:start run -->
All numbers come from one committed peer run, with 3 runs per task (sha256 `be90e1e5d721`):

- [peers-2026-10-22T13-13-46-776Z.json](../bench/results/peers-2026-10-22T13-13-46-776Z.json): one row per tool, task, and run, with its status and accuracy.
- [peers-2026-10-22T13-13-46-776Z.txt](../bench/results/peers-2026-10-22T13-13-46-776Z.txt): the harness's text report for the same run.
<!-- bench:end -->

The results file holds no confidence intervals, no paired tests, and no p values. So this page gives none, and it calls no win or loss as proven. `mise run bench:docs` writes every number on this page from the results file. A test fails when a number here differs from that file.

## Short answer

<!-- bench:start short -->
- **answer:** webular scores 1.000 on 7 tasks; exa scores 1.000 on 7 tasks; parallel scores 1.000 on 7 tasks; perplexity scores 1.000 on 7 tasks; tavily scores 1.000 on 7 tasks. Source: [peers-2026-10-22T13-13-46-776Z.json](../bench/results/peers-2026-10-22T13-13-46-776Z.json).
- **scrape:** webular scores 1.000 on 6 tasks; exa scores 1.000 on 3 tasks; firecrawl scores 0.667 on 3 tasks; jina scores 0.667 on 3 tasks; readability scores 0.333 on 6 tasks. Source: [peers-2026-10-22T13-13-46-776Z.json](../bench/results/peers-2026-10-22T13-13-46-776Z.json).
- **search:** webular scores 1.000 on 4 tasks; exa scores 1.000 on 4 tasks; firecrawl scores 1.000 on 4 tasks; parallel scores 1.000 on 4 tasks; tavily scores 1.000 on 4 tasks; youcom scores 1.000 on 4 tasks. Source: [peers-2026-10-22T13-13-46-776Z.json](../bench/results/peers-2026-10-22T13-13-46-776Z.json).
- **Where webular leads:** it runs offline, needs 0 keys, and costs 0 USD per call. Source: [the text report](../bench/results/peers-2026-10-22T13-13-46-776Z.txt).
<!-- bench:end -->

## What ran

<!-- bench:start ran -->
The run has 17 tasks: 4 search, 6 scrape, 7 answer.
Source: [peers-2026-10-22T13-13-46-776Z.json](../bench/results/peers-2026-10-22T13-13-46-776Z.json).
<!-- bench:end -->

Rows per tool, from the results file:

<!-- bench:start status -->
| tool | ok | error | unsupported | skipped | unrecorded |
| --- | --- | --- | --- | --- | --- |
| anthropic-web | 0 | 0 | 0 | 51 | 0 |
| searxng | 0 | 0 | 0 | 51 | 0 |
| youcom | 12 | 0 | 39 | 0 | 0 |
| nimble | 0 | 0 | 0 | 51 | 0 |
| scrapegraph | 0 | 0 | 0 | 102 | 0 |
| exa | 20 | 0 | 9 | 22 | 0 |
| brightdata | 0 | 0 | 0 | 51 | 0 |
| crawl4ai | 0 | 0 | 0 | 51 | 0 |
| bing-grounding | 0 | 0 | 0 | 51 | 0 |
| zyte | 0 | 0 | 0 | 51 | 0 |
| readability | 18 | 0 | 33 | 0 | 0 |
| apify | 0 | 0 | 0 | 51 | 0 |
| linkup | 0 | 0 | 0 | 51 | 0 |
| curl-html2text | 0 | 0 | 0 | 51 | 0 |
| gemini | 0 | 20 | 30 | 1 | 0 |
| jina | 9 | 11 | 30 | 1 | 0 |
| valyu | 0 | 0 | 0 | 51 | 0 |
| trafilatura | 0 | 0 | 0 | 51 | 0 |
| perplexity | 20 | 0 | 30 | 1 | 0 |
| serper | 0 | 0 | 0 | 51 | 0 |
| spider | 0 | 0 | 0 | 51 | 0 |
| browserbase | 0 | 20 | 30 | 1 | 0 |
| tavily | 20 | 0 | 18 | 13 | 0 |
| vertex-grounding | 0 | 0 | 0 | 51 | 0 |
| parallel | 20 | 0 | 18 | 13 | 0 |
| contextdev | 0 | 0 | 0 | 51 | 0 |
| serpapi | 0 | 0 | 0 | 51 | 0 |
| tinyfish | 0 | 0 | 0 | 51 | 0 |
| openai-web-search | 0 | 0 | 0 | 51 | 0 |
| firecrawl | 20 | 0 | 30 | 1 | 0 |
| webular | 51 | 0 | 0 | 0 | 0 |
<!-- bench:end -->

- A tool with no `ok` rows has no score. A missing score is never a zero. A tool with no key is skipped. The harness reads keys from the environment or the Keychain, and the text report names the missing key.

## Scores per job

Each score keeps only rows with status `ok`. It averages each task over its runs, then takes the mean across tasks.

<!-- bench:start jobs -->
| job | tool | tasks | mean accuracy |
| --- | --- | --- | --- |
| answer | exa | 7 | 1.000 |
| answer | parallel | 7 | 1.000 |
| answer | perplexity | 7 | 1.000 |
| answer | tavily | 7 | 1.000 |
| answer | webular | 7 | 1.000 |
| scrape | exa | 3 | 1.000 |
| scrape | firecrawl | 3 | 0.667 |
| scrape | jina | 3 | 0.667 |
| scrape | readability | 6 | 0.333 |
| scrape | webular | 6 | 1.000 |
| search | exa | 4 | 1.000 |
| search | firecrawl | 4 | 1.000 |
| search | parallel | 4 | 1.000 |
| search | tavily | 4 | 1.000 |
| search | webular | 4 | 1.000 |
| search | youcom | 4 | 1.000 |
<!-- bench:end -->

## Shared tasks

Each peer is compared with webular only on the tasks both tools answered. [The per-peer comparison](benchmarks-peers.md) holds that table and what it says.

## Agent matrix
<!-- bench:start matrix -->
Each line is one agent model, and each entry is one tool arm, from [models-2026-10-22-062400-merged.json](../bench/results/models-2026-10-22-062400-merged.json). Every cell uses the same tasks, grader, seed, and prompt; only the tool changes. A cell says skipped when its key or its agent adapter is missing. A no tool call run is one where the model never called the arm's tool, so no graded answer came back. Sure-but-wrong counts only graded wrong answers. Each cell is at most 4 runs, one per task, a small sample, so treat a gap of one run as noise.

- **claude-opus-5-5:** webular-jev-off 0.750 (4 runs, 1 no tool call, 0 sure-but-wrong, p50 49101 ms, 1.0 tool calls, 819 tokens, 0.1010 USD); webular-jev-on 1.000 (4 runs, 0 no tool call, 0 sure-but-wrong, p50 27641 ms, 1.0 tool calls, 751 tokens, 0.0893 USD); exa 0.750 (4 runs, 1 no tool call, 0 sure-but-wrong, p50 24420 ms, 0.8 tool calls, 1024 tokens, 0.1045 USD); firecrawl 0.750 (4 runs, 1 no tool call, 0 sure-but-wrong, p50 51562 ms, 0.8 tool calls, 958 tokens, 0.1445 USD); parallel skipped: no agent adapter; tavily 0.500 (4 runs, 2 no tool call, 0 sure-but-wrong, p50 39633 ms, 0.5 tool calls, 1282 tokens, 0.1233 USD); perplexity 1.000 (4 runs, 0 no tool call, 0 sure-but-wrong, p50 34326 ms, 1.0 tool calls, 1141 tokens, 0.1040 USD); youcom skipped: no agent adapter; jina skipped: no agent adapter; linkup skipped: no agent adapter; valyu skipped: no agent adapter; serpapi skipped: no agent adapter; serper skipped: no agent adapter; gemini skipped: no agent adapter; apify skipped: no agent adapter; brightdata skipped: no agent adapter; browserbase skipped: no agent adapter; scrapegraph skipped: no agent adapter; nimble skipped: no agent adapter; tinyfish skipped: no agent adapter; contextdev skipped: no agent adapter; searxng skipped: no agent adapter; crawl4ai skipped: no agent adapter; trafilatura skipped: no agent adapter; readability skipped: no agent adapter.
- **claude-sonnet-5-5:** webular-jev-off 1.000 (4 runs, 0 no tool call, 0 sure-but-wrong, p50 32596 ms, 1.0 tool calls, 822 tokens, 0.0410 USD); webular-jev-on 0.750 (4 runs, 1 no tool call, 0 sure-but-wrong, p50 40484 ms, 0.8 tool calls, 766 tokens, 0.0356 USD); exa 1.000 (4 runs, 0 no tool call, 0 sure-but-wrong, p50 33371 ms, 1.0 tool calls, 715 tokens, 0.0463 USD); firecrawl 0.750 (4 runs, 1 no tool call, 0 sure-but-wrong, p50 39117 ms, 0.8 tool calls, 803 tokens, 0.0691 USD); parallel skipped: no agent adapter; tavily 0.750 (4 runs, 1 no tool call, 0 sure-but-wrong, p50 26130 ms, 0.8 tool calls, 697 tokens, 0.0604 USD); perplexity 1.000 (4 runs, 0 no tool call, 0 sure-but-wrong, p50 22034 ms, 1.0 tool calls, 781 tokens, 0.0461 USD); youcom skipped: no agent adapter; jina skipped: no agent adapter; linkup skipped: no agent adapter; valyu skipped: no agent adapter; serpapi skipped: no agent adapter; serper skipped: no agent adapter; gemini skipped: no agent adapter; apify skipped: no agent adapter; brightdata skipped: no agent adapter; browserbase skipped: no agent adapter; scrapegraph skipped: no agent adapter; nimble skipped: no agent adapter; tinyfish skipped: no agent adapter; contextdev skipped: no agent adapter; searxng skipped: no agent adapter; crawl4ai skipped: no agent adapter; trafilatura skipped: no agent adapter; readability skipped: no agent adapter.
- **claude-haiku-5-5:** webular-jev-off 0.750 (4 runs, 1 no tool call, 0 sure-but-wrong, p50 52016 ms, 1.8 tool calls, 1885 tokens, 0.0067 USD); webular-jev-on 1.000 (4 runs, 0 no tool call, 0 sure-but-wrong, p50 65475 ms, 2.0 tool calls, 2009 tokens, 0.0057 USD); exa 1.000 (4 runs, 0 no tool call, 0 sure-but-wrong, p50 27840 ms, 1.0 tool calls, 782 tokens, 0.0052 USD); firecrawl 1.000 (4 runs, 0 no tool call, 0 sure-but-wrong, p50 29754 ms, 1.0 tool calls, 908 tokens, 0.0062 USD); parallel skipped: no agent adapter; tavily 0.750 (4 runs, 1 no tool call, 0 sure-but-wrong, p50 20386 ms, 0.8 tool calls, 1007 tokens, 0.0043 USD); perplexity 1.000 (4 runs, 0 no tool call, 0 sure-but-wrong, p50 20782 ms, 1.0 tool calls, 830 tokens, 0.0027 USD); youcom skipped: no agent adapter; jina skipped: no agent adapter; linkup skipped: no agent adapter; valyu skipped: no agent adapter; serpapi skipped: no agent adapter; serper skipped: no agent adapter; gemini skipped: no agent adapter; apify skipped: no agent adapter; brightdata skipped: no agent adapter; browserbase skipped: no agent adapter; scrapegraph skipped: no agent adapter; nimble skipped: no agent adapter; tinyfish skipped: no agent adapter; contextdev skipped: no agent adapter; searxng skipped: no agent adapter; crawl4ai skipped: no agent adapter; trafilatura skipped: no agent adapter; readability skipped: no agent adapter.
<!-- bench:end -->

## Outside reference points

These scores are published by others. They were not measured here, and they are not comparable to webular's scores above: the tasks, graders, and tool settings differ.

| source | date | published scores |
| --- | --- | --- |
| [Artificial Analysis Search Index](https://artificialanalysis.ai/agents/search-api) | data of 2026-10-19 | Exa 80, Perplexity 80, Octen 77, Parallel 75, Brave 75, Nimble 74, Firecrawl 73 |
| [NEEDLE](https://keenableai.github.io/needle/results/), run by Keenable's makers | no date given | Keenable 73%, Exa 68%, Perplexity 67%, Brave 66%, Parallel 62%, Firecrawl 52%, Tavily 44% |
| [openbenchmarks factual lookup](https://openbenchmarks.com/web-search) | 2026-10-02 | Exa 99.3%, Perplexity 97.3%, Linkup 96.7%, Firecrawl 95.3%, Nimble 94.3%, Tavily 87.7% |

## Method

The full method lives in the spec:

- [Benchmark spec](../bench/spec/benchmark-spec.md): task families, quotas, and where gold answers come from.
- [Grading and statistics](../bench/spec/spec-grading-and-stats.md): graders, paired tests, win rules, latency, and cost.
- [Integrity and report](../bench/spec/spec-integrity-and-report.md): fairness, caching, guard tests, and the report format.
- [Audit fixes](../bench/spec/spec-audit-fixes.md): the biases an audit found in the harness, and how to fix each one.

The task sets live in [bench/tasks](../bench/tasks/), with their sources in [SOURCES.md](../bench/tasks/SOURCES.md). Each peer has one adapter in [scripts/bench/peers](../scripts/bench/peers/).

## Harness biases

The audit in [bench/spec/spec-audit-fixes.md](../bench/spec/spec-audit-fixes.md) lists 16 biases. The fixes for several of them are in commit `2cc33fb9` on the branch `bench-harness-fairness`. These results do not include that commit.
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

Run live against the keyed peers. This spends paid API quota, at most 20 calls per peer, as [mise.toml](../mise.toml) states. Run it only on purpose:

```bash
mise run bench:peers:live
```

The live run writes a new results file into [bench/results](../bench/results/).

## Raw data policy

These rules come from [bench/AGENTS.md](../bench/AGENTS.md):

- Recordings live in [`bench/recordings/`](../bench/recordings/), keyed by the sha256 of each request.
- A results file is kept as written. To change a score, rerun the task instead of editing the file.
