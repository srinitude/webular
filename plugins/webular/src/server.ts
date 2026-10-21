// webular MCP server: each webular command becomes one typed MCP tool.
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
import { Config, Data, Effect, Stream } from 'effect'
import { ChildProcess, ChildProcessSpawner } from 'effect/process'
import { z } from 'zod'
import manifest from '../.claude-plugin/plugin.json' with { type: 'json' }
import { cap } from './budget.ts'
import descriptions from './descriptions.json' with { type: 'json' }
import { runtime } from './runtime.ts'
import { outputs, schemas } from './schemas.ts'

// The process a tool call runs: `webular <command>`, from WEBULAR_BIN or PATH.
// WEBULAR_COMMANDS_DIR (a checkout's src/commands, for tests and development)
// runs `bun <dir>/<command>.ts` directly and skips the CLI's mise routing.
// ponytail: one child process per call; swap for the CLI's shared dispatch
// (commandFor) and the OS/CPU executable resolver when they land.
const commandLine = (command: string, args: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const dir = yield* Config.String('WEBULAR_COMMANDS_DIR').pipe(Config.withDefault(''))
    if (dir !== '') return ChildProcess.make('bun', [`${dir}/${command}.ts`, ...args])
    const bin = yield* Config.String('WEBULAR_BIN').pipe(Config.withDefault('webular'))
    return ChildProcess.make(bin, [command, ...args])
  })

class CommandFailed extends Data.TaggedError('CommandFailed')<{ readonly message: string }> {}

const decode = (bytes: Stream.Stream<Uint8Array, unknown>) =>
  bytes.pipe(Stream.decodeText(), Stream.mkString)

// true becomes a bare --flag, false and undefined drop out, arrays join with commas.
const toFlags = (input: Record<string, unknown>) =>
  Object.entries(input).flatMap(([k, v]) => {
    if (v === undefined || v === false) return []
    return v === true ? [`--${k}`] : [`--${k}`, String(v)]
  })

// Picks the next step by exit code: 2 is bad input, anything else is the site or the network.
const failure = (command: string, code: number, err: string) => {
  const why = err.trim() || `exit code ${code}`
  return new CommandFailed({
    message:
      code === 2
        ? `webular ${command} failed: ${why}. Fix the input and call it again.`
        : `webular ${command} failed: ${why}. The input looked valid. Try another URL, or tell the user the site could not be read.`,
  })
}

// Runs `webular <command> --json` with the tool input as flags; stdout is the
// result, cut to one page that starts at `from`.
const runCommand = (command: string, input: Record<string, unknown>, from = 0) =>
  Effect.scoped(
    Effect.gen(function* () {
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
      const proc = yield* spawner.spawn(yield* commandLine(command, [...toFlags(input), '--json']))
      const [out, err, code] = yield* Effect.all(
        [decode(proc.stdout), decode(proc.stderr), proc.exitCode],
        { concurrency: 3 },
      )
      if (code !== 0) return yield* failure(command, code, err)
      return yield* Effect.try({
        try: () => JSON.parse(out) as Record<string, unknown>,
        catch: () =>
          new CommandFailed({
            message: `webular ${command} returned output that is not JSON. This is a webular bug. Do not retry. Tell the user, and include the tool name.`,
          }),
      }).pipe(Effect.map((result) => cap(result, command, from)))
    }),
  ).pipe(
    Effect.mapError((e) =>
      e instanceof CommandFailed
        ? e
        : new CommandFailed({
            message: `webular ${command} could not start: ${String(e)}. Check that webular is installed and on PATH (or WEBULAR_BIN names it), then restart the MCP server.`,
          }),
    ),
  )

type Command = keyof typeof schemas

const writesFiles = new Set<Command>(['media', 'act'])
// Every command result is a JSON object; cap() keeps it one.
const outputSchema = z.looseObject({})
const cursor = z
  .number()
  .int()
  .min(0)
  .optional()
  .describe('Where to resume a cut result: the cursor value it returned')

// Mastra's MCP server turns a validation-error shaped result into an isError
// result with this plain message, so a failed command never throws.
const asToolError = (e: CommandFailed) =>
  Effect.succeed({ error: true as const, message: e.message, validationErrors: [] })

const tool = (id: Command) =>
  createTool({
    id,
    title: descriptions.titles[id],
    description: descriptions.tools[id],
    inputSchema: z.strictObject({ ...schemas[id].shape, cursor }),
    outputSchema: outputs[id] ?? outputSchema,
    mcp: {
      annotations: {
        title: descriptions.titles[id],
        readOnlyHint: !writesFiles.has(id),
        openWorldHint: id !== 'parse',
      },
    },
    // The SDK already checked input against inputSchema; it is passed through as is.
    execute: ({ cursor: from, ...input }, context) =>
      runtime.runPromise(
        runCommand(id, input, from).pipe(Effect.catchTag('CommandFailed', asToolError)),
        { signal: context?.abortSignal },
      ),
  })

const ids = Object.keys(schemas) as Command[]

export const server = new MCPServer({
  id: 'webular',
  name: 'webular',
  version: manifest.version,
  description: descriptions.server,
  tools: Object.fromEntries(ids.map((id) => [id, tool(id)])),
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
