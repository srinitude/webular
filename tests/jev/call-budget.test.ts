// A run's live Jev calls are capped: past the cap the call fails with a typed
// "budget" error (so the decision's fallback answers) and sends nothing; cache
// hits cost no budget.
import { expect, test } from 'bun:test'
import { Effect, Option } from 'effect'
import type { JevRequest, JevResult } from '../../src/lib/jev/client.ts'
import { makeAsk, makeLru } from '../../src/lib/jev/store.ts'

const reply = { answers: {}, inputTokens: 1 } as unknown as JevResult
const req = (n: number): JevRequest => ({ state: { n }, questions: {} })

const deps = (max: number) => {
  const sent = { n: 0 }
  const live = () =>
    Effect.sync(() => {
      sent.n++
      return reply
    })
  const ask = makeAsk({
    model: 'm',
    replay: Option.none(),
    live,
    maxLiveCalls: max,
    lru: makeLru(16),
    log: () => Effect.void,
    drift: () => Effect.void,
  })
  return { sent, ask }
}

test('live calls past the cap fail with a budget error and send nothing', async () => {
  const { sent, ask } = deps(2)
  const run = Effect.gen(function* () {
    yield* ask('d', req(1))
    yield* ask('d', req(2))
    return yield* Effect.flip(ask('d', req(3)))
  })
  const err = await Effect.runPromise(run)
  expect(err.kind).toBe('budget')
  expect(sent.n).toBe(2)
})

test('a cache hit costs no budget', async () => {
  const { sent, ask } = deps(1)
  const run = Effect.gen(function* () {
    yield* ask('d', req(1))
    return yield* ask('d', req(1))
  })
  expect((await Effect.runPromise(run)).source).toBe('cache')
  expect(sent.n).toBe(1)
})
