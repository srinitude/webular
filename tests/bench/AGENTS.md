# tests/bench/AGENTS.md

Benchmark tests and the scaling run. The parent rules are in [tests/AGENTS.md](../AGENTS.md). Benchmark integrity rules are in [scripts/bench/AGENTS.md](../../scripts/bench/AGENTS.md).

- `peers-cases.test.ts` and `peers-score.test.ts` check the peer benchmark in `scripts/bench/peers/`: case markers, exact checks, per-provider summaries, and winners.
- `complexity.ts` is not a test. It times the hot paths at 10, 1,000, and 100,000 items and prints peak memory. `mise run bench` runs it.

## Checks

`mise run test:file tests/bench`
