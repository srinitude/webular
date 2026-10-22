# scripts/bench/peers/AGENTS.md

The peer benchmark that scores webular against other web research tools. The parent [AGENTS.md](../AGENTS.md) holds the integrity rules.

## What lives here

- `scripts/bench/peers/run.ts`: the entry. It replays recordings, or calls peers with `--live`. Other flags: `--seed N`, `--cold`, `--judge`, `--runs N`, `--peers a,b`, and `--max-calls N`.
- `scripts/bench/peers/providers.ts`: webular and one Effect Layer per peer. A peer with no key is skipped, and the report says so.
- `scripts/bench/peers/tasks.ts` and `scripts/bench/peers/score.ts`: the tasks and the pure scoring functions.
- `scripts/bench/peers/order.ts`: the seeded arm and task order, with ABBA pairs.
- `scripts/bench/peers/cache.ts`: the cache folder for each round, and the `cached` flag.
- `scripts/bench/peers/family.ts`: paired tests per task family, and the shared-task headline.
- `scripts/bench/peers/grade.ts`: the answer-field grader and the judge gate.
- `scripts/bench/peers/timeout.ts`: the 60 s call timeout, and latency that keeps failed rows.
- `scripts/bench/peers/report.ts`: the text report.
- `scripts/bench/peers/cases.ts`: joins Jev calibration rows to bench cases.

## Rules

- Scoring stays pure. A score never depends on the order tools ran in.
- Add a peer as one Layer that owns its HTTP client and its key.
- Every round has a seed. The results file and each row keep it.
- Compare two arms only on the tasks both scored, one family at a time.
- Every call uses the 60 s timeout, webular's too. An error row counts as 60 s in latency.
- Live runs write recordings under `bench/results/recordings/`. They never overwrite `bench/recordings/`.
- The judge decides a grade only when its calibration passes: kappa at least 0.8, accuracy at least 95%, and at least 200 items.

## Checks

```bash
mise run test:file tests/bench/peers-score.test.ts tests/bench/peers-cases.test.ts
mise run test:file tests/bench/peers-order.test.ts tests/bench/peers-cache.test.ts tests/bench/peers-family.test.ts tests/bench/peers-grade.test.ts
```
