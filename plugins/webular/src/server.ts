// webular MCP server: each webular command becomes one typed MCP tool, from
// the command tools in commands.ts, which `webular mcp` registers too.
// stdio by default. `--http` serves Streamable HTTP at /mcp on $PORT, which
// portless sets when it runs this file (see `mise run plugin:dev`).
// The HTTP side uses Bun's built-in node:http server, because the SDK's node
// adapter takes node IncomingMessage/ServerResponse objects.
// Self-contained: nothing here reaches outside the plugin folder, so a host
// that copies only this folder still runs it.
import { createServer } from 'node:http'
import { BunRuntime } from '@effect/platform-bun'
import { createTool } from '@mastra/core/tools'
import { MCPServer } from '@mastra/mcp'
import { toNodeHandler } from '@modelcontextprotocol/node'
import { createMcpHandler, type Server } from '@modelcontextprotocol/server'
import { serveStdio } from '@modelcontextprotocol/server/stdio'
import { Config, Effect } from 'effect'
import manifest from '../.claude-plugin/plugin.json' with { type: 'json' }
import { type CommandFailed, commandTools, runCommand } from './commands.ts'
import descriptions from './descriptions.json' with { type: 'json' }
import { runtime } from './runtime.ts'

// Mastra's MCP server turns a validation-error shaped result into an isError
// result with this plain message, so a failed command never throws.
const asToolError = (e: CommandFailed) =>
  Effect.succeed({ error: true as const, message: e.message, validationErrors: [] })

type CommandTool = (typeof commandTools)[number]

const tool = ({ id, title, description, inputSchema, outputSchema, ...mcp }: CommandTool) =>
  createTool({
    id,
    title,
    description,
    inputSchema,
    outputSchema,
    mcp,
    // The SDK already checked input against inputSchema; it is passed through as is.
    execute: ({ cursor: from, ...input }, context) =>
      runtime.runPromise(
        runCommand(id, input, from).pipe(Effect.catchTag('CommandFailed', asToolError)),
        { signal: context?.abortSignal },
      ),
  })

export const server = new MCPServer({
  id: 'webular',
  name: 'webular',
  version: manifest.version,
  description: descriptions.server,
  tools: Object.fromEntries(commandTools.map((t) => [t.id, tool(t)])),
})

// MCPServer.startStdio and startHTTP hardcode legacy: 'reject', so a client
// that opens with a 2025-era initialize gets an error instead of its version.
// The SDK entries below take the same per-connection server instance Mastra
// builds (tools, resources, prompts) and serve both eras, as the lifecycle
// spec asks.
// ponytail: reads Mastra's private createServerInstance; go back to
// server.startStdio()/startHTTP() once MCPServer takes a legacy option. Until
// then list-changed notifications are not sent, which static tools never need.
const instance = () =>
  (server as unknown as { createServerInstance: () => Server }).createServerInstance()

const onerror = (error: Error) => runtime.runFork(Effect.logError('MCP handler error', error))

const handleHttp = toNodeHandler(createMcpHandler(instance, { legacy: 'stateless', onerror }), {
  onerror,
})

// DNS rebinding guard: only loopback Host and Origin values reach /mcp; any other
// gets 403, as the MCP spec asks of a local HTTP server.
// portless names (*.localhost) resolve to loopback too (RFC 6761), so they pass.
const loopback = (url: string) =>
  URL.canParse(url) &&
  /^(localhost|127\.0\.0\.1|\[::1\]|.+\.localhost)$/.test(new URL(url).hostname)
const trusted = ({ host, origin }: { host?: string | undefined; origin?: string | undefined }) =>
  loopback(`http://${host}`) && (origin === undefined || loopback(origin))

const listen = (port: number) =>
  Effect.callback<ReturnType<typeof createServer>>((resume) => {
    const http = createServer((req, res) => {
      if (!trusted(req.headers)) {
        res.writeHead(403).end()
        return
      }
      if (new URL(req.url ?? '/', 'http://localhost').pathname !== '/mcp') {
        res.writeHead(404).end()
        return
      }
      runtime.runFork(
        Effect.tryPromise(() => handleHttp(req as Parameters<typeof handleHttp>[0], res)),
      )
    })
    http.listen(port, '127.0.0.1', () => resume(Effect.succeed(http)))
  })

const serveHttp = Effect.gen(function* () {
  const port = yield* Config.Port('PORT').pipe(Config.withDefault(3939))
  yield* Effect.acquireRelease(listen(port), (http) => Effect.sync(() => http.close()))
  yield* Effect.logInfo(`webular MCP listening on http://127.0.0.1:${port}/mcp`)
  return yield* Effect.never
}).pipe(Effect.scoped)

const serveStdioEras = Effect.sync(() => serveStdio(instance, { legacy: 'serve', onerror }))

if (import.meta.main) {
  const main: Effect.Effect<unknown, unknown> = Bun.argv.includes('--http')
    ? serveHttp
    : serveStdioEras
  BunRuntime.runMain(main)
}
