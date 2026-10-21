# tests/bench/fixtures/set/AGENTS.md

A frozen task set for the set guards. The parent rules are in [tests/bench/fixtures/AGENTS.md](../AGENTS.md).

## What lives here

- [set.json](set.json): the frozen fixture tasks.
- [manifest.json](manifest.json): the sha256 of set.json, so the loader refuses edited bytes.

## Rules

- If you change set.json on purpose, update its hash in manifest.json in the same commit.

## Checks

`mise run test:file tests/bench/guards-set.test.ts`
