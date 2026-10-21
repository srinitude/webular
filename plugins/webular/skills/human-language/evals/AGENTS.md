# plugins/webular/skills/human-language/evals/AGENTS.md

This folder holds the eval cases of the human-language skill. The skill rules are in [AGENTS.md](../AGENTS.md).

## What lives here

- `plugins/webular/skills/human-language/evals/evals.json` holds the cases. `plugins/webular/tests/human-language-evals.test.ts` runs them against plain.ts.

## Rules

- Give each case a unique id. `plugins/webular/evals/harness.json` maps every id to a grader.
- Write assertions that proseIssues can judge, or that a reader can check on the text.

## Checks

- `mise run plugin:test` runs the eval test.
