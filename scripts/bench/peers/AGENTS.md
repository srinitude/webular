# scripts/bench/peers/AGENTS.md

The peer benchmark that scores webular against other web research tools. The parent [AGENTS.md](../AGENTS.md) holds the integrity rules.

## What lives here

- [run.ts](run.ts): the entry. It replays recordings, or calls peers with `--live`. Other flags: `--seed N`, `--cold`, `--judge`, `--runs N`, `--peers a,b`, and `--max-calls N`.
- [providers.ts](providers.ts): webular and one Effect Layer per peer. A peer with no key is skipped, and the report says so. Jina Reader runs without a key on its free limits.
- [peers.ts](peers.ts): the Firecrawl, Exa, Tavily, and Perplexity adapters, with each peer's published prices. Every other hosted peer has its own adapter file named after it, such as [apify.ts](apify.ts) and [serper.ts](serper.ts).
- [baselines.ts](baselines.ts): free local baselines. A missing tool is skipped, never faked.
- [awaiting-approval.ts](awaiting-approval.ts): peers that need a cost, a card, or a cloud project the user has not approved. The report shows them as skipped.
- [model.ts](model.ts), [tasks.ts](tasks.ts), and [score.ts](score.ts): the provider contract and metric registry, the tasks, and the pure scoring functions.
- [order.ts](order.ts): the seeded arm and task order, with ABBA pairs.
- [cache.ts](cache.ts): the cache folder for each round, and the `cached` flag.
- [family.ts](family.ts): paired tests per task family, and the shared-task headline.
- [grade.ts](grade.ts): the answer-field grader and the judge gate.
- [timeout.ts](timeout.ts): the 60 s call timeout, and latency that keeps failed rows.
- [report.ts](report.ts): the text report.
- [keys.ts](keys.ts): reads a peer key from the environment, then the macOS Keychain.
- [cases.ts](cases.ts): joins Jev calibration rows to bench cases.

## Rules

- Scoring stays pure. A score never depends on the order tools ran in.
- Add a peer as one Layer that owns its HTTP client and its key.
- Every round has a seed. The results file and each row keep it.
- Compare two arms only on the tasks both scored, one family at a time.
- Every call uses the 60 s timeout, webular's too. An error row counts as 60 s in latency.
- Live runs write recordings under [`bench/results/`](../../../bench/results/), in a `recordings` folder. They never overwrite [`bench/recordings/`](../../../bench/recordings/).
- The judge decides a grade only when its calibration passes: kappa at least 0.8, accuracy at least 95%, and at least 200 items.
- Give each adapter a test in [tests/bench/](../../../tests/bench/) named `peers-<peer>.test.ts`.

## Checks

```bash
mise run test:file tests/bench/peers-score.test.ts tests/bench/peers-cases.test.ts tests/bench/peers-baselines.test.ts
mise run test:file tests/bench/peers-order.test.ts tests/bench/peers-cache.test.ts tests/bench/peers-family.test.ts tests/bench/peers-grade.test.ts
```
