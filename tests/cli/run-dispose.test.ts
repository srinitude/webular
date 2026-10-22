// runWorkflow ends each run by draining the parse pool, never by disposing the
// shared step runtime: a disposed ManagedRuntime dies on every later run, which
// broke the next workflow in the same process.
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { parseArticleText } from '../../src/lib/sources.ts'
import { drainParsePool, stepRuntime } from '../../src/workflows/runtime.ts'

const html =
  '<html><head><title>T</title></head><body><article><p>hello pool</p></article></body></html>'

test('the step runtime and parse pool still work after a drain', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      yield* drainParsePool
      yield* drainParsePool
      const { text } = yield* Effect.promise(() => stepRuntime.runPromise(parseArticleText(html)))
      expect(text).toContain('hello pool')
      yield* drainParsePool
    }),
  ))
