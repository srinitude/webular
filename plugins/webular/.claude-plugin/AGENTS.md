# plugins/webular/.claude-plugin/AGENTS.md

This folder holds the manifest Claude Code reads to load the plugin. The plugin rules are in [AGENTS.md](../AGENTS.md).

## What lives here

- `plugins/webular/.claude-plugin/plugin.json` names the plugin and describes what it ships.

## Rules

- Keep this folder to the manifest alone. Skills, tools, and docs live in the plugin folder above it.
- The name, description, and parts in this manifest must match `plugins/webular/plugin.json`, `plugins/webular/mcp.json`, and `plugins/webular/.mcp.json`. `plugins/webular/tests/manifests.test.ts` compares them.
- The name is kebab-case and not reserved. Set `author.name`, a URL `homepage`, and an SPDX `license`, and add no other top-level keys, since Claude Code drops them ([Claude Code plugins reference](https://code.claude.com/docs/en/plugins-reference)).
- Ship a square PNG or JPEG icon of 512 to 2048 px for the plugin directory ([Claude Code plugins reference](https://code.claude.com/docs/en/plugins-reference)).

## Checks

- `mise run plugin:test` runs the manifest test.
- `claude plugin validate plugins/webular` warns `ICON_MISSING` for `plugins/webular/.claude-plugin/plugin.json`, and CI does not run it with warnings as failures.
