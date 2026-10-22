# plugins/webular/AGENTS.md

This folder is the agent plugin. The root [AGENTS.md](../../AGENTS.md) holds the repo-wide rules, and users start at [README.md](README.md).

## Rules

- The plugin folder runs on its own. Its server calls the `webular` command from `WEBULAR_BIN`, or from `PATH` when that is unset, and imports nothing from the repo [`src/`](src/).
- After any change to [`src/`](src/), run `mise run plugin:bundle` and commit [`dist/server.js`](dist/server.js). [`tests/bundle-fresh.test.ts`](tests/bundle-fresh.test.ts) fails on a stale bundle.
- The whole `tools/list` reply stays at or under 4,850 tokens ([`tests/commands/tokens.test.ts`](../../tests/commands/tokens.test.ts) in the repo root). Tool descriptions live in [`src/descriptions.json`](src/descriptions.json).
- Each tool result holds at most 8,000 characters. Longer results page with a `cursor`.
- Each file in [`src/`](src/) has a test that names or imports it.
- Each skill has at least 3 eval cases, and every file in a skill folder is linked from its `SKILL.md`. Skills follow the [agentskills.io specification](https://agentskills.io/specification).
- The built-in readability skills are real file copies, never symlinks.
- No MCP App views and no `ui` resources. Every tool answers with text and structured data ([MCP specification](https://modelcontextprotocol.io/specification)).
- Keep the bundled [`dist/server.js`](dist/server.js) as the MCP entry, so a host starts it without transpiling ([Bun bundler](https://bun.com/docs/bundler)).
- HTTP mode runs calls side by side. Gate admission across calls, so concurrent batch calls share one budget. Source: Mastra `workflow.ts`.
- Change [`.claude-plugin/plugin.json`](.claude-plugin/plugin.json), [`plugin.json`](plugin.json), [`mcp.json`](mcp.json), and [`.mcp.json`](.mcp.json) together. [`tests/manifests.test.ts`](tests/manifests.test.ts) checks that they agree.
- [`plugin.json`](plugin.json) sets `$schema` to the `1.0.0` plugin schema and uses only that schema's keys. `author` holds only `name`, `email`, and `url` ([Agent Plugins `1.0.0`](https://agent-plugins.org/specification)).
- The plugin name is 1 to 64 of `a-z`, `0-9`, `-`, and `.`, alphanumeric at each end, with no `--`, `..`, slash, or colon ([Agent Plugins `1.0.0`](https://agent-plugins.org/specification)).
- `version` uses SemVer. Raise it in every manifest and [`package.json`](package.json) per release ([VS Code plugin reference](https://code.visualstudio.com/docs/agents/reference/agent-plugin-reference)).
- [`mcp.json`](mcp.json) holds only `$schema` (the `1.0.0` MCP schema, same version as [`plugin.json`](plugin.json)) and `mcpServers`, and each server sets `type`. VS Code's own file uses `servers` instead ([Agent Plugins `1.0.0`](https://agent-plugins.org/specification), [VS Code MCP config](https://code.visualstudio.com/docs/agents/reference/mcp-configuration)).
- A stdio `command` is one bare name or a `./` path. Args are relative to the plugin root, where the server starts. [`.mcp.json`](.mcp.json) uses `${CLAUDE_PLUGIN_ROOT}` in args only, and Cursor reads `${CURSOR_PLUGIN_ROOT}` ([Cursor plugins](https://cursor.com/docs/plugins)).
- Manifests hold no secrets, no dev URL, no `..`, and no absolute path. `env` never sets `PLUGIN_ROOT` or `PLUGIN_DATA`, and the server needs no variable that [`mcp.json`](mcp.json) does not set ([Agent Plugins `1.0.0`](https://agent-plugins.org/specification)).
- [`README.md`](README.md) names Bun, gives the start command from [`mcp.json`](mcp.json), and has install steps for each host it claims, since hosts start it unprompted ([VS Code agent plugins](https://code.visualstudio.com/docs/agent-customization/agent-plugins)).

## Checks

```bash
mise run plugin:ci       # lint, typecheck, the six checks, evals, and tests
mise run plugin:bundle   # rebuild dist/server.js, the file mcp.json starts
mise run plugin:dev      # serve MCP over HTTPS at webular-mcp.localhost
```

