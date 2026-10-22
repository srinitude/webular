# src/tools/AGENTS.md

Rules for the MCP tools, under [src/AGENTS.md](../AGENTS.md).

## What lives here

[web.ts](web.ts) (the one tool list for `webular mcp`), [web-schemas.ts](web-schemas.ts), [web-register.ts](web-register.ts), [web-call.ts](web-call.ts), [web-machine.ts](web-machine.ts), [sdk-errors.ts](sdk-errors.ts).

## Rules

- Don't put a format rule only in a parameter description. Enforce it in the zod schema. Source: [arXiv 2509.18420](https://arxiv.org/abs/2509.18420).
- Don't return fetched page text as if it were instructions. Mark it as untrusted data. Source: [arXiv 2510.15994](https://arxiv.org/abs/2510.15994).
- A tool shares its name, input shape, and error text with its CLI command. Ask first before you rename one.
- Bad tool input (an unknown key or a bad paging cursor) gets an `isError` result, never a silent drop. `mise run bugs:mcp-cli` checks it.
- A handler parses its input again with the same zod schema. A failing tool returns `isError` content and never breaks the protocol.
- Load machines and the MCP SDK lazily, so `mcp --list` stays fast.
- A tool calls the same workflow its command does. It has no logic of its own.

### MCP SDK

- `registerTool(name, config, handler)` takes a Zod shape or a Zod object for `inputSchema` and `outputSchema`. The web tools pass their strict object, so the SDK refuses unknown keys instead of dropping them. An `outputSchema` pairs with `structuredContent`, which the SDK validates.
- Stdio is `new StdioServerTransport()` then `server.connect(transport)`. On stdio, stdout carries only JSON-RPC and logs go to stderr (unverified at this pin).
- Never import first- and second-generation SDK objects in one file.
- In SDK `1.32.1`, an unknown tool name becomes an `isError` result: `dist/esm/server/mcp.js` line 144 throws `InvalidParams`, and the SDK's catch at line 175 wraps it as that result. A non-JSON stdin line gets no reply: `dist/esm/shared/stdio.js` line 35 throws, `dist/esm/server/stdio.js` line 50 stays silent, and only `onerror` sees it.
- [`sdk-errors.ts`](sdk-errors.ts) adds the spec's `-32602` and `-32700` replies for `webular mcp`. Source: [MCP tools errors, spec 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/server/tools#error-handling).

### Standards

- Each tool has a `title`, `annotations` (`readOnlyHint`, plus `openWorldHint` on a tool that reaches the web), and an `outputSchema` when it returns `structuredContent`. Source: [MCP tools, spec 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/server/tools).
- tools/list keeps one stable order, sorted by id. Same source.
- A handler passes the request's abort signal into its run, so a cancelled call stops its child. Source: [MCP stdio transport, spec 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/stdio).
- The tools share the plugin's rate limit and path guard. Source: [MCP tools security, spec 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/server/tools#security-considerations).
- The server lists at most 40 tools. Source: [VS Code tools](https://code.visualstudio.com/docs/agents/run/tools).
- Tool ids use only letters, digits, `_`, and `-`. MCP allows `.`, but the model APIs behind Cursor and VS Code reject it. Source: [MCP issue 1063](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1063).

### Known gaps

- [`web.ts`](web.ts) registers no `outputSchema` for the web tools and has no rate limit. `web.fetch` fetches any `http` or `https` URL.
- Five ids have a `.`: `machine.next`, `web.fetch`, `web.links`, `web.markdown`, and `web.readability`.
- `registerAll` in [`web.ts`](web.ts) runs an Effect outside the allowed process edges.

## Checks

```bash
mise run test:file tests/commands/mcp.test.ts tests/commands/mcp-server.test.ts tests/machines/machine-next.test.ts tests/machines/mcp-serve.test.ts
```
