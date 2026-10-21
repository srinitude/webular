# plugins/webular/skills/rich-and-native-markdown/AGENTS.md

This folder holds the rich-and-native-markdown skill, a real copy of the readability skill. The skills rules are in [AGENTS.md](../AGENTS.md).

## What lives here

- `plugins/webular/skills/rich-and-native-markdown/SKILL.md` is the skill. It turns text into clear Markdown and keeps its meaning and exact data.
- `plugins/webular/skills/rich-and-native-markdown/evals/evals.json` holds five eval cases.
- `plugins/webular/skills/rich-and-native-markdown/references/` holds three guides that `SKILL.md` links.
- `plugins/webular/skills/rich-and-native-markdown/scripts/check.ts` is the optional file checker. Bun runs it.

## Rules

- A change to a rule line in `SKILL.md` needs a reviewed hash in `plugins/webular/tests/readability-drift.test.ts`.

## Checks

- `mise run plugin:test` runs the drift, spec, and eval tests, and the checker tests for this skill.

## Children

- [evals](evals/AGENTS.md)
- [references](references/AGENTS.md)
- [scripts](scripts/AGENTS.md)
