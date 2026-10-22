# bench/AGENTS.md

Benchmark data and inputs. The root [AGENTS.md](../AGENTS.md) holds the repo-wide rules. [scripts/bench/AGENTS.md](../scripts/bench/AGENTS.md) holds the integrity rules.

## What lives here

- [`bench/recordings/`](recordings/): recorded peer responses, keyed by the sha256 of each request.
- [`bench/results/`](results/): scored results and reports from each run.
- [datasets/](datasets/): manifests for public datasets that `mise run bench:data` downloads into the gitignored cache. The data is never committed.
- [fixtures/](fixtures/): local pages and sites that the fixture server serves.
- [`scoreboard.json`](scoreboard.json): every metric for every command, with its value, eval, and set. `mise run bench:scoreboard` writes it. Never edit it by hand.
- [`command-parity-ceilings.json`](command-parity-ceilings.json): a written ceiling, with its reason and evidence, for each command that cannot match the rivals. [tests/bench/command-parity.test.ts](../tests/bench/command-parity.test.ts) reads it.
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

- [datasets/AGENTS.md](datasets/AGENTS.md)
- [fixtures/AGENTS.md](fixtures/AGENTS.md)
- [spec/AGENTS.md](spec/AGENTS.md)
- [tasks/AGENTS.md](tasks/AGENTS.md)
