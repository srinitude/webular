# tests/models/AGENTS.md

The agent scenarios and their runner. The parent rules are in [tests/AGENTS.md](../AGENTS.md), which also explains the model runner.

## What lives here

- Scenarios: [`scenarios.json`](scenarios.json) (data: intent, outcome, eval, routes) and [`scenarios.ts`](scenarios.ts) (schema, loader, shared fixture).
- Evals: [`check.ts`](check.ts) gives the same list of problems for the same reply.
- Runner: [`run.ts`](run.ts) (the `mise run test:models` entry), [`jobs.ts`](jobs.ts) (the model, surface, and scenario grid, with arms in a seeded order), [`report.ts`](report.ts) (reads stream-json, writes the summary).
- Baseline: [`baseline.ts`](baseline.ts) runs each reference call against the fixture. [`baseline/`](baseline/) holds the raw output. See [tests/models/baseline/AGENTS.md](baseline/AGENTS.md).
- Guards: [guards.ts](guards.ts) checks track rows, and [tracks-dry-run.ts](tracks-dry-run.ts) records a dry run for them.
- Tests: [`harness.test.ts`](harness.test.ts), [`coverage.test.ts`](coverage.test.ts) (every command and MCP tool has a scenario on every surface), [guards.test.ts](guards.test.ts), and one test in each child folder.
- [agent/](agent/): the agent track. [grader/](grader/): the grader track. [fixtures/](fixtures/): kept run results.

## Rules

- Every scenario states its intent, outcome, and eval.
- Evals are code checks. They never use a model.
- The runner allows only the tools a surface needs.

## Checks

`mise run test:file tests/models`

## Children

- [agent/AGENTS.md](agent/AGENTS.md)
- [baseline/AGENTS.md](baseline/AGENTS.md)
- [fixtures/AGENTS.md](fixtures/AGENTS.md)
- [grader/AGENTS.md](grader/AGENTS.md)
