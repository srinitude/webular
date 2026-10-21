# bench/AGENTS.md

Benchmark data and inputs. The root [AGENTS.md](../AGENTS.md) holds the repo-wide rules. [scripts/bench/AGENTS.md](../scripts/bench/AGENTS.md) holds the integrity rules.

## What lives here

- `bench/recordings/`: recorded peer responses, keyed by the sha256 of each request.
- `bench/results/`: scored results and reports from each run.
- [fixtures/](fixtures/): local pages and sites that the fixture server serves.
- [spec/](spec/): the benchmark spec.
- [tasks/](tasks/): the frozen task sets.

## Rules

- Bench tasks write the recordings and results folders. Both are exempt from the AGENTS.md coverage rule.
- A result file is kept as written. Rerun the task instead of editing a score.

## Checks

```bash
mise run bench:peers
```

## Children

- [fixtures/AGENTS.md](fixtures/AGENTS.md)
- [spec/AGENTS.md](spec/AGENTS.md)
- [tasks/AGENTS.md](tasks/AGENTS.md)
