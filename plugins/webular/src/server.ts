// webular MCP server: each webular command becomes one typed MCP tool.
// stdio by default. `--http` serves Streamable HTTP at /mcp on $PORT, which
// portless sets when it runs this file (see `mise run plugin:dev`).
// The HTTP side uses Bun's built-in node:http server, because
// MCPServer.startHTTP takes node IncomingMessage/ServerResponse objects.
import { createServer } from 'node:http'
import { BunRuntime } from '@effect/platform-bun'
import { createTool } from '@mastra/core/tools'
import { MCPServer } from '@mastra/mcp'
import { Config, Data, Effect, FileSystem, Stream } from 'effect'
import { ChildProcess, ChildProcessSpawner } from 'effect/process'
import { z } from 'zod'
import pkg from '../../../package.json' with { type: 'json' }
import { cap } from './budget.ts'
import descriptions from './descriptions.json' with { type: 'json' }
import { runtime } from './runtime.ts'
import { outputs, schemas } from './schemas.ts'

const repo = new URL('../../../', import.meta.url).pathname

// The file a tool call runs. `mise run build` bundles each command to
// dist/commands/<command>.js, one file that starts in about half a second; the
// source form re-imports Mastra's module tree on every call, which takes seconds
// on a cold or busy disk. Without a build, the source form still works; after
// a source change, rebuild so the bundle matches. WEBULAR_DEV set (as in
// mise.toml) always runs the source form.
// ponytail: one child process per call; swap for the CLI's shared dispatch
// (commandFor) and the OS/CPU executable resolver when they land.
const commandEntry = (command: string) =>
  Effect.gen(function* () {
    const source = `${repo}src/commands/${command}.ts`
    const dev = yield* Config.String('WEBULAR_DEV').pipe(Config.withDefault(''))
    if (dev !== '') return source
    const fs = yield* FileSystem.FileSystem
    const bundle = `${repo}dist/commands/${command}.js`
    return (yield* fs.exists(bundle)) ? bundle : source
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

// Runs `webular <command> --json` with the tool input as flags; stdout is the result.
const runCommand = (command: string, input: Record<string, unknown>) =>
  Effect.scoped(
    Effect.gen(function* () {
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
      const entry = yield* commandEntry(command)
      const proc = yield* spawner.spawn(
        ChildProcess.make('bun', [entry, ...toFlags(input), '--json']),
      )
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
      }).pipe(Effect.map((result) => cap(result, command)))
    }),
  ).pipe(
    Effect.mapError((e) =>
      e instanceof CommandFailed
        ? e
        : new CommandFailed({
            message: `webular ${command} could not start: ${String(e)}. Check that Bun is installed and the plugin folder is intact, then restart the MCP server.`,
          }),
    ),
  )

type Command = keyof typeof schemas

const titles: Record<Command, string> = {
  search: 'Search the web',
  scrape: 'Scrape a page',
  map: 'Map a site',
  summarize: 'Summarize text or a page',
  crawl: 'Crawl a site',
  extract: 'Extract by CSS selector',
  answer: 'Answer a question from the web',
  research: 'Research a topic',
  parse: 'Parse a local file',
  media: 'Save page media to a file',
  monitor: 'Check a page for changes',
  batch: 'Scrape many pages',
  act: 'Open a page in a browser',
  feed: 'Read a feed',
}
const writesFiles = new Set<Command>(['media', 'act'])
// Every command result is a JSON object; cap() keeps it one.
const outputSchema = z.looseObject({})

// Mastra's MCP server turns a validation-error shaped result into an isError
// result with this plain message, so a failed command never throws.
const asToolError = (e: CommandFailed) =>
  Effect.succeed({ error: true as const, message: e.message, validationErrors: [] })

const tool = (id: Command) =>
  createTool({
    id,
    title: titles[id],
    description: descriptions.tools[id],
    inputSchema: schemas[id],
    outputSchema: outputs[id] ?? outputSchema,
    mcp: {
      annotations: {
        title: titles[id],
        readOnlyHint: !writesFiles.has(id),
        openWorldHint: id !== 'parse',
      },
    },
    // The SDK already checked input against inputSchema; it is passed through as is.
    execute: (input, context) =>
      runtime.runPromise(
        runCommand(id, input).pipe(Effect.catchTag('CommandFailed', asToolError)),
        { signal: context?.abortSignal },
      ),
  })

const ids = Object.keys(schemas) as Command[]

export const server = new MCPServer({
  id: 'webular',
  name: 'webular',
  version: pkg.version,
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
