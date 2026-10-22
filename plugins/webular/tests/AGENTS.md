# plugins/webular/tests/AGENTS.md

This folder holds the plugin's tests. The plugin rules are in [AGENTS.md](../AGENTS.md).

## What lives here

- [mcp-harness.ts](mcp-harness.ts) is the shared harness. It starts one local site and a real stdio MCP client against the real server.
- Server tests: [`server.test.ts`](server.test.ts), [`http.test.ts`](http.test.ts), [`protocol.test.ts`](protocol.test.ts), [`startup.test.ts`](startup.test.ts), [`partial.test.ts`](partial.test.ts), [`commands.test.ts`](commands.test.ts), and [`cli-features.test.ts`](cli-features.test.ts).
- Contract tests: [`schemas.test.ts`](schemas.test.ts), [`descriptions.test.ts`](descriptions.test.ts), [`manifests.test.ts`](manifests.test.ts), [`plugin.test.ts`](plugin.test.ts), and [`bundle-fresh.test.ts`](bundle-fresh.test.ts).
- Eval tests: [`harness.test.ts`](harness.test.ts) and [`jev.test.ts`](jev.test.ts).
- Skill tests: [`skill-tools-sync.test.ts`](skill-tools-sync.test.ts) (the research skill and its tools.md match the registered tools and fields), [`skill-spec.test.ts`](skill-spec.test.ts), [`readability-drift.test.ts`](readability-drift.test.ts), [`readability-lint.test.ts`](readability-lint.test.ts), [`markdown-check.test.ts`](markdown-check.test.ts), [`human-language-evals.test.ts`](human-language-evals.test.ts), and [`markdown-evals.test.ts`](markdown-evals.test.ts).
- [readability-lint-exempt.json](readability-lint-exempt.json) lists the text that the readability lint skips.

## Rules

- A skill's rule lines are pinned by hash in [`readability-drift.test.ts`](readability-drift.test.ts). A reviewed change to a rule line needs a reviewed hash.
- [`skill-spec.test.ts`](skill-spec.test.ts) covers every skill folder. It checks frontmatter and the eval case shape.
- Disconnect every `MCPClient` a test owns, and bind HTTP mode to 127.0.0.1. Source: `@mastra/mcp` MCPClient.

## Checks

- `mise run plugin:test` runs this folder and rebuilds the bundle first.
- `mise run plugin:lint` checks the style of these files.
