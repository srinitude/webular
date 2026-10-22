# tests/bench/AGENTS.md

Benchmark tests and the scaling run. The parent rules are in [tests/AGENTS.md](../AGENTS.md). Benchmark integrity rules are in [scripts/bench/AGENTS.md](../../scripts/bench/AGENTS.md).

## What lives here

- [`peers-cases.test.ts`](peers-cases.test.ts) and [`peers-score.test.ts`](peers-score.test.ts) check the peer benchmark in [`scripts/bench/peers/`](../../scripts/bench/peers/): case markers, exact checks, per-provider summaries, and winners. Each other peers-NAME test checks one peer adapter.
- [`peers-map.test.ts`](peers-map.test.ts) checks the map job: the Firecrawl and Tavily request shapes, and that a map task passes only when every gold page is listed.
- [`peers-extract.test.ts`](peers-extract.test.ts) checks the extract job: the Firecrawl request shape, the gold grading, and the task count.
- The [research](peers-research.test.ts), [crawl](peers-crawl.test.ts), [batch](peers-batch.test.ts), [summarize](peers-summarize.test.ts), [monitor](peers-monitor.test.ts), [parse](peers-parse.test.ts), [media](peers-media.test.ts), and [act](peers-act.test.ts) tests each check one job: its request shapes and its gold grading.
- [command-parity.test.ts](command-parity.test.ts) fails when a command in the parity map neither passes nor has a written ceiling in the committed run.
- The guards-NAME tests check the bench guards: the set, the run, grading, and the report. [set-loader.test.ts](set-loader.test.ts) checks that the task sets load and that one edited byte is refused.
- [grade-semantic.test.ts](grade-semantic.test.ts) checks the answer grader: number grammar, answer extraction, hedges, and shotgun lists.
- [answer-quality-stats.test.ts](answer-quality-stats.test.ts) checks the Wilson interval, the kappa report, the closed-book ratio column, and the small-sample note in the report.
- [guards-requests.test.ts](guards-requests.test.ts), [peers-skip.test.ts](peers-skip.test.ts), and [robots-gold-rows.test.ts](robots-gold-rows.test.ts) check robots.txt in the bench. Every request is logged, and a disallowed page is never fetched. A peer that cannot show its requests skips robots rows. Each robots gold row passes only for a compliant run.
- [agent-matrix.test.ts](agent-matrix.test.ts) checks the agent-model matrix: its arms, cells, and the README line it writes.
- [scrape-accuracy.test.ts](scrape-accuracy.test.ts) scores offline main-content recall and leak on the scrape.page fixtures.
- [search-gold.test.ts](search-gold.test.ts) checks, offline, how the search gold-set eval counts a hit. A gold URL counts only when, after normalization, it sits in the first 10 distinct result URLs.
- [dataset-fetch.test.ts](dataset-fetch.test.ts) checks the dataset manifests, the hash check, and the cached hit, with a stub client and a local fixture.
- [scoreboard.test.ts](scoreboard.test.ts) fails in three cases: [bench/scoreboard.json](../../bench/scoreboard.json) or the table in [docs/scoreboard.md](../../docs/scoreboard.md) drifts from the generator, a command has no rows, or a measured row names an eval file that does not exist.
- [rescore.test.ts](rescore.test.ts) checks that the rescore drops problems the stored rules raised by mistake, keeps the real ones, and labels each miss.
- [bench-artifacts-minimal.test.ts](bench-artifacts-minimal.test.ts) keeps only the benchmark files that something reads. [bench/results](../../bench/results/) may hold only the peer run with the highest timestamp, the agent run the docs generator picks, and runs that a ceilings file cites. Each file in [bench/datasets](../../bench/datasets/) must be named in code, tests, or [mise.toml](../../mise.toml).
- [fixtures/](fixtures/): fixed inputs for the guard tests.
- [`complexity.ts`](complexity.ts) is not a test. It times the hot paths at 10, 1,000, and 100,000 items and prints peak memory. `mise run bench` runs it.

## Checks

`mise run test:file tests/bench`

## Children

- [fixtures/AGENTS.md](fixtures/AGENTS.md)
