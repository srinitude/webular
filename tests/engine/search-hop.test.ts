// Second hop on the bench riddle, from recorded live Wikipedia hits (no network): the
// bridge entity's page sits third, so the hop moves it to the lead with no extra round,
// because the answer step takes the lead hit's title as the entity of a nameless question.
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { type SourceRunner, searchEffect } from '../../src/lib/search-chain.ts'
import { mainEntity } from '../../src/lib/search-hop.ts'
import { eff } from '../_support/run.ts'
import riddleTop from '../fixtures/wikipedia-uncertainty-riddle.json'

const riddle = 'In which city was the physicist who formulated the uncertainty principle born?'

test(
  'a bridge entity page already in the top hits leads',
  eff(
    Effect.gen(function* () {
      const calls: string[] = []
      const runSource: SourceRunner = (source, query) => {
        calls.push(query)
        return Effect.succeed(source === 'wikipedia' ? riddleTop : [])
      }
      const { results } = yield* searchEffect('web', riddle, 3, { hop: true, runSource })
      expect(results.map((h) => h.title)).toEqual([
        'Werner Heisenberg',
        'Uncertainty principle',
        'Pauli exclusion principle',
      ])
      expect(calls.every((q) => q === riddle)).toBe(true)
    }),
  ),
)

// A title with a lowercase connector ("of") is one entity; its page at the top
// means no extra rounds (the split entity cost two sequential searches, ~1.5 s).
const novel = "Who wrote the novel 'One Hundred Years of Solitude'?"
const novelTop = [
  {
    title: 'One Hundred Years of Solitude',
    url: 'https://en.wikipedia.org/wiki/One_Hundred_Years_of_Solitude',
    description: 'novel by Gabriel García Márquez',
  },
]

test('a quoted title with "of" is one entity, so its top page needs no hop', () => {
  expect(mainEntity(novel)).toBe('One Hundred Years of Solitude')
  expect(mainEntity('Who founded the Bank of England?')).toBe('Bank of England')
  expect(mainEntity("What is O'Brien's job?")).toBe("O'Brien's")
  return eff(
    Effect.gen(function* () {
      const calls: string[] = []
      const runSource: SourceRunner = (source, query) => {
        calls.push(query)
        return Effect.succeed(source === 'wikipedia' ? novelTop : [])
      }
      yield* searchEffect('web', novel, 3, { hop: true, runSource })
      expect(calls.every((q) => q === novel)).toBe(true)
    }),
  )()
})

// Bench miss: "in the" split the title to "Time of Cholera", and a blog post whose
// title ends in the entity out-ranked the novel's own page in the entity round.
const cholera = 'Who wrote the novel Love in the Time of Cholera?'
const page = (title: string, url: string) => ({ title, url, description: '' })
test('the page titled exactly the entity leads over a longer namesake', () => {
  expect(mainEntity(cholera)).toBe('Love in the Time of Cholera')
  expect(mainEntity('Where is the Eiffel Tower in Paris?')).toBe('Eiffel Tower')
  return eff(
    Effect.gen(function* () {
      const runSource: SourceRunner = (source, query) => {
        if (query !== 'Love in the Time of Cholera') return Effect.succeed([])
        if (source === 'hackernews')
          return Effect.succeed([page('Cookie Love in the Time of Cholera', 'https://x.test/c')])
        if (source === 'wikipedia')
          return Effect.succeed([
            page('Love in the Time of Cholera', 'https://en.wikipedia.org/wiki/Love'),
          ])
        return Effect.succeed([])
      }
      const { results } = yield* searchEffect('web', cholera, 3, { hop: true, runSource })
      expect(results[0]?.title).toBe('Love in the Time of Cholera')
    }),
  )()
})

// Bench miss: free full-text APIs need every word, so trailing navigational
// filler hid the project; a question keeps its words.
test('trailing navigational filler is dropped before the sources run', () =>
  eff(
    Effect.gen(function* () {
      const calls = new Set<string>()
      const runSource: SourceRunner = (source, query) => {
        calls.add(query)
        return Effect.succeed(
          source === 'hackernews' ? [page('Bun blog', 'https://bun.com/blog/x')] : [],
        )
      }
      const { results } = yield* searchEffect('web', 'Bun runtime documentation homepage', 3, {
        runSource,
      })
      expect([...calls]).toEqual(['Bun runtime'])
      expect(results[0]?.url).toBe('https://bun.com/blog/x')
      calls.clear()
      yield* searchEffect('web', 'Who wrote the docs?', 3, { runSource })
      expect([...calls]).toEqual(['Who wrote the docs?'])
    }),
  )())
