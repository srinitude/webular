// MCP command — list or serve webular tools as an MCP server over stdio.
// --list: emit { count, tools: string[] } (fast path — the SDK loads lazily,
// only when the server actually starts).
import { Effect } from 'effect'
import pkg from '../../package.json' with { type: 'json' }
import { renderFor } from '../cli/render.ts'
import { emitOpts, parseFlags } from '../core/args.ts'
import { CliError, runMain } from '../core/effect.ts'
import { emit } from '../core/output.ts'
import { registerAll, webTools } from '../tools/web.ts'

const serverError = (cause: unknown) =>
  new CliError({ message: `mcp: server error (${String(cause)})`, exitCode: 1 })

const loadSdk = Effect.tryPromise({
  try: () =>
    Promise.all([
      import('@modelcontextprotocol/sdk/server/mcp.js'),
      import('@modelcontextprotocol/sdk/server/stdio.js'),
    ]),
  catch: serverError,
})

// Owns the server for the scope: connect on acquire, close on release, and
// stay alive until the stdio transport closes (stdin ends or the client leaves).
const serve = Effect.gen(function* () {
  const [{ McpServer }, { StdioServerTransport }] = yield* loadSdk
  const server = yield* Effect.acquireRelease(
    Effect.sync(() => new McpServer({ name: 'webular', version: pkg.version })),
    (s) => Effect.tryPromise(() => s.close()).pipe(Effect.ignore),
  )
  yield* registerAll(server)
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
  if (!values.list) return yield* serve
  const ids = webTools.map((t) => t.id)
  yield* emit({ count: ids.length, tools: ids }, { ...emitOpts(values), render: renderFor('mcp') })
  return 0
})

runMain(main)
