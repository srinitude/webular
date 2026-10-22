# tests/jev/AGENTS.md

This folder holds the tests for the Jev framework in [`src/lib/jev/`](../../src/lib/jev/), and it follows [tests/AGENTS.md](../AGENTS.md).

- `mise run jev:check` runs every test here.
- A test whose name ends in eval.test.ts runs a decision against its cases.
- [`tests/jev/evals/`](evals/) holds the cases, and [`tests/jev/replay/`](replay/) holds the recorded Jev answers.
- [`tests/jev/learn/`](learn/) holds the tests for the learning loop.
- [`tests/jev/docs-guard-support.ts`](docs-guard-support.ts) and [`tests/jev/work-count.ts`](work-count.ts) are helpers. They are not tests.
