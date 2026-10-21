// Subject filter eval: a namesake page (the TV series) must not feed the answer
// about the novel, and the baseline-wins cases keep every useful source. The
// code rules always run; the live Jev cases run when TYPESAFE_API_KEY is set
// and need both option orders to agree at the 0.95 bar.
import { expect, test } from 'bun:test'
import { BunServices } from '@effect/platform-bun'
import { Config, ConfigProvider, Effect, Option, Redacted } from 'effect'
import { ChildProcess, ChildProcessSpawner } from 'effect/process'
import {
  agreedIndex,
  dropNamesakes,
  jevSubject,
  qualifierFilter,
  subjectSources,
} from '../../src/lib/source-subject.ts'

const t = (title: string) => ({ title })
const titles = (xs: { title: string }[]) => xs.map((x) => x.title)
const NOVEL = 'One Hundred Years of Solitude - Wikipedia'

const SOLITUDE_Q = "Who wrote the novel 'One Hundred Years of Solitude'?"
const SOLITUDE = [t('One Hundred Years of Solitude (TV series) - Wikipedia'), t(NOVEL)]
const HEISENBERG_Q =
  'In which city was the physicist who formulated the uncertainty principle born?'
const HEISENBERG = [t('Uncertainty principle - Wikipedia'), t('Werner Heisenberg - Wikipedia')]
const LOVELACE_Q = 'In what year were Ada Lovelace notes on the Analytical Engine published?'
const LOVELACE = [
  t('Ada Lovelace - Wikipedia'),
  t('Analytical Engine - Wikipedia'),
  t('Note G - Wikipedia'),
]
const EVEREST_Q = 'How tall is Mount Everest?'
const EVEREST = [
  t('Mount Everest - Wikipedia'),
  t('Mount Everest | Height, Location, & Facts | Britannica'),
]

test('code rule drops the TV series page for a novel question', () => {
  expect(titles(qualifierFilter(SOLITUDE_Q, SOLITUDE))).toEqual([NOVEL])
})

test('code rule keeps every baseline-wins source', () => {
  expect(qualifierFilter(HEISENBERG_Q, HEISENBERG)).toEqual(HEISENBERG)
  expect(qualifierFilter(LOVELACE_Q, LOVELACE)).toEqual(LOVELACE)
  expect(qualifierFilter(EVEREST_Q, EVEREST)).toEqual(EVEREST)
})

test('code rule keeps a qualifier the question asks for, and never empties the list', () => {
  const q = 'Who directed the TV series One Hundred Years of Solitude?'
  expect(qualifierFilter(q, SOLITUDE)).toEqual(SOLITUDE)
  const only = [t('Mercury (element)')]
  expect(qualifierFilter('What is Mercury?', only)).toEqual(only)
})

test('a Jev pick drops only its namesakes', () => {
  expect(titles(dropNamesakes(SOLITUDE, 1))).toEqual([NOVEL])
  expect(dropNamesakes(HEISENBERG, 0)).toEqual(HEISENBERG)
  expect(dropNamesakes(LOVELACE, 0)).toEqual(LOVELACE)
})

test('both orders must agree on a real source at 0.95 or more', () => {
  const labels = ['source_1', 'source_2']
  const pick = (choice: string, confidence: number) => ({ choice, confidence })
  expect(agreedIndex(labels, pick('source_2', 0.99), pick('source_2', 0.97))).toBe(1)
  expect(agreedIndex(labels, pick('source_2', 0.99), pick('source_2', 0.9))).toBeUndefined()
  expect(agreedIndex(labels, pick('source_2', 0.99), pick('source_1', 0.99))).toBeUndefined()
  expect(agreedIndex(labels, pick('none', 0.99), pick('none', 0.99))).toBeUndefined()
  expect(agreedIndex(labels, undefined, pick('source_1', 0.99))).toBeUndefined()
})

// Live eval: the key comes from TYPESAFE_API_KEY or, on this machine, the
// Keychain item read inside this process. Without either it logs a skip.
// Logs each Jev index so the report shows both orders.
const keychainKey = Effect.gen(function* () {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
  const out = yield* spawner.lines(
    ChildProcess.make('security', ['find-generic-password', '-s', 'typesafe-ai-api-key', '-w']),
  )
  return Redacted.make(out[0]?.trim() ?? '')
}).pipe(
  Effect.provide(BunServices.layer),
  Effect.orElseSucceed(() => Redacted.make('')),
)

const live = <A>(body: Effect.Effect<A>) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const env = yield* Config.Redacted('TYPESAFE_API_KEY').pipe(Effect.option)
      const key = Option.isSome(env) ? env.value : yield* keychainKey
      if (!Redacted.value(key)) return yield* Effect.log('live Jev eval skipped: no key')
      const provider = ConfigProvider.fromUnknown({ TYPESAFE_API_KEY: Redacted.value(key) })
      yield* body.pipe(Effect.provide(ConfigProvider.layer(provider)))
    }),
  )

test(
  'live Jev: the novel page wins with the list in either order',
  () =>
    live(
      Effect.gen(function* () {
        const forward = yield* jevSubject(SOLITUDE_Q, titles(SOLITUDE))
        const reverse = yield* jevSubject(SOLITUDE_Q, titles([...SOLITUDE].reverse()))
        yield* Effect.log(`solitude jev index: list as given ${forward}, list reversed ${reverse}`)
        // Undefined means Jev stayed under the bar; the code rule then decides.
        if (forward !== undefined) expect(forward).toBe(1)
        if (reverse !== undefined) expect(reverse).toBe(0)
        for (const [q, xs] of [
          [HEISENBERG_Q, HEISENBERG],
          [LOVELACE_Q, LOVELACE],
          [EVEREST_Q, EVEREST],
        ] as const) {
          const i = yield* jevSubject(q, titles(xs))
          yield* Effect.log(`baseline jev index for "${q}": ${i}`)
        }
      }),
    ),
  20_000,
)

test(
  'live: subjectSources keeps the novel page and every baseline source',
  () =>
    live(
      Effect.gen(function* () {
        expect(titles(yield* subjectSources(SOLITUDE_Q, SOLITUDE))).toEqual([NOVEL])
        expect(titles(yield* subjectSources(SOLITUDE_Q, [...SOLITUDE].reverse()))).toEqual([NOVEL])
        expect(yield* subjectSources(HEISENBERG_Q, HEISENBERG)).toEqual(HEISENBERG)
        expect(yield* subjectSources(LOVELACE_Q, LOVELACE)).toEqual(LOVELACE)
        expect(yield* subjectSources(EVEREST_Q, EVEREST)).toEqual(EVEREST)
      }),
    ),
  20_000,
)
