// `webular mcp` tool metadata, cancel, and bad-input contract, in memory.
import { describe, expect, test } from 'bun:test'
import { Deferred, Effect, type Scope } from 'effect'
import { connected } from '../_support/mcp-client.ts'

const listsHints = Effect.gen(function* () {
  const client = yield* connected
  const { tools } = yield* Effect.promise(() => client.listTools())
  for (const t of tools) {
    expect(t.title).toBeString()
    expect(t.annotations?.readOnlyHint).toBeBoolean()
    expect(t.annotations?.openWorldHint).toBeBoolean()
  }
  const byName = new Map(tools.map((t) => [t.name, t]))
  expect(byName.get('web.fetch')?.annotations?.openWorldHint).toBe(true)
  expect(byName.get('web.markdown')?.annotations?.openWorldHint).toBe(false)
})

// A server that holds every request open and resolves `aborted` when the
// caller drops it; it stops with the test scope.
const hangingServer = Effect.gen(function* () {
  const aborted = yield* Deferred.make<void>()
  const seen = yield* Deferred.make<void>()
  const onAbort = () => Deferred.doneUnsafe(aborted, Effect.void)
  const server = yield* Effect.acquireRelease(
    Effect.sync(() =>
      Bun.serve({
        port: 0,
        hostname: '127.0.0.1',
        maxRequestBodySize: 1024,
        fetch: (req) => {
          Deferred.doneUnsafe(seen, Effect.void)
          req.signal.addEventListener('abort', onAbort, { once: true })
          return new Promise<Response>(() => {})
        },
      }),
    ),
    (s) => Effect.sync(() => s.stop(true)),
  )
  return { url: server.url.href, aborted, seen }
})

const cancelStopsWork = Effect.gen(function* () {
  const client = yield* connected
  const { url, aborted, seen } = yield* hangingServer
  const ac = new AbortController()
  const params = { name: 'web.fetch', arguments: { url, timeoutMs: 20_000 } }
  yield* Effect.forkScoped(
    Effect.ignore(Effect.tryPromise(() => client.callTool(params, undefined, ac))),
  )
  yield* Deferred.await(seen)
  ac.abort()
  yield* Deferred.await(aborted).pipe(Effect.timeout('3 seconds'))
})

const badInputIsError = Effect.gen(function* () {
  const client = yield* connected
  const bad: [string, Record<string, unknown>][] = [
    ['web.links', { html: '<a href="/a">a</a>', base: 'not a url' }],
    ['machine.next', { machine: 'no-such-machine', events: [] }],
    ['diagram', { unknownKey: 1 }],
  ]
  for (const [name, args] of bad) {
    const r = yield* Effect.promise(() => client.callTool({ name, arguments: args }))
    expect(r.isError).toBe(true)
    expect(JSON.stringify(r.content)).not.toBe('[]')
  }
})

const run = <A, E>(body: Effect.Effect<A, E, Scope.Scope>) => Effect.runPromise(Effect.scoped(body))

describe('webular mcp tools', () => {
  test('every tool lists a title and read-only and open-world hints', () => run(listsHints))
  test('a cancelled call aborts its HTTP request', () => run(cancelStopsWork), 10_000)
  test('bad input is an isError result, not a thrown error', () => run(badInputIsError))
})
