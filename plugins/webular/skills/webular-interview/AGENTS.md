# plugins/webular/skills/webular-interview/AGENTS.md

This folder holds the webular-interview skill. The skills rules are in [AGENTS.md](../AGENTS.md).

## What lives here

- `plugins/webular/skills/webular-interview/SKILL.md` is the skill. It asks one question at a time to settle intent, outcome, done-when criteria, proof, and boundaries before work starts.
- `plugins/webular/skills/webular-interview/evals/evals.json` holds three eval cases.
- `plugins/webular/skills/webular-interview/references/questions.md` is the question bank.

## Rules

- The skill uses the host's own question tool when there is one, and works in any agent host.

## Checks

- `mise run plugin:check-evals` fails if the eval file drops below three cases.

## Children

- [evals](evals/AGENTS.md)
- [references](references/AGENTS.md)
