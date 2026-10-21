# plugins/webular/skills/human-language/references/AGENTS.md

This folder holds the detail the human-language skill loads on demand. The skill rules are in [AGENTS.md](../AGENTS.md).

## What lives here

- `plugins/webular/skills/human-language/references/situations.md` is a table of situations. Each row gives a section, when to use it, when not to, and related sections.

## Rules

- Every section in the table has a heading with the same name, so the anchors resolve.
- Keep the file linked from SKILL.md, or the reachable check fails.

## Checks

- `mise run plugin:check-links` resolves the anchors in the table.
