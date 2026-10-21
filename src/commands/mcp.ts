// MCP command — list or serve webular tools as an MCP server over stdio.
// --list: emit { count, tools: string[] } (fast path — the SDK loads lazily,
// only when the server actually starts).
import { extname, join } from 'node:path'
import { Effect } from 'effect'
import pkg from '../../package.json' with { type: 'json' }
import { EXIT } from '../cli/exit-codes.ts'
import { renderFor } from '../cli/render.ts'
import { emitOpts, parseFlags } from '../core/args.ts'
import { CliError, runMain } from '../core/effect.ts'
import { emit } from '../core/output.ts'

const serverError = (cause: unknown) =>
  new CliError({ message: `mcp: the server failed (${String(cause)})`, exitCode: EXIT.failure })

// The tool table (zod schemas, HTML parsing) loads after the flags parse.
const lazy = <M>(load: () => Promise<M>) => Effect.tryPromise({ try: load, catch: serverError })

const loadSdk = Effect.all(
  [
    Effect.tryPromise({
      try: () => import('@modelcontextprotocol/sdk/server/mcp.js'),
      catch: serverError,
    }),
    Effect.tryPromise({
      try: () => import('@modelcontextprotocol/sdk/server/stdio.js'),
      catch: serverError,
    }),
  ],
  { concurrency: 2 },
)

// Owns the server for the scope: connect on acquire, close on release, and
// stay alive until the stdio transport closes (stdin ends or the client leaves).
// Each command tool starts its sibling command file (src/commands or
// dist/commands) on this process's own runtime, as the CLI's dispatch does.
const sibling = (command: string) => join(import.meta.dir, `${command}${extname(import.meta.path)}`)

const serve = Effect.gen(function* () {
  const [{ McpServer }, { StdioServerTransport }] = yield* loadSdk
  const { registerAll } = yield* lazy(() => import('../tools/web.ts'))
  const server = yield* Effect.acquireRelease(
    Effect.sync(() => new McpServer({ name: 'webular', version: pkg.version })),
    (s) => Effect.tryPromise(() => s.close()).pipe(Effect.ignore),
  )
  yield* registerAll(server, sibling)
  yield* Effect.tryPromise({
    try: () => server.connect(new StdioServerTransport()),
    catch: serverError,
  })
  // The SDK's stdio transport never closes on stdin EOF, so end on either signal.
  yield* Effect.callback<void>((resume) => {
    const done = () => resume(Effect.void)
    server.server.onclose = done
    process.stdin.once('end', done)
    return Effect.sync(() => process.stdin.off('end', done))
  })
  return 0
}).pipe(Effect.scoped)

const main = Effect.gen(function* () {
  const { values } = yield* parseFlags(Bun.argv.slice(2), {
    list: { type: 'boolean', default: false },
  })
  if (!values['list']) return yield* serve
  const { mcpToolIds } = yield* lazy(() => import('../tools/web.ts'))
  yield* emit(
    { count: mcpToolIds.length, tools: mcpToolIds },
    { ...emitOpts(values), render: renderFor('mcp') },
  )
  return 0
})

runMain(main)
