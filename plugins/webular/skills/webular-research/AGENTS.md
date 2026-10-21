# plugins/webular/skills/webular-research/AGENTS.md

This folder holds the webular-research skill. The skills rules are in [AGENTS.md](../AGENTS.md).

## What lives here

- `plugins/webular/skills/webular-research/SKILL.md` is the skill. It researches the web through the plugin's MCP tools: search, read a page as Markdown, map a site, and pull key sentences.
- `plugins/webular/skills/webular-research/evals/evals.json` holds seven eval cases.
- `plugins/webular/skills/webular-research/references/tools.md` is the tool reference.

## Rules

- The skill needs Bun and the plugin's MCP server, over stdio or HTTP.
- Tool names in the skill and in tools.md match the tools in `plugins/webular/src/commands.ts`.

## Checks

- `mise run plugin:test` runs the server and description tests that name these tools.

## Children

- [evals](evals/AGENTS.md)
- [references](references/AGENTS.md)
