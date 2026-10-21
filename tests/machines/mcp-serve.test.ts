// Model-based test: every path of the mcp serve machine, replayed against the
// real `webular mcp` server (src/commands/mcp.ts) over stdio. Each path starts
// the server, speaks newline-delimited JSON-RPC as an MCP client does, makes one
// tool call per event, and on STOP closes stdin, which must end the process.
// web.readability takes its HTML inline, so no path touches the network.
// ponytail: one server per path, run in turn (the server takes seconds to exit
// after stdin ends; 16 at once starve each other); share one if CI time hurts.
import { describe, expect, test } from 'bun:test'
import { Effect, Schema, Stream } from 'effect'
import { mcpServeMachine } from '../../src/machines/mcp-serve.ts'
import { finalPaths } from '../_support/paths.ts'
import { ROOT } from '../_support/root.ts'
import { eff, io } from '../_support/run.ts'

const Reply = Schema.Struct({
  id: Schema.Number,
  result: Schema.optional(
    Schema.Struct({
      isError: Schema.optional(Schema.Boolean),
      content: Schema.optional(Schema.Array(Schema.Struct({ text: Schema.String }))),
    }),
  ),
  error: Schema.optional(Schema.Unknown),
})
type Reply = typeof Reply.Type
const decodeReply = Schema.decodeUnknownEffect(Schema.fromJsonString(Reply))

const HTML = '<html><head><title>T</title></head><body><p>Body text.</p></body></html>'
const CALLS: Record<string, { name: string; arguments: object }> = {
  TOOL_OK: { name: 'web.readability', arguments: { html: HTML } },
  TOOL_INVALID_ARGS: { name: 'web.readability', arguments: { html: 42 } },
  TOOL_UNKNOWN: { name: 'web.nope', arguments: {} },
}

// Every reply is a result, never a protocol error; its first text block.
const resultText = (reply: Reply | undefined, isError: boolean) => {
  expect(reply?.error).toBeUndefined()
  expect(reply?.result?.isError ?? false).toBe(isError)
  return reply?.result?.content?.[0]?.text ?? ''
}

const OUTCOMES: Record<string, (reply: Reply | undefined) => void> = {
  TOOL_OK: (r) => expect(resultText(r, false)).toContain('"title":"T"'),
  TOOL_INVALID_ARGS: (r) => expect(resultText(r, true)).toContain('Input validation error'),
  TOOL_UNKNOWN: (r) => expect(resultText(r, true)).toContain('Tool web.nope not found'),
}

const message = (body: object) => `${JSON.stringify({ jsonrpc: '2.0', ...body })}\n`
const INIT =
  message({
    id: 0,
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'machine-test', version: '0.0.0' },
    },
  }) + message({ method: 'notifications/initialized' })

const server = Effect.acquireRelease(
  Effect.sync(() =>
    Bun.spawn(['bun', `${ROOT}src/commands/mcp.ts`], {
      cwd: ROOT,
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'ignore',
    }),
  ),
  (proc) => Effect.sync(() => proc.kill()),
)

// One server per path: send every call, read one reply per request, then stop.
const replay = (events: string[]) =>
  Effect.gen(function* () {
    const proc = yield* server
    const calls = events.filter((e) => e !== 'STOP')
    const requests = calls.map((e, i) =>
      message({ id: i + 1, method: 'tools/call', params: CALLS[e] }),
    )
    yield* Effect.sync(() => proc.stdin.write(INIT + requests.join('')))
    yield* io(async () => proc.stdin.flush())
    const byId = yield* Stream.fromReadableStream({
      evaluate: () => proc.stdout,
      onError: (e) => new Error(String(e)),
    }).pipe(
      Stream.decodeText,
      Stream.splitLines,
      Stream.mapEffect((line) => decodeReply(line), { concurrency: 1 }),
      Stream.take(calls.length + 1),
      Stream.runFold(
        () => new Map<number, Reply>(),
        (seen, reply) => seen.set(reply.id, reply),
      ),
    )
    for (const [i, event] of calls.entries()) OUTCOMES[event]?.(byId.get(i + 1))
    yield* io(async () => proc.stdin.end())
    expect(yield* io(() => proc.exited).pipe(Effect.timeout('20 seconds'))).toBe(0)
  })

const paths = finalPaths(mcpServeMachine, ['TOOL_OK', 'TOOL_INVALID_ARGS', 'TOOL_UNKNOWN', 'STOP'])

describe('mcp serve machine matches the real stdio server', () => {
  test('every path ends in a stop, after each call kind in every order', () => {
    expect(Object.keys(OUTCOMES).sort()).toEqual(Object.keys(CALLS).sort())
    expect(paths.length).toBe(16)
    for (const p of paths) expect([p.final, p.events.at(-1)]).toEqual(['stopped', 'STOP'])
  })

  test.each(paths.map((p) => [`${p.final}: ${p.events.join(' ')}`, p] as const))(
    '%s',
    (_name, path) => eff(replay(path.events))(),
    30_000,
  )
})
