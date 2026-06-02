// MCP command — list or serve webular tools as an MCP server over stdio.
// --list: emit { count, tools: string[] } of exposed tool ids (fast, no server start)
// default: start an MCP server over stdio exposing webTools
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { parseFlags } from '../core/args.ts'
import { emit, logErr } from '../core/output.ts'
import { webTools } from '../tools/web.ts'

const TOOL_IDS = Object.values(webTools).map((t) => t.id)

async function startServer(): Promise<void> {
  const server = new McpServer({ name: 'webular', version: '0.0.0' })
  const reg = server as unknown as {
    registerTool: (
      id: string,
      cfg: { description: string; inputSchema: Record<string, unknown> },
      handler: (
        a: Record<string, unknown>,
      ) => Promise<{ content: Array<{ type: 'text'; text: string }> }>,
    ) => void
  }
  for (const tool of Object.values(webTools)) {
    const shape = (tool.inputSchema as { shape?: Record<string, unknown> } | undefined)?.shape ?? {}
    reg.registerTool(
      tool.id,
      { description: tool.description ?? '', inputSchema: shape },
      async (args) => {
        const result = await (tool.execute as (a: unknown) => Promise<unknown>)(args)
        return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] }
      },
    )
  }
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

async function main(): Promise<number> {
  const { values } = parseFlags(Bun.argv.slice(2), {
    list: { type: 'boolean', default: false },
  })
  if (values.list) {
    await emit(
      { count: TOOL_IDS.length, tools: TOOL_IDS },
      { json: Boolean(values.json), output: values.output as string | undefined },
    )
    return 0
  }
  try {
    await startServer()
    return 0
  } catch (err) {
    logErr(`mcp: server error (${String(err)})`)
    return 1
  }
}

process.exit(await main())
