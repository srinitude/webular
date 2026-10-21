# tests/contract/AGENTS.md

The contract an agent depends on. The parent rules are in [tests/AGENTS.md](../AGENTS.md). Changing an exit code, a `--json` shape, or an MCP tool name needs a yes first ([docs/agent-contract.md](../../docs/agent-contract.md)).

## What lives here

- CLI: `cli.test.ts` (source: `--help`, usage errors with exit 2, `--json` that decodes with each workflow schema), `cli-built.test.ts` (the same against the built `dist/bin/webular`).
- MCP: `mcp.test.ts` (inputs match CLI flags, errors, paging), `mcp-gaps.test.ts` (output schemas and error text), `mcp-env.test.ts` (the trust variable survives a host's minimal env), with `_mcp-flags.ts` reading the real flag specs.
- Plugin: `plugin-tools.test.ts` (every tool a skill names exists on the real server), `skills.test.ts` (skill and manifest pointers are real).

## Rules

- Read flags and schemas from the code, never a copy.
- `cli-built.test.ts` needs `mise run build` first.

## Checks

`mise run test:file tests/contract`
