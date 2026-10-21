# plugins/webular/src/AGENTS.md

This folder holds the source of the plugin's MCP server. The plugin rules are in [AGENTS.md](../AGENTS.md).

## What lives here

- `plugins/webular/src/server.ts` is the MCP server. It speaks stdio by default and Streamable HTTP with `--http`.
- `plugins/webular/src/commands.ts` defines the command tools. Each runs one `webular <command>`, and `webular mcp` registers the same tools.
- `plugins/webular/src/schemas.ts` holds one zod input schema per command.
- `plugins/webular/src/descriptions.json` holds the tool descriptions.
- `plugins/webular/src/budget.ts` holds the output limits for tool results.
- `plugins/webular/src/runtime.ts` holds the one Effect runtime.

## Rules

- Each key in a schema is a real flag of the matching file in `src/commands/`.
- Keep `commands.ts` free of Mastra imports, so the CLI server can load it.
- Keep every output limit in `budget.ts`.
- Serve stdio with `serveStdio(factory, { legacy })`. Serve HTTP with `createMcpHandler(factory, { legacy })` and a fresh server instance for each request. Wrap the handler once with `toNodeHandler`.
- On plain `node:http`, bind loopback and put `localhostHostValidation()` and `localhostOriginValidation()` in front of the handler.
- On stdio, stdout carries only JSON-RPC. Logs go to stderr.
- Register tools with `inputSchema: z.object(...)` (zod 4.2 or later). Arguments that fail the schema return `isError: true`, and the handler never runs.
- Raise errors with `ProtocolError`, `ProtocolErrorCode`, and `SdkError`, not `McpError` and `ErrorCode`.
- An `MCPServer` from `@mastra/mcp` takes `tools` as an object of `createTool` tools keyed by name. Never forward an MCP access token to another API.
- Each tool sets `annotations.title` and honest `readOnlyHint`, `destructiveHint`, `idempotentHint`, and `openWorldHint` booleans. Hosts read them when they ask approval ([Cursor MCP](https://cursor.com/docs/mcp)).
- Tool ids match `^[a-z][a-z0-9_]*$`. Keep at most 40 tools, and at most 60 characters for the server name plus a tool name ([VS Code tools](https://code.visualstudio.com/docs/agents/run/tools), [awslabs/mcp issue 1283](https://github.com/awslabs/mcp/issues/1283)).

## Checks

- `mise run plugin:check-test-first` finds a source file with no test.
- `mise run plugin:test` runs the server, schema, and description tests.
- `plugins/webular/src/server.ts:81` has no host or origin check, and no test expects 403 for `evil.example`.
- `plugins/webular/src/commands.ts:131-135` sets no `destructiveHint` or `idempotentHint`. `plugins/webular/tests/server.test.ts:81` checks neither, nor `outputSchema`.
- `plugins/webular/src/commands.ts:116` falls back to `z.looseObject({})`, and no test checks `structuredContent` against `outputSchema`.
- `plugins/webular/src/server.ts:62` reads the private `createServerInstance`. `plugins/webular/tests/protocol.test.ts:40` tests older protocols on stdio only.
- No test covers `MCP-Protocol-Version` errors (`-32020`, `-32022`), `Mcp-Session-Id`, `server/discover`, JSON-RPC-only stdout, cancel, exit on stdin close, the concurrency and root limits, a byte-stable `tools/list`, or a 60-second tool budget.
