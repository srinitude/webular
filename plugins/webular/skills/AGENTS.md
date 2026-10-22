# plugins/webular/skills/AGENTS.md

This folder holds the skills the plugin ships. The plugin rules are in [AGENTS.md](../AGENTS.md).

## What lives here

- Two readability skills, kept as real file copies: `human-language` and `rich-and-native-markdown`.
- Two webular skills: `webular-interview` and `webular-research`.
- Each skill folder holds `SKILL.md` and may hold `evals`, `references`, and `scripts`.

## Rules

- Each skill lives at `skills/<name>/SKILL.md`, one level deep. Hosts look no deeper ([Agent Plugins spec 1.0.0, section 7.1](https://agent-plugins.org/specification)).
- The `name` in `SKILL.md` frontmatter equals the folder name. It uses lowercase letters, digits, and single hyphens, at most 64 characters, with no hyphen at either end. A host skips a skill with a bad name and says nothing ([VS Code Agent Skills](https://code.visualstudio.com/docs/agent-customization/agent-skills)).
- The `description` has 1 to 1024 characters. It says what the skill does and when to use it.
- Optional keys are `license`, `compatibility` (up to 500 characters), `metadata` (a map of strings to strings), and `allowed-tools` ([Agent Skills spec, repo agentskills/agentskills](https://agentskills.io/specification)).
- `SKILL.md` stays under 500 lines. Put long detail in `<skill>/references/`, one level deep, and link it from `SKILL.md`.
- Optional folders are `<skill>/scripts/`, `<skill>/references/`, and `<skill>/assets/`. The `evals` folder is our own addition ([Cursor skills docs, undated](https://cursor.com/docs/skills)).
- A host may list fewer keys than the spec. For example, Cursor lists `name`, `description`, `paths`, `disable-model-invocation`, `icon`, `color`, and `metadata`, not `compatibility` or `license`, so it most likely ignores those two ([Cursor skills docs, undated](https://cursor.com/docs/skills)).
- Every MCP tool a skill names exists on the live server. [`tests/contract/plugin-tools.test.ts`](../../../tests/contract/plugin-tools.test.ts) compares `tools/list` with the skills ([VS Code tools](https://code.visualstudio.com/docs/agents/run/tools)).
- An eval file has `skill_name` and `evals`. Each case has `id`, `prompt`, `expected_output`, and a non-empty `assertions` list.

## Checks

- `mise run plugin:check-evals` counts cases in each `<skill>/evals/evals.json`.
- `mise run plugin:check-reachable` finds a skill file that `SKILL.md` never links. It skips AGENTS.md files.
- `skills-ref validate <skill>` from [agentskills/agentskills](https://github.com/agentskills/agentskills) checks one skill folder against the spec. No mise task runs it, so CI does not.

## Children

- [human-language](human-language/AGENTS.md)
- [rich-and-native-markdown](rich-and-native-markdown/AGENTS.md)
- [webular-interview](webular-interview/AGENTS.md)
- [webular-research](webular-research/AGENTS.md)
