// JSON-RPC protocol errors the MCP SDK does not send on its own: -32602 for an
// unknown tool name (McpServer turns it into an isError result) and -32700 for
// a stdin line that is not JSON (the stdio transport only calls onerror).
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { CallToolRequestSchema, ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js'

type Handler = (request: { params: { name: string } }, extra: unknown) => Promise<unknown>
// ponytail: reads the SDK's private tool table; the upgrade path is an SDK hook for this.
type Internals = { _registeredTools: Record<string, unknown> }

export const protocolErrors = (
  server: McpServer,
  transport?: { send: (message: never) => Promise<void> },
): void => {
  const low = server.server as unknown as { _requestHandlers: Map<string, Handler> }
  const original = low._requestHandlers.get('tools/call')
  if (original) {
    server.server.setRequestHandler(CallToolRequestSchema, (request, extra) => {
      if (!(request.params.name in (server as unknown as Internals)._registeredTools))
        throw new McpError(ErrorCode.InvalidParams, `Unknown tool: ${request.params.name}`)
      return original(request, extra) as never
    })
  }
  if (transport) {
    const previous = server.server.onerror
    server.server.onerror = (error) => {
      previous?.(error)
      if (error instanceof SyntaxError)
        void transport.send({
          jsonrpc: '2.0',
          id: null,
          error: { code: ErrorCode.ParseError, message: 'Parse error' },
        } as never)
    }
  }
}
