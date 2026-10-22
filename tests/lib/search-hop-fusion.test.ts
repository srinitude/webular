// Second-hop fusion rules, from the retrieval research: the original query's
// results stay in the fused set and outrank hop-only results at equal rank, a hop
// that adds nothing new changes nothing, and a comparison question runs one
// sub-query per entity at once.
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { comparisonParts, secondHop } from '../../src/lib/search-hop.ts'
import { eff } from '../_support/run.ts'

const hit = (name: string) => ({
  title: name,
  url: `https://example.org/${name}`,
  description: `about ${name}`,
})
const original = ['O1', 'O2', 'O3'].map(hit)
const first = { results: original, meta: { weak: true } }
type Search = Parameters<typeof secondHop<{ weak: boolean }>>[3]
const stub =
  (answers: (q: string) => ReturnType<typeof hit>[], seen: string[] = []): Search =>
  (q) => {
    seen.push(q)
    return Effect.succeed({ results: answers(q), meta: { weak: true } })
  }

test('comparison questions split into one sub-query per entity', () => {
  expect(comparisonParts('Who is older, Alice Smith or Bob Jones?')).toEqual([
    'Who is older, Alice Smith?',
    'Who is older, Bob Jones?',
  ])
  expect(comparisonParts('Is Paris or London bigger?')).toEqual([
    'Is Paris bigger?',
    'Is London bigger?',
  ])
  expect(comparisonParts('Rust vs Go')).toEqual(['Rust', 'Go'])
  expect(comparisonParts('Where was Heisenberg born?')).toBeUndefined()
  expect(comparisonParts('what is salt or pepper')).toBeUndefined()
})

test(
  'a comparison runs its sub-queries at once and keeps the original top hit',
  eff(
    Effect.gen(function* () {
      let running = 0
      let peak = 0
      const search: Search = () =>
        Effect.gen(function* () {
          running++
          peak = Math.max(peak, running)
          yield* Effect.yieldNow
          running--
          return { results: [hit('H1'), hit('H2')], meta: { weak: true } }
        })
      const out = yield* secondHop('Is Paris or London bigger?', 2, first, search)
      expect(peak).toBe(2)
      expect(out.results.map((h) => h.title)).toEqual(['H1', 'O1'])
    }),
  ),
)

test(
  'original-query hits outrank hop-only hits at equal rank',
  eff(
    Effect.gen(function* () {
      const out = yield* secondHop(
        'Where was Heisenberg born?',
        3,
        first,
        stub((q) => (q === 'Heisenberg' ? [] : ['H1', 'H2', 'H3'].map(hit))),
      )
      expect(out.results.map((h) => h.title)).toEqual(['O1', 'H1', 'O2'])
    }),
  ),
)

test(
  'a hop that adds no new hit returns the first round unchanged',
  eff(
    Effect.gen(function* () {
      const out = yield* secondHop(
        'Where was Heisenberg born?',
        3,
        first,
        stub((q) => (q === 'Heisenberg' ? [] : original)),
      )
      expect(out).toEqual(first)
    }),
  ),
)

test(
  'the fact round keeps every other term of the question',
  eff(
    Effect.gen(function* () {
      const seen: string[] = []
      const page = {
        title: 'Werner Heisenberg',
        url: 'https://en.wikipedia.org/wiki/Werner_Heisenberg',
        description: '',
      }
      yield* secondHop(
        'Where was Heisenberg born?',
        3,
        first,
        stub((q) => (q === 'Heisenberg' ? [page] : []), seen),
      )
      expect(seen).toContain('Where was Werner Heisenberg born?')
    }),
  ),
)
