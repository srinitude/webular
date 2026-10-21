# bench/AGENTS.md

Benchmark data that the bench tasks write. The root [AGENTS.md](../AGENTS.md) holds the repo-wide rules. [scripts/bench/AGENTS.md](../scripts/bench/AGENTS.md) holds the integrity rules.

## What lives here

- `bench/recordings/`: recorded peer responses, keyed by the sha256 of each request.
- `bench/results/`: scored results and reports from each run.

## Rules

- Tasks write both folders, and both are exempt from the AGENTS.md coverage rule.
- A result file is kept as written. Rerun the task instead of editing a score.

## Checks

```bash
mise run bench:peers
```
