// Bounds on every Jev decision: a payload over its token budget is refused with a
// typed error that names the decision, its size, and the cap, never reaches Jev,
// and lets the fallback answer. The LRU stays at a fixed size.
import { expect, test } from 'bun:test'
import { Effect, Layer } from 'effect'
import { Jev, type JevResult } from '../../src/lib/jev/client.ts'
import { decisions } from '../../src/lib/jev/decisions.ts'
import { defineDecision, guardPayload } from '../../src/lib/jev/define.ts'
import { JevPayloadTooLarge } from '../../src/lib/jev/errors.ts'
import { CAPS, JEV_TOKEN_CAP, payloadTokens } from '../../src/lib/jev/payload/index.ts'
import { makeLru } from '../../src/lib/jev/store.ts'

const page = { url: 'https://x.dev/', title: 'x' }
const login = { goal: 'docs', page, link: { url: 'https://x.dev/login', anchor: 'Sign in' } }
const counting = () => {
  const calls = { n: 0 }
  const ask = () => {
    calls.n++
    return Effect.succeed({ answers: { content: { noul: 0.99 } } } as unknown as JevResult)
  }
  return { calls, layer: Layer.succeed(Jev)(Jev.of({ available: true, ask })) }
}
const row = () => Array(CAPS.fields).fill('x'.repeat(CAPS.chars))
const big = { pages: Array.from({ length: CAPS.fields }, row) }

test('the token cap sits under the per-question context and counts chars / 4', () => {
  expect(JEV_TOKEN_CAP).toBeLessThanOrEqual(32_000)
  expect(payloadTokens('x'.repeat(400))).toBe(100)
})

test('a payload over the cap fails with a typed error naming decision, size, cap', () =>
  Effect.runPromise(
    Effect.flip(guardPayload('big', { state: big, questions: {} })).pipe(
      Effect.map((e) => {
        expect(e).toBeInstanceOf(JevPayloadTooLarge)
        expect(e.decision).toBe('big')
        expect(e.cap).toBe(JEV_TOKEN_CAP)
        expect(e.tokens).toBeGreaterThan(JEV_TOKEN_CAP)
        return e
      }),
    ),
  ))

test('an over-budget decision never asks Jev and uses its fallback', () => {
  const { calls, layer } = counting()
  const tight = defineDecision({ ...decisions.link.def, maxTokens: 1 })
  return Effect.runPromise(
    tight(login).pipe(
      Effect.provide(layer),
      Effect.map((got) => {
        expect(got).toBe(false) // the fallback rejects a login link; Jev would say true
        expect(calls.n).toBe(0)
        return got
      }),
    ),
  )
})

test('a decision inside its budget asks Jev once', () => {
  const { calls, layer } = counting()
  return Effect.runPromise(
    decisions.link(login).pipe(
      Effect.provide(layer),
      Effect.map((got) => {
        expect(got).toBe(true)
        expect(calls.n).toBe(1)
        return got
      }),
    ),
  )
})

test('the LRU never holds more than its capacity', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const lru = makeLru(4)
      for (let k = 0n; k < 100n; k++) yield* lru.remember(k, { answers: {}, inputTokens: 0 })
      expect(lru.get(95n)).toBeUndefined()
      expect(lru.get(96n)).toBeDefined()
    }),
  ))
