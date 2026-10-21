# scripts/bench/peers/AGENTS.md

The peer benchmark that scores webular against other web research tools. The parent [AGENTS.md](../AGENTS.md) holds the integrity rules.

## What lives here

- `scripts/bench/peers/run.ts`: the entry. It replays recordings, or calls peers with `--live`.
- `scripts/bench/peers/providers.ts`: webular and one Effect Layer per peer. A peer with no key is skipped, and the report says so.
- `scripts/bench/peers/tasks.ts` and `scripts/bench/peers/score.ts`: the tasks and the pure scoring functions.
- `scripts/bench/peers/cases.ts`: joins Jev calibration rows to bench cases.

## Rules

- Scoring stays pure. A score never depends on the order tools ran in.
- Add a peer as one Layer that owns its HTTP client and its key.

## Checks

```bash
mise run test:file tests/bench/peers-score.test.ts tests/bench/peers-cases.test.ts
```
