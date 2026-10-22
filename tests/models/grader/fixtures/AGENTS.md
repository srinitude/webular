# tests/models/grader/fixtures/AGENTS.md

Fixed inputs for the grader checks. The parent rules are in [tests/models/grader/AGENTS.md](../AGENTS.md).

## What lives here

- [gold.json](gold.json): the gold labels for each rubric item.
- [recorded.json](recorded.json): recorded judgments that the offline cross-check replays.

## Rules

- Never edit a recorded judgment by hand.
- Change a gold label only with its reason in the commit message.

## Checks

`mise run test:file tests/models/grader/grader.test.ts`
