// MCP command — list or serve webular tools as an MCP server over stdio.
// --list: emit { count, tools: string[] } (fast path — the SDK loads lazily,
// only when the server actually starts).
import pkg from '../../package.json' with { type: 'json' }
import { renderFor } from '../cli/render.ts'
import { emitOpts, parseFlags } from '../core/args.ts'
import { emit, logErr } from '../core/output.ts'
import { registerAll, webTools } from '../tools/web.ts'

async function startServer(): Promise<void> {
  const [{ McpServer }, { StdioServerTransport }] = await Promise.all([
    import('@modelcontextprotocol/sdk/server/mcp.js'),
    import('@modelcontextprotocol/sdk/server/stdio.js'),
  ])
  const server = new McpServer({ name: 'webular', version: pkg.version })
  registerAll(server)
  await server.connect(new StdioServerTransport())
}

async function main(): Promise<number> {
  const { values } = parseFlags(Bun.argv.slice(2), {
    list: { type: 'boolean', default: false },
  })
  if (values.list) {
    const ids = webTools.map((t) => t.id)
    await emit({ count: ids.length, tools: ids }, { ...emitOpts(values), render: renderFor('mcp') })
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
