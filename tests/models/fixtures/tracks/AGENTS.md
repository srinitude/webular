# tests/models/fixtures/tracks/AGENTS.md

A recorded dry run of the model tracks. The parent rules are in [tests/models/fixtures/AGENTS.md](../AGENTS.md).

## What lives here

- [dry-run.json](dry-run.json): the arms and rows from one dry run. [tracks-dry-run.ts](../../tracks-dry-run.ts) writes it, and [guards.test.ts](../../guards.test.ts) reads it.

## Rules

- Write this file again with tracks-dry-run.ts, never by hand.

## Checks

`mise run test:file tests/models/guards.test.ts`
