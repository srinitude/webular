# tests/bench/fixtures/AGENTS.md

Fixed inputs for the bench guard tests. The parent rules are in [tests/bench/AGENTS.md](../AGENTS.md).

## What lives here

- [set/](set/): a small frozen task set and its manifest. [guards-set.test.ts](../guards-set.test.ts) reads it.
- [recordings/](recordings/): recorded result rows per provider. [guards-run.test.ts](../guards-run.test.ts) reads them. They are exempt from AGENTS.md coverage.

## Rules

- Never edit a fixture by hand.
- Change a fixture only in the same commit as the test that reads it.

## Checks

`mise run test:file tests/bench/guards-set.test.ts tests/bench/guards-run.test.ts`

## Children

- [set/AGENTS.md](set/AGENTS.md)
