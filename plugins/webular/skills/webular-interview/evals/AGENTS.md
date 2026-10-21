# plugins/webular/skills/webular-interview/evals/AGENTS.md

This folder holds the eval cases of the webular-interview skill. The skill rules are in [AGENTS.md](../AGENTS.md).

## What lives here

- `plugins/webular/skills/webular-interview/evals/evals.json` holds the cases.

## Rules

- Give each case a unique id. `plugins/webular/evals/harness.json` maps every id to a grader.

## Checks

- `mise run plugin:test` runs `plugins/webular/tests/harness.test.ts`, which reads these ids.
