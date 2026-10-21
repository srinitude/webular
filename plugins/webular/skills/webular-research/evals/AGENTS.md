# plugins/webular/skills/webular-research/evals/AGENTS.md

This folder holds the eval cases of the webular-research skill. The skill rules are in [AGENTS.md](../AGENTS.md).

## What lives here

- `plugins/webular/skills/webular-research/evals/evals.json` holds the cases. They say when the skill should and should not trigger.

## Rules

- Give each case a unique id. `plugins/webular/evals/harness.json` maps every id to a grader.

## Checks

- `mise run plugin:check-evals` parses the file and counts its cases.
