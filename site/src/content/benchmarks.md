# Benchmarks

Each tool got the same web jobs, checked against known right answers. Losses show as plainly as wins.

## The result

In the peer run of Oct. 22, 2026, all three scored tools tied on search: webular, Exa, and Firecrawl each scored 1.000 on 4 tasks. A score of 1 means every answer was right. Tavily and Perplexity had no scored calls: their calls were unsupported or had no recorded answers to grade.

Agent tests: 18 of 75 scored. Each one is one tool used by one AI agent model, across 3 models. The rest were skipped for lack of a key or an agent adapter.

| Tool | Key needed | Where it runs | In the peer run |
|---|---|---|---|
| webular | None (Jev is optional) | Your machine | Scored |
| Exa | Yes | Hosted API with its own search index | Scored |
| Firecrawl | Yes | Hosted API | Scored |
| Tavily | Yes | Hosted API | No scored calls |
| Perplexity | Yes | Hosted API | No scored calls |

## Where rivals lead

Exa, Brave, and Google run their own search indexes, and Exa reports citation precision, which this run does not measure. Brave and Google are not in the table above.

## How to read a score

The task sets are small, often 1 to 7 tasks per job, so treat a difference as a sign, not as proof. A missing score reads "did not run", never zero.

## The method

The [benchmarks guide](https://github.com/srinitude/webular/blob/main/docs/benchmarks-guide.md) says what was measured and why, and explains every term. The [method page](https://github.com/srinitude/webular/blob/main/docs/benchmarks-method.md) says how the benchmarks are run and how to run them again.

## The raw files

The [peer run](https://github.com/srinitude/webular/blob/main/bench/results/peers-2026-10-22T17-42-50-204Z.json) and the [agent run](https://github.com/srinitude/webular/blob/main/bench/results/models-2026-10-22-062400-merged.json) hold the raw results. [Benchmarks](https://github.com/srinitude/webular/blob/main/docs/benchmarks.md) and [Benchmarks by peer](https://github.com/srinitude/webular/blob/main/docs/benchmarks-peers.md) give every score.
