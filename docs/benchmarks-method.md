# How the benchmarks are run

This page says how the benchmark works, how to run it again yourself, how the raw data is kept, and what scores other groups publish. [How to read the benchmarks](benchmarks-guide.md) explains each term used here.

## Method

The test program, called the harness, gives each tool the same tasks and grades each answer against a known right answer. The full method lives in the spec:

- [Benchmark spec](../bench/spec/benchmark-spec.md): the kinds of tasks, how many of each, and where the right answers come from.
- [Grading and statistics](../bench/spec/spec-grading-and-stats.md): how answers are graded, the paired tests, the rules for calling a win, and how speed and cost are counted.
- [Integrity and report](../bench/spec/spec-integrity-and-report.md): fairness rules, saved-answer caching, guard tests, and the report format.
- [Audit fixes](../bench/spec/spec-audit-fixes.md): the biases an audit found in the harness, and how to fix each one.

The task sets live in [bench/tasks](../bench/tasks/), with their sources in [SOURCES.md](../bench/tasks/SOURCES.md). Each rival has one adapter, the small piece of code that sends it the tasks, in [scripts/bench/peers](../scripts/bench/peers/).

## Run it again yourself

Replay the saved answers. This is free and gives the same numbers each time:

```bash
mise run bench:peers
```

Run it live against the rivals you have keys for. This spends paid API quota, at most 20 calls per rival, as [mise.toml](../mise.toml) states. Run it only on purpose:

```bash
mise run bench:peers:live
```

The live run writes a new results file into [bench/results](../bench/results/).

## Raw data policy

These rules come from [bench/AGENTS.md](../bench/AGENTS.md):

- Saved answers live in [`bench/recordings/`](../bench/recordings/). Each one is filed under the sha256 fingerprint of its request.
- A results file is kept as written. To change a score, run the task again instead of editing the file.

## Outside reference points

Other groups publish these scores. They were not measured here, and they cannot be compared with webular's scores: the tasks, graders, and tool settings differ.

| Source | Date | Published scores |
| --- | --- | --- |
| [Artificial Analysis Search Index](https://artificialanalysis.ai/agents/search-api) | data as of 2026-10-19 | Exa 80, Perplexity 80, Octen 77, Parallel 75, Brave 75, Nimble 74, Firecrawl 73 |
| [NEEDLE](https://keenableai.github.io/needle/results/), run by Keenable's makers | no date given | Keenable 73%, Exa 68%, Perplexity 67%, Brave 66%, Parallel 62%, Firecrawl 52%, Tavily 44% |
| [openbenchmarks factual lookup](https://openbenchmarks.com/web-search) | 2026-10-02 | Exa 99.3%, Perplexity 97.3%, Linkup 96.7%, Firecrawl 95.3%, Nimble 94.3%, Tavily 87.7% |

Return to [the benchmark report](benchmarks.md) (navigation only).
