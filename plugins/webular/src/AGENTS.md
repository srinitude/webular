# plugins/webular/src/AGENTS.md

This folder holds the source of the plugin's MCP server. The plugin rules are in [AGENTS.md](../AGENTS.md).

## What lives here

- [server.ts](server.ts) is the MCP server. It speaks stdio by default and Streamable HTTP with `--http`.
- [commands.ts](commands.ts) defines the command tools. Each runs one `webular <command>`, and `webular mcp` registers the same tools.
- [schemas.ts](schemas.ts) holds one zod input schema per command.
- [descriptions.json](descriptions.json) holds the tool descriptions and the server `instructions`, which `webular mcp` sends too.
- [budget.ts](budget.ts) holds the output limits for tool results.
- [runtime.ts](runtime.ts) holds the one Effect runtime.

## Rules

- Each key in a schema is a real flag of the matching file in [`src/commands/`](../../../src/commands/).
- Keep [`commands.ts`](commands.ts) free of Mastra imports, so the CLI server can load it.
- Keep every output limit in [`budget.ts`](budget.ts).
- Serve stdio with `serveStdio(factory, { legacy })`. Serve HTTP with `createMcpHandler(factory, { legacy })` and a fresh server instance for each request. Wrap the handler once with `toNodeHandler`.
- On plain `node:http`, bind loopback and put `localhostHostValidation()` and `localhostOriginValidation()` in front of the handler.
- HTTP mode answers 403 to any Host or Origin that is not loopback or `*.localhost`. [http.test.ts](../tests/http.test.ts) checks it.
- On stdio, stdout carries only JSON-RPC. Logs go to stderr. `mise run bugs:check` fails on a stdout write here ([bug classes](../../../docs/bug-classes.md#1-stdout-writes-on-the-mcp-server)).
- Register tools with `inputSchema: z.object(...)` (zod 4.2 or later). Arguments that fail the schema return `isError: true`, and the handler never runs.
- Raise errors with `ProtocolError`, `ProtocolErrorCode`, and `SdkError`, not `McpError` and `ErrorCode`.
- An `MCPServer` from `@mastra/mcp` takes `tools` as an object of `createTool` tools keyed by name. Never forward an MCP access token to another API.
- Each tool sets `annotations.title` and honest `readOnlyHint` and `openWorldHint` booleans. Only `media` and `act` write files, and only `parse`, `tasks`, `diagram`, and `audit` stay off the web. Hosts read the hints when they ask for approval ([Cursor MCP](https://cursor.com/docs/mcp)).
- Tool ids match `^[a-z][a-z0-9_]*$`. Keep at most 40 tools, and at most 60 characters for the server name plus a tool name ([VS Code tools](https://code.visualstudio.com/docs/agents/run/tools), [awslabs/mcp issue 1283](https://github.com/awslabs/mcp/issues/1283)).

## Checks

- `mise run plugin:check-test-first` finds a source file with no test.
- `mise run plugin:test` runs the server, schema, and description tests.
