# plugins/webular/tests/AGENTS.md

This folder holds the plugin's tests. The plugin rules are in [AGENTS.md](../AGENTS.md).

## What lives here

- `plugins/webular/tests/mcp-harness.ts` is the shared harness. It starts one local site and a real stdio MCP client against the real server.
- Server tests: `server.test.ts`, `http.test.ts`, `protocol.test.ts`, `startup.test.ts`, and `partial.test.ts`.
- Contract tests: `schemas.test.ts`, `descriptions.test.ts`, `manifests.test.ts`, `plugin.test.ts`, and `bundle-fresh.test.ts`.
- Skill tests: `skill-spec.test.ts`, `readability-drift.test.ts`, `readability-lint.test.ts`, and the two skill eval tests.
- `plugins/webular/tests/readability-lint-exempt.json` lists the text that the readability lint skips.

## Rules

- A skill's rule lines are pinned by hash in `readability-drift.test.ts`. A reviewed change to a rule line needs a reviewed hash.
- `skill-spec.test.ts` covers the two readability skills. It checks frontmatter and the eval case shape.
- Disconnect every `MCPClient` a test owns, and bind HTTP mode to 127.0.0.1. Source: `@mastra/mcp` MCPClient.

## Checks

- `mise run plugin:test` runs this folder and rebuilds the bundle first.
- `mise run plugin:lint` checks the style of these files.
- `plugins/webular/tests/skill-spec.test.ts:10` lists two of the four skills.
- `skill-spec.test.ts` has no check for "anthropic" or "claude" in a name, a "Use when" clause, backslash paths, year-anchored phrases, `expected_output`, 8 to 10 trigger queries each way, or `webular:<tool>` names.
