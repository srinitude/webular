// MCP command — list or serve webular tools as an MCP server over stdio.
// --list: emit { count, tools: string[] } (fast path — the SDK loads lazily,
// only when the server actually starts).
import { extname, join } from 'node:path'
import { Effect } from 'effect'
import pkg from '../../package.json' with { type: 'json' }
import descriptions from '../../plugins/webular/src/descriptions.json' with { type: 'json' }
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

// Sent in the initialize result; the client shows it to the model.
// The same text the plugin server sends, from the one descriptions file.
const INSTRUCTIONS = descriptions.instructions

const serve = Effect.gen(function* () {
  // Agent mode blocks private targets and confines writes; every tool's child process inherits it.
  yield* Effect.sync(() => Object.assign(process.env, { WEBULAR_AGENT_MODE: '1' }))
  const [{ McpServer }, { StdioServerTransport }] = yield* loadSdk
  const { registerAll } = yield* lazy(() => import('../tools/web.ts'))
  const server = yield* Effect.acquireRelease(
    Effect.sync(
      () =>
        new McpServer({ name: 'webular', version: pkg.version }, { instructions: INSTRUCTIONS }),
    ),
    (s) => Effect.tryPromise(() => s.close()).pipe(Effect.ignore),
  )
  yield* registerAll(server, sibling)
  const transport = new StdioServerTransport()
  const { protocolErrors } = yield* lazy(() => import('../tools/sdk-errors.ts'))
  protocolErrors(server, transport)
  yield* Effect.tryPromise({
    try: () => server.connect(transport),
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
