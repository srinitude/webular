# plugins/webular/evals/AGENTS.md

This folder holds the plugin-level evals. The skill evals live in each skill folder. The plugin rules are in [AGENTS.md](../AGENTS.md).

## What lives here

- `plugins/webular/evals/decisions.json` lists fixed-label yes/no judgments. Each has an id and a question about its `input`.
- `plugins/webular/evals/jev.ts` builds one Jev classifier scorer per decision. A scorer asks Jev one yes/no Choice and scores yes as 1 and no as 0.
- `plugins/webular/evals/harness.json` maps every test name and every skill eval id to an assertion, a source test, a kind, and a grader.

## Rules

- Each test and each skill eval id gets an entry in `harness.json`. `plugins/webular/tests/harness.test.ts` fails on a gap.
- Question text in `decisions.json` passes the readability lint in `plugins/webular/tests/readability-lint.test.ts`.

## Checks

- `mise run plugin:check-evals` parses `harness.json`.
- `mise run plugin:test` runs the harness, Jev, and lint tests.
