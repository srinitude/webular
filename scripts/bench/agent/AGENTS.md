# scripts/bench/agent/AGENTS.md

MCP wrappers for the agent track. The parent rules are in [scripts/bench/AGENTS.md](../AGENTS.md).

## What lives here

- [wrapper.ts](wrapper.ts): a thin MCP stdio server for a web provider with no official MCP server. It gives that provider the same answer, fetch, and search tools as the other peer arms. Run it as `bun scripts/bench/agent/wrapper.ts jina`.

## Rules

- Keep a wrapper a plain pass-through. Add no retries, caching, or ranking that the provider lacks.
- Read keys through [keys.ts](../peers/keys.ts), never from a file in the repo.
- Pin the provider's endpoint and plan, so each rerun calls the same thing.

## Checks

`mise run test:file tests/models/agent`
