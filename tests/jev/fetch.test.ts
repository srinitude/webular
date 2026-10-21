// The fetch time budget: Jev gets half the caller's timeout, and WEBULAR_JEV=off
// (set through an Effect ConfigProvider, not process.env) runs the baseline.
import { expect, test } from 'bun:test'
import { ConfigProvider, Duration, Effect, Ref } from 'effect'
import { withinJevBudget } from '../../src/lib/jev/budget.ts'
import { Jev } from '../../src/lib/jev/client.ts'
import { decide } from '../../src/lib/jev/define.ts'
import { classifyHttpError, isSoftBlock } from '../../src/lib/jev/fetch.ts'
import { needsBrowser } from '../../src/lib/jev/fetch-browser.ts'

const jevOff = ConfigProvider.layerAdd(ConfigProvider.fromUnknown({ WEBULAR_JEV: 'off' }), {
  asPrimary: true,
})

test('WEBULAR_JEV=off through a ConfigProvider runs the fallback', () =>
  Effect.runPromise(
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
      expect({ answer, jevRan: yield* Ref.get(jevRan) }).toEqual({
        answer: 'fallback',
        jevRan: false,
      })
    }).pipe(Effect.provide(Jev.live), Effect.provide(jevOff)),
  ))

test('a slow effect times out at half the budget and the fallback answers', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const flag = yield* Ref.make(false)
      const [took, answer] = yield* Effect.timed(
        withinJevBudget(
          400,
          Effect.never.pipe(Effect.onInterrupt(() => Ref.set(flag, true))),
          () => 'fallback',
        ),
      )
      const elapsed = Duration.toMillis(took)
      expect({ answer, interrupted: yield* Ref.get(flag) }).toEqual({
        answer: 'fallback',
        interrupted: true,
      })
      expect(elapsed).toBeGreaterThanOrEqual(190)
      expect(elapsed).toBeLessThan(400)
    }),
  ))

test('a fast success passes through', () =>
  Effect.runPromise(
    withinJevBudget(1000, Effect.succeed('jev'), () => 'fb').pipe(
      Effect.map((got) => expect(got).toBe('jev')),
    ),
  ))

// With Jev off, the three fetch decisions answer with their code baselines.
test('fetch decisions fall back to their baselines when Jev is off', () =>
  Effect.runPromise(
    Effect.all([
      classifyHttpError({ url: 'https://a.example.dev', status: 503, body: '' }, 1000),
      isSoftBlock('https://a.example.dev', '<h1>Just a moment</h1>', 1000),
      needsBrowser(
        'https://a.example.dev',
        '<div>Loading</div><script src="/a.js"></script>',
        1000,
      ),
      needsBrowser('https://a.example.dev', '<p>No scripts here.</p>', 1000),
    ]).pipe(
      Effect.map((got) => expect(got).toEqual(['retry_later', false, true, false])),
      Effect.provide(Jev.live),
      Effect.provide(jevOff),
    ),
  ))
