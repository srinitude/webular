// The fetch time budget: Jev gets half the caller's timeout, and WEBULAR_JEV=off
// (set through an Effect ConfigProvider, not process.env) runs the baseline.
import { expect, test } from 'bun:test'
import { ConfigProvider, Effect, Ref } from 'effect'
import { withinJevBudget } from '../../src/lib/jev/budget.ts'
import { Jev } from '../../src/lib/jev/client.ts'
import { decide } from '../../src/lib/jev/define.ts'
import { classifyHttpError, isSoftBlock } from '../../src/lib/jev/fetch.ts'
import { needsBrowser } from '../../src/lib/jev/fetch-browser.ts'

const jevOff = ConfigProvider.layerAdd(ConfigProvider.fromUnknown({ WEBULAR_JEV: 'off' }), {
  asPrimary: true,
})

test('WEBULAR_JEV=off through a ConfigProvider runs the fallback', async () => {
  const called = await Effect.runPromise(
    Effect.gen(function* () {
      const jevRan = yield* Ref.make(false)
      const answer = yield* withinJevBudget(
        1000,
        decide(
          'budget-test',
          () => 'fallback',
          () => Ref.set(jevRan, true).pipe(Effect.as('jev')),
        ),
        () => 'budget-fallback',
      )
      return { answer, jevRan: yield* Ref.get(jevRan) }
    }).pipe(Effect.provide(Jev.live), Effect.provide(jevOff)),
  )
  expect(called).toEqual({ answer: 'fallback', jevRan: false })
})

test('a slow effect times out at half the budget and the fallback answers', async () => {
  const start = Date.now()
  const interrupted = await Effect.runPromise(
    Effect.gen(function* () {
      const flag = yield* Ref.make(false)
      const answer = yield* withinJevBudget(
        400,
        Effect.never.pipe(Effect.onInterrupt(() => Ref.set(flag, true))),
        () => 'fallback',
      )
      return { answer, interrupted: yield* Ref.get(flag) }
    }),
  )
  const elapsed = Date.now() - start
  expect(interrupted).toEqual({ answer: 'fallback', interrupted: true })
  expect(elapsed).toBeGreaterThanOrEqual(190)
  expect(elapsed).toBeLessThan(400)
})

test('a fast success passes through', async () => {
  expect(await Effect.runPromise(withinJevBudget(1000, Effect.succeed('jev'), () => 'fb'))).toBe(
    'jev',
  )
})

// With Jev off, the three fetch decisions answer with their code baselines.
test('fetch decisions fall back to their baselines when Jev is off', async () => {
  const got = await Effect.runPromise(
    Effect.all([
      classifyHttpError({ url: 'https://a.example.dev', status: 503, body: '' }, 1000),
      isSoftBlock('https://a.example.dev', '<h1>Just a moment</h1>', 1000),
      needsBrowser(
        'https://a.example.dev',
        '<div>Loading</div><script src="/a.js"></script>',
        1000,
      ),
      needsBrowser('https://a.example.dev', '<p>No scripts here.</p>', 1000),
    ]).pipe(Effect.provide(Jev.live), Effect.provide(jevOff)),
  )
  expect(got).toEqual(['retry_later', false, true, false])
})
