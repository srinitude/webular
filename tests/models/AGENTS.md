# tests/models/AGENTS.md

The agent scenarios and their runner. The parent rules are in [tests/AGENTS.md](../AGENTS.md), which also explains the model runner.

## What lives here

- Scenarios: `scenarios.json` (data: intent, outcome, eval, routes) and `scenarios.ts` (schema, loader, shared fixture).
- Evals: `check.ts` gives the same problems list for the same reply.
- Runner: `run.ts` (the `mise run test:models` entry), `jobs.ts` (the model, surface, and scenario grid), `report.ts` (reads stream-json, writes the summary).
- Baseline: `baseline.ts` runs each reference call against the fixture. `baseline/` holds the raw output. See [tests/models/baseline/AGENTS.md](baseline/AGENTS.md).
- `harness.test.ts` is the only test. It runs in CI.

## Rules

- Every scenario states its intent, outcome, and eval.
- Evals are code checks. They never use a model.
- The runner allows only the tools a surface needs.

## Checks

`mise run test:file tests/models`
