# .claude-plugin/AGENTS.md

The plugin marketplace for this repo; the root [AGENTS.md](../AGENTS.md) holds the repo-wide rules.

## What lives here

- `.claude-plugin/marketplace.json`: lists the webular plugin in `plugins/webular/` for `/plugin install`.

## Rules

- The marketplace entry and `plugins/webular/.claude-plugin/plugin.json` name the same plugin. Source: [Claude Code plugin marketplaces](https://code.claude.com/docs/en/plugin-marketplaces).
- The file holds `name` (letters, digits, `.`, `_`, and `-` only, never a reserved name), `owner.name`, a top-level `description`, and `plugins`. Source: [Claude Code marketplace reference, CC 2.1.306](https://code.claude.com/docs/en/plugins/marketplace-reference).
- Each entry has a `name` and a `source` that starts with `./` and holds no `..`, so VS Code resolves it too. An entry sets no `version`, because plugin.json owns it. Sources: [Claude Code marketplace reference, CC 2.1.306](https://code.claude.com/docs/en/plugins/marketplace-reference), [VS Code agent plugins](https://code.visualstudio.com/docs/agent-customization/agent-plugins).
- The entry `description` equals the plugin.json description, because hosts show the marketplace text. Source: [Cursor plugins reference](https://cursor.com/docs/reference/plugins).
- Cursor imports a repo marketplace only from .cursor-plugin/marketplace.json, with the same name, owner, and plugins. Source: [Cursor plugins reference](https://cursor.com/docs/reference/plugins).

## Checks

```bash
mise run test:file plugins/webular/tests/manifests.test.ts
```

- marketplace.json:1 has no top-level `description`.
- marketplace.json:8 says "two skills", but plugin.json:4 says four.
- .cursor-plugin/marketplace.json is missing.
