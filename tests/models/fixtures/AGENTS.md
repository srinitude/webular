# tests/models/fixtures/AGENTS.md

This folder holds the kept results of model runs. It follows [tests/AGENTS.md](../../AGENTS.md).

- Each file whose name starts with models- is a copy of the results that one `mise run test:models` run wrote to `bench/results/`.
- A run is listed by model, surface, scenario, pass or fail, turns, and time.
- `tests/models/harness.test.ts` reads every one of these files. It checks that each run kept its raw output in `tests/models/fixtures/raw/`.
- Do not edit these files by hand. They are the proof of a real run.
