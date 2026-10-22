# tests/e2e/AGENTS.md

The user-side surface, run against one local fixture server. The parent rules are in [tests/AGENTS.md](../AGENTS.md).

This folder has no `*.test.ts` files. `mise run e2e` runs [`run.ts`](run.ts), which prints one pass or FAIL line per case and exits non-zero on any failure.

## What lives here

- Cases as data: [`cases.ts`](cases.ts) (CLI cases), [`flag-cases.ts`](flag-cases.ts) (shared flags), [`mcp-cases.ts`](mcp-cases.ts) (MCP tool calls), [`plugin-cases.ts`](plugin-cases.ts) (plugin checks).
- Support: [`routes.ts`](routes.ts) (extra fixture routes), [`mcp.ts`](mcp.ts) (the stdio MCP client), [`surface.ts`](surface.ts) (the coverage map, built from the code), [`run.ts`](run.ts) (the runner).

## Rules

- Every command, flag, MCP tool, tool input, plugin tool, and skill needs at least one case. [`tests/quality/e2e-parity.test.ts`](../quality/e2e-parity.test.ts) fails when one has none.
- Each case states its exit code, its output size ceiling, and a latency budget.

## Checks

`mise run e2e`
