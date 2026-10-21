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
