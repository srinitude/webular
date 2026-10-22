# tests/contract/AGENTS.md

The contract an agent depends on. The parent rules are in [tests/AGENTS.md](../AGENTS.md). Changing an exit code, a `--json` shape, or an MCP tool name needs a yes first ([docs/agent-contract.md](../../docs/agent-contract.md)).

## What lives here

- CLI: [cli.test.ts](cli.test.ts) (source: `--help`, usage errors with exit 2, `--json` that decodes with each workflow schema), [cli-built.test.ts](cli-built.test.ts) (the same against the built `dist/bin/webular`).
- MCP: [mcp.test.ts](mcp.test.ts) (inputs match CLI flags, errors, paging), [mcp-enums.test.ts](mcp-enums.test.ts) (scrape and search enums match the CLI), [mcp-gaps.test.ts](mcp-gaps.test.ts) (output schemas and error text), [web-tool-args.test.ts](web-tool-args.test.ts) (a `web.*` tool refuses a non-web URL scheme and an unknown argument before any work runs), [mcp-env.test.ts](mcp-env.test.ts) (the host env for a stdio server keeps `MISE_TRUSTED_CONFIG_PATHS` only when the host sets it), with [_mcp-flags.ts](_mcp-flags.ts) reading the real flag specs.
- Plugin: [plugin-tools.test.ts](plugin-tools.test.ts) (every tool a skill names exists on the real server), [skills.test.ts](skills.test.ts) (skill and manifest pointers are real).

## Rules

- Read flags and schemas from the code, never a copy.
- [`cli-built.test.ts`](cli-built.test.ts) needs `mise run build` first.

## Checks

`mise run test:file tests/contract`
