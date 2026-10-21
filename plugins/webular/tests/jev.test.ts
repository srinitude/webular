// Every fixed-label judgment has calibration cases and a Jev scorer, and each
// scorer agrees with its labeled cases when a TypeSafe key is present.
import { expect, test } from 'bun:test'
import { ConfigProvider, Effect, Option, Redacted } from 'effect'
import { decisions, scorers, typesafeKey } from '../evals/jev.ts'

const count = (label: string) => (d: (typeof decisions)[number]) =>
  d.cases.filter((c) => c.expected === label).length

test('every decision has at least three yes cases, three no cases, and a scorer', () => {
  expect(decisions.length).toBeGreaterThanOrEqual(5)
  for (const d of decisions) {
    expect(count('yes')(d)).toBeGreaterThanOrEqual(3)
    expect(count('no')(d)).toBeGreaterThanOrEqual(3)
    expect(typeof scorers[d.id]).toBe('function')
  }
})

const calibrate = Effect.forEach(
  decisions.flatMap((d) => d.cases.map((c) => ({ id: d.id, ...c }))),
  (c) =>
    (scorers[c.id] ?? (() => Effect.die(`no scorer for ${c.id}`)))(c.input).pipe(
      Effect.map((r) => ({ id: c.id, expected: c.expected, got: r.label, conf: r.confidence })),
    ),
  { concurrency: 6 },
)

// The key is looked up once (TYPESAFE_API_KEY, then the Keychain item
// typesafe-ai-api-key) and reaches the scorers through a ConfigProvider.
const withKey = (key: Redacted.Redacted<string>) =>
  ConfigProvider.layer(ConfigProvider.fromUnknown({ TYPESAFE_API_KEY: Redacted.value(key) }))

test(
  'each Jev scorer agrees with its calibration labels',
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const key = yield* typesafeKey
        if (Option.isNone(key))
          return yield* Effect.logWarning(
            'jev calibration skipped: no TypeSafe key in TYPESAFE_API_KEY or the Keychain item typesafe-ai-api-key.',
          )
        const results = yield* calibrate.pipe(Effect.provide(withKey(key.value)))
        const misses = results.filter((r) => r.expected !== r.got)
        yield* Effect.log(`jev calibration: ${results.length - misses.length}/${results.length}`)
        expect(misses).toEqual([])
      }),
    ),
  60_000,
)
