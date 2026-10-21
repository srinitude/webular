# plugins/webular/skills/rich-and-native-markdown/evals/AGENTS.md

This folder holds the eval cases of the rich-and-native-markdown skill. The skill rules are in [AGENTS.md](../AGENTS.md).

## What lives here

- `plugins/webular/skills/rich-and-native-markdown/evals/evals.json` holds the cases. `plugins/webular/tests/markdown-evals.test.ts` runs them against check.ts.

## Rules

- Give each case a unique id. `plugins/webular/evals/harness.json` maps every id to a grader.

## Checks

- `mise run plugin:test` runs the eval test.
