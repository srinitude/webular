# src/commands/AGENTS.md

Rules for command entry files, under [src/AGENTS.md](../AGENTS.md).

## What lives here

[act.ts](act.ts), [answer.ts](answer.ts), [audit.ts](audit.ts), [batch.ts](batch.ts), [crawl.ts](crawl.ts), [diagram.ts](diagram.ts), [doctor.ts](doctor.ts), [extract.ts](extract.ts), [feed.ts](feed.ts), [jev.ts](jev.ts), [map.ts](map.ts), [mcp.ts](mcp.ts), [media.ts](media.ts), [monitor.ts](monitor.ts), [parse.ts](parse.ts), [research.ts](research.ts), [scrape.ts](scrape.ts), [search.ts](search.ts), [summarize.ts](summarize.ts), [tasks.ts](tasks.ts).

## Rules

- Don't do more in an entry file than parse flags, run the matching workflow, and hand the result to [`src/cli/run.ts`](../cli/run.ts).
- Don't send long sentence queries to keyword sources. Agents do best with short keyword queries. Source: [arXiv 2602.05975](https://arxiv.org/abs/2602.05975).
- Bug classes here ([bug classes](../../docs/bug-classes.md)): MCP stdout, exit codes, EPIPE. Guard tasks: `mise run bugs:mcp-cli`.
- No capability logic here. Fetching, parsing, and ranking belong in [`src/workflows/`](../workflows/) and [`src/lib/`](../lib/).
- Parse flags with [`src/core/args.ts`](../core/args.ts), which gives bounds-checked accessors.
- Print through [`src/core/output.ts`](../core/output.ts).
- Some commands have no workflow. [`mcp.ts`](mcp.ts), [`jev.ts`](jev.ts), [`diagram.ts`](diagram.ts), and [`audit.ts`](audit.ts) do their small job in place.
- A command's `--json` shape and its MCP tool must stay the same. Both read one input shape.
- Adding a command takes these steps, in order:
  1. A `run:<command>` task in [`mise.toml`](../../mise.toml).
  2. An entry in [`src/cli/commands.ts`](../cli/commands.ts).
  3. A workflow in [`src/workflows/`](../workflows/) and a flow in [`src/machines/`](../machines/).
  4. This entry file.
  5. A test in [`tests/commands/`](../../tests/commands/).
- [`mcp.ts`](mcp.ts) serves the `2026-07-28` protocol, with server/discover and the stateless envelope, and also answers the initialize handshake. Source: [MCP versioning, spec 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning).
- [`mcp.ts`](mcp.ts) exits when stdin closes. Source: [MCP stdio transport, spec 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/stdio).
- The server reports the name `webular` and the package.json version, and server.json repeats both. Source: [MCP Registry server.json, schema 2025-12-11](https://github.com/modelcontextprotocol/registry/blob/main/docs/reference/server-json/draft/server.schema.json).

## Checks

```bash
mise run test:file tests/commands
```

- package.json:67 pins the MCP SDK at `^1.32.1`, which has no `2026-07-28` support.
