# plugins/webular/skills/human-language/AGENTS.md

This folder holds the human-language skill, a real copy of the readability skill. The skills folder rules are in [AGENTS.md](../AGENTS.md).

## What lives here

- [`plugins/webular/skills/human-language/SKILL.md`](SKILL.md) is the skill. It sets plain prose at about grade 6 for CLI help, tool descriptions, and Jev payloads.
- [`plugins/webular/skills/human-language/evals/evals.json`](evals/evals.json) holds six eval cases.
- [`plugins/webular/skills/human-language/references/situations.md`](references/situations.md) holds the situation guide.
- [`plugins/webular/skills/human-language/scripts/plain.ts`](scripts/plain.ts) holds the word rules as code. Bun runs it.

## Rules

- A change to a rule line in [`SKILL.md`](SKILL.md) needs a reviewed hash in [`plugins/webular/tests/readability-drift.test.ts`](../../tests/readability-drift.test.ts).
- The plugin code imports plain.ts, so keep its exports in step with its users.

## Checks

- `mise run plugin:test` runs the drift, spec, lint, and eval tests for this skill.

## Children

- [evals](evals/AGENTS.md)
- [references](references/AGENTS.md)
- [scripts](scripts/AGENTS.md)
