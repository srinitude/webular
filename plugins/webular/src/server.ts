// webular MCP server: each webular command becomes one typed MCP tool, from
// the command tools in commands.ts, which `webular mcp` registers too.
// stdio by default. `--http` serves Streamable HTTP at /mcp on $PORT, which
// portless sets when it runs this file (see `mise run plugin:dev`).
// The HTTP side uses Bun's built-in node:http server, because
// MCPServer.startHTTP takes node IncomingMessage/ServerResponse objects.
// Self-contained: nothing here reaches outside the plugin folder, so a host
// that copies only this folder still runs it.
import { createServer } from 'node:http'
import { BunRuntime } from '@effect/platform-bun'
import { createTool } from '@mastra/core/tools'
import { MCPServer } from '@mastra/mcp'
import { Config, Effect } from 'effect'
import manifest from '../.claude-plugin/plugin.json' with { type: 'json' }
import { appResources } from './apps.ts'
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
  appResources,
})

const listen = (port: number) =>
  Effect.callback<ReturnType<typeof createServer>>((resume) => {
    const http = createServer((req, res) => {
      runtime.runFork(
        Effect.tryPromise(() =>
          server.startHTTP({
            url: new URL(req.url ?? '/', 'http://localhost'),
            httpPath: '/mcp',
            req,
            res,
          }),
        ),
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

const serveStdio = Effect.tryPromise(() => server.startStdio())

if (import.meta.main) {
  const main: Effect.Effect<void, unknown> = Bun.argv.includes('--http') ? serveHttp : serveStdio
  BunRuntime.runMain(main)
}
