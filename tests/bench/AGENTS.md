# tests/bench/AGENTS.md

Benchmark tests and the scaling run. The parent rules are in [tests/AGENTS.md](../AGENTS.md). Benchmark integrity rules are in [scripts/bench/AGENTS.md](../../scripts/bench/AGENTS.md).

## What lives here

- [`peers-cases.test.ts`](peers-cases.test.ts) and [`peers-score.test.ts`](peers-score.test.ts) check the peer benchmark in [`scripts/bench/peers/`](../../scripts/bench/peers/): case markers, exact checks, per-provider summaries, and winners. Each other peers-NAME test checks one peer adapter.
- The guards-NAME tests check the bench guards: the set, the run, grading, and the report. [set-loader.test.ts](set-loader.test.ts) checks that the task sets load and that one edited byte is refused.
- [guards-requests.test.ts](guards-requests.test.ts), [peers-skip.test.ts](peers-skip.test.ts), and [robots-gold-rows.test.ts](robots-gold-rows.test.ts) check robots.txt in the bench. Every request is logged and a disallowed page is never fetched. A peer that cannot show its requests skips robots rows. Each robots gold row passes only for a compliant run.
- [agent-matrix.test.ts](agent-matrix.test.ts) checks the agent-model matrix: its arms, cells, and the README line it writes.
- [dataset-fetch.test.ts](dataset-fetch.test.ts) checks the dataset manifests, the hash check, and the cached hit, with a stub client and a local fixture.
- [fixtures/](fixtures/): fixed inputs for the guard tests.
- [`complexity.ts`](complexity.ts) is not a test. It times the hot paths at 10, 1,000, and 100,000 items and prints peak memory. `mise run bench` runs it.

## Checks

`mise run test:file tests/bench`

## Children

- [fixtures/AGENTS.md](fixtures/AGENTS.md)
