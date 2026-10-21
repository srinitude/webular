# src/tools/AGENTS.md

Rules for the MCP tool definitions, under [src/AGENTS.md](../AGENTS.md).

## What lives here

- `web.ts` holds the tool definitions. It is the one source for `webular mcp`, so `--list` and serve register the same tools.
- `web-register.ts` loosens a tool's input schema at registration, so the tool's own handler gives the error text.
- `web-machine.ts` is the `machine.next` tool. It shows a machine's state after replaying events.

## Rules

- A tool shares its name, input shape, and error text with its CLI command. Ask first before you rename one.
- A handler parses its input again with the same zod schema. A failing tool returns `isError` content and never breaks the protocol.
- Load machines and the MCP SDK lazily, so `mcp --list` stays fast.
- A tool calls the same workflow its command does. It has no logic of its own.

### MCP SDK

- `registerTool(name, config, handler)` takes raw Zod shapes for `inputSchema` and `outputSchema`. An `outputSchema` pairs with `structuredContent`, which the SDK validates. A failure is a tool result with `isError: true` and a text recovery hint.
- Stdio is `new StdioServerTransport()` then `server.connect(transport)`. On stdio, stdout carries only JSON-RPC and logs go to stderr (unverified at this pin).
- Never import first- and second-generation SDK objects in one file.

### Standards

- Each tool has a `title`, `annotations` (`readOnlyHint`, plus `openWorldHint` on a tool that reaches the web), and an `outputSchema` when it returns `structuredContent`. Source: [MCP tools, spec 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/server/tools).
- tools/list keeps one stable order, sorted by id. Source: [MCP tools, spec 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/server/tools).
- A handler passes the request's abort signal into its run, so a cancelled call stops its child. Source: [MCP stdio transport, spec 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/stdio).
- The tools share the plugin's rate limit and path guard. Source: [MCP tools security, spec 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/server/tools#security-considerations).
- The server lists at most 40 tools. Source: [VS Code tools](https://code.visualstudio.com/docs/agents/run/tools).
- Tool ids use only letters, digits, `_`, and `-`. MCP allows `.`, but the model APIs behind Cursor and VS Code reject it. Source: [MCP issue 1063](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1063).

## Checks

```bash
mise run test:file tests/commands/mcp.test.ts tests/commands/mcp-server.test.ts tests/machines/machine-next.test.ts tests/machines/mcp-serve.test.ts
```

- web.ts:164 drops `outputSchema`, and web.ts:168-183 registers no title or annotations.
- web.ts:171 and web.ts:183 ignore the abort signal.
- web.ts has no rate limit, and `web.fetch` fetches any URL.
- web.ts:57-95 gives five ids a `.`, such as `web.fetch`.
- web.ts:36 and web.ts:44 use a bare `z.url()` with no shared http-only URL helper.
- web.ts:193 runs an Effect outside the allowed process edges.
